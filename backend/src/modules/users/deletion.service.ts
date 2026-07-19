import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { Prisma } from '@prisma/client'
import { prisma } from '../../config/database'

/**
 * Exclusão de conta com prazo de arrependimento (Remap 2.0 / LGPD / CDC).
 * A página pública de cancelamento agenda a exclusão (deletion_requested_at);
 * o usuário tem DELETION_GRACE_DAYS para desfazer; depois o cron purga
 * (anonimiza) usando as mesmas regras do deleteMe.
 */

export const DELETION_GRACE_DAYS = 7

/** Verifica se a conta pode ser anonimizada agora. Retorna a razão do bloqueio ou null. */
export async function getDeletionBlockers(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { provider_balance: true },
  })
  if (!user) return 'Usuário não encontrado'
  if ((user.provider_balance ?? 0) > 0) {
    return 'Você tem saldo a sacar. Faça o saque antes de excluir a conta.'
  }
  const pendingPayments = await prisma.payment.count({
    where: {
      status: { in: ['PAID', 'HELD', 'DISPUTED'] },
      OR: [{ client_id: userId }, { provider_id: userId }],
    },
  })
  if (pendingPayments > 0) {
    return 'Há pagamentos em andamento (em garantia ou em análise). Conclua-os antes de excluir a conta.'
  }
  const activeSchedules = await prisma.schedule.count({
    where: {
      status: { in: ['CONFIRMED', 'IN_PROGRESS'] },
      OR: [{ client_id: userId }, { provider_id: userId }],
    },
  })
  if (activeSchedules > 0) {
    return 'Há serviços agendados/em andamento. Conclua ou cancele antes de excluir a conta.'
  }
  return null
}

/** Anonimiza os dados pessoais preservando registros financeiros (mesma regra do deleteMe). */
export async function anonymizeUser(userId: string): Promise<void> {
  const randomPassword = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10)

  await prisma.$transaction(async (tx) => {
    await tx.refreshToken.deleteMany({ where: { user_id: userId } })
    await tx.fileAsset.deleteMany({ where: { owner_id: userId, sensitive: true } })
    await tx.verifiedProSubscription.updateMany({
      where: { user_id: userId, status: 'ACTIVE' },
      data: { status: 'CANCELLED', cancelled_at: new Date() },
    })
    await tx.user.update({
      where: { id: userId },
      data: {
        name: 'Usuário removido',
        email: `deleted+${userId}@missaocumprida.invalid`,
        password: randomPassword,
        phone: null, cpf: null, rg: null, birth_date: null, mother_name: null,
        bio: null, avatar: null,
        address_zip: null, address_street: null, address_number: null,
        address_complement: null, address_neighborhood: null,
        address_city: null, address_state: null,
        emergency_contact_name: null, emergency_contact_phone: null,
        pix_key: null, pix_key_type: null,
        document_photo_url: null, selfie_photo_url: null,
        verification_data: Prisma.DbNull,
        is_active: false,
        is_verified_pro: false,
        deletion_requested_at: null,
      },
    })
  })
}

/** Cron diário: anonimiza contas cujo prazo de arrependimento expirou. */
export async function purgeExpiredDeletionRequests(): Promise<{ purged: number; blocked: number }> {
  const cutoff = new Date(Date.now() - DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000)
  const users = await prisma.user.findMany({
    where: {
      deletion_requested_at: { lt: cutoff },
      email: { not: { startsWith: 'deleted+' } },
    },
    select: { id: true },
  })

  let purged = 0
  let blocked = 0
  for (const u of users) {
    try {
      const blocker = await getDeletionBlockers(u.id)
      if (blocker) {
        blocked++
        console.warn(`[exclusao] usuário ${u.id} com exclusão vencida mas bloqueada: ${blocker}`)
        continue
      }
      await anonymizeUser(u.id)
      purged++
    } catch (err) {
      console.error(`[exclusao] falha ao purgar usuário ${u.id}:`, err)
    }
  }
  return { purged, blocked }
}
