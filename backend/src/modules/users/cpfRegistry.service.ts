// ============================================================
// Um cadastro por CPF.
// O CPF de cada conta fica registrado (como hash) em cpf_registry. O registro
// continua depois que a conta é excluída (DELETED) ou banida (BANNED), então
// o mesmo CPF não consegue abrir outra conta — nem com outro e-mail.
// O admin pode liberar um CPF (RELEASED) em caso de fraude/uso indevido.
// ============================================================
import { Prisma } from '@prisma/client'
import { prisma } from '../../config/database'
import { cpfHash, cpfHashes, normalizeCpf } from '../../utils/cpf'

type Tx = Prisma.TransactionClient | typeof prisma

export class CpfInUseError extends Error {
  status = 409
  code = 'CPF_JA_CADASTRADO'
  constructor() {
    super('Este CPF já está vinculado a outra conta. Se você não reconhece esse cadastro, fale com o suporte.')
  }
}

/**
 * Vincula o CPF ao usuário. Lança CpfInUseError se o CPF pertence (ou
 * pertenceu) a outra conta. Idempotente para o próprio dono.
 */
export async function claimCpf(tx: Tx, userId: string, cpfRaw: string): Promise<void> {
  const hashes = cpfHashes(cpfRaw)
  const rows = await tx.cpfRegistry.findMany({ where: { cpf_hash: { in: hashes } } })
  const blocking = rows.find((r) => r.user_id !== userId && r.status !== 'RELEASED')
  if (blocking) throw new CpfInUseError()

  // Conta ativa com o mesmo CPF (dado anterior ao registro) também bloqueia
  const cpf = normalizeCpf(cpfRaw)
  const other = await tx.user.findFirst({ where: { cpf, id: { not: userId } }, select: { id: true } })
  if (other) throw new CpfInUseError()

  const primary = cpfHash(cpfRaw)
  await tx.cpfRegistry.upsert({
    where: { cpf_hash: primary },
    create: { cpf_hash: primary, user_id: userId, status: 'ACTIVE' },
    update: { user_id: userId, status: 'ACTIVE', released_by: null, release_reason: null },
  })
  // Hashes com chave antiga do mesmo CPF passam a apontar para a linha nova
  const legacy = rows.filter((r) => r.cpf_hash !== primary).map((r) => r.cpf_hash)
  if (legacy.length) await tx.cpfRegistry.deleteMany({ where: { cpf_hash: { in: legacy } } })
}

/** Usuário trocou o CPF antes da verificação: o CPF antigo deixa de ser dele. */
export async function releaseOwnCpf(tx: Tx, userId: string, cpfRaw: string): Promise<void> {
  await tx.cpfRegistry.deleteMany({
    where: { cpf_hash: { in: cpfHashes(cpfRaw) }, user_id: userId, status: 'ACTIVE' },
  })
}

/** Exclusão/banimento: o hash fica, marcado, para barrar recadastro. */
export async function markCpfStatus(tx: Tx, userId: string, status: 'DELETED' | 'BANNED'): Promise<void> {
  const user = await tx.user.findUnique({ where: { id: userId }, select: { cpf: true } })
  if (user?.cpf) {
    const primary = cpfHash(user.cpf)
    await tx.cpfRegistry.upsert({
      where: { cpf_hash: primary },
      create: { cpf_hash: primary, user_id: userId, status },
      update: { status },
    })
  }
  await tx.cpfRegistry.updateMany({ where: { user_id: userId, status: { not: 'RELEASED' } }, data: { status } })
}

/** Admin libera um CPF (ex.: alguém usou o CPF de outra pessoa). */
export async function releaseCpfByAdmin(cpfRaw: string, adminId: string, reason: string): Promise<number> {
  const result = await prisma.cpfRegistry.updateMany({
    where: { cpf_hash: { in: cpfHashes(cpfRaw) } },
    data: { status: 'RELEASED', released_by: adminId, release_reason: reason },
  })
  return result.count
}

/** Situação de um CPF (para a busca do admin), sem expor o número. */
export async function lookupCpf(cpfRaw: string) {
  return prisma.cpfRegistry.findMany({
    where: { cpf_hash: { in: cpfHashes(cpfRaw) } },
    select: { user_id: true, status: true, created_at: true, updated_at: true, released_by: true, release_reason: true },
  })
}

/**
 * Preenche o registro com os CPFs que já existiam antes desta regra.
 * Roda no boot, em lotes, e é idempotente (não sobrescreve nada).
 */
export async function backfillCpfRegistry(): Promise<number> {
  let created = 0
  let cursor: string | undefined
  for (;;) {
    const users = await prisma.user.findMany({
      where: { cpf: { not: null } },
      select: { id: true, cpf: true, banned_at: true, email: true },
      orderBy: { id: 'asc' },
      take: 500,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    })
    if (users.length === 0) break
    cursor = users[users.length - 1].id
    const rows = users
      .filter((u) => u.cpf && normalizeCpf(u.cpf).length >= 11)
      .map((u) => ({
        cpf_hash: cpfHash(u.cpf),
        user_id: u.id,
        status: u.banned_at ? 'BANNED' : u.email.endsWith('@missaocumprida.invalid') ? 'DELETED' : 'ACTIVE',
      }))
    if (rows.length) {
      const r = await prisma.cpfRegistry.createMany({ data: rows, skipDuplicates: true })
      created += r.count
    }
  }
  return created
}
