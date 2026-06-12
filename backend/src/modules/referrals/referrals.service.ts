import { prisma } from '../../config/database'

// Valores e meta configuráveis por env (ajustáveis sem mexer em código).
//  - REFERRER_REWARD / REFERRED_REWARD: crédito de cada lado (default 30 / 20)
//  - REFERRAL_THRESHOLD: volume de serviços (GMV) que o indicado precisa
//    acumular antes de liberar QUALQUER bônus. A R$500 e margem ~10%, a
//    plataforma fatura ~R$50 — o suficiente para cobrir os dois bônus.
const REFERRER_REWARD = Number(process.env.REFERRAL_REFERRER_REWARD ?? 30)
const REFERRED_REWARD = Number(process.env.REFERRAL_REFERRED_REWARD ?? 20)
export const REFERRAL_THRESHOLD = Number(process.env.REFERRAL_THRESHOLD ?? 500)

/** Gera código alfanumérico curto a partir do nome do usuário. */
export function generateReferralCode(name: string): string {
  const base = (name || 'mc')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 4) || 'MC'
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `${base}${rand}`
}

/** Garante que o usuário tem um referral_code, retornando-o. */
export async function ensureReferralCode(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, referral_code: true },
  })
  if (!user) throw new Error('Usuário não encontrado')
  if (user.referral_code) return user.referral_code

  // tenta até 5x até achar um livre
  for (let i = 0; i < 5; i++) {
    const code = generateReferralCode(user.name)
    const exists = await prisma.user.findUnique({ where: { referral_code: code } })
    if (!exists) {
      await prisma.user.update({ where: { id: userId }, data: { referral_code: code } })
      return code
    }
  }
  // fallback: usa id + rand
  const code = `MC${userId.slice(0, 6).toUpperCase()}`
  await prisma.user.update({ where: { id: userId }, data: { referral_code: code } })
  return code
}

/**
 * Chamado no registro quando o usuário informa um código de indicação válido.
 * Apenas vincula o indicado ao indicador e cria um ReferralEvent PENDING.
 *
 * NÃO credita nada neste momento: os bônus (indicador e indicado) só são
 * liberados quando o indicado acumular REFERRAL_THRESHOLD em serviços
 * concluídos — ver `accrueReferralVolume`. Isso evita pagar antes de a
 * plataforma ter faturado o suficiente para cobrir os bônus.
 */
export async function applyReferralOnRegister(
  newUserId: string,
  referralCode: string,
  ip?: string | null,
): Promise<{ applied: boolean; reason?: string }> {
  const code = referralCode.trim().toUpperCase()
  if (!code) return { applied: false, reason: 'sem código' }

  const referrer = await prisma.user.findUnique({
    where: { referral_code: code },
    select: { id: true, cpf: true },
  })
  if (!referrer) return { applied: false, reason: 'código inexistente' }
  if (referrer.id === newUserId) return { applied: false, reason: 'auto-indicação' }

  const referred = await prisma.user.findUnique({
    where: { id: newUserId },
    select: { cpf: true },
  })
  // Anti-fraude básica: mesmo CPF
  if (referred?.cpf && referrer.cpf && referred.cpf === referrer.cpf) {
    return { applied: false, reason: 'mesmo CPF' }
  }

  // Idempotência: usuário só pode ser indicado uma vez
  const existing = await prisma.referralEvent.findUnique({
    where: { referred_id: newUserId },
  })
  if (existing) return { applied: false, reason: 'já indicado' }

  await prisma.$transaction([
    prisma.referralEvent.create({
      data: {
        referrer_id: referrer.id,
        referred_id: newUserId,
        status: 'PENDING',
        referrer_reward: REFERRER_REWARD,
        referred_reward: REFERRED_REWARD,
      },
    }),
    prisma.user.update({
      where: { id: newUserId },
      data: { referred_by_id: referrer.id },
    }),
  ])
  return { applied: true }
}

/**
 * Acumula o valor de um serviço concluído do indicado e, ao cruzar a meta
 * (REFERRAL_THRESHOLD), libera os dois bônus de uma só vez (indicador +
 * indicado). Deve ser chamado quando o pagamento é LIBERADO (escrow
 * confirmado pelo cliente) — momento em que a receita é real.
 *
 * @param referredUserId  o indicado (cliente que contratou o serviço)
 * @param orderId         pedido que disparou a contabilização
 * @param amount          valor do serviço (GMV) a somar ao volume acumulado
 */
export async function accrueReferralVolume(
  referredUserId: string,
  orderId: string,
  amount: number,
) {
  if (!amount || amount <= 0) return

  const event = await prisma.referralEvent.findUnique({
    where: { referred_id: referredUserId },
  })
  if (!event || event.status !== 'PENDING') return

  const newVolume = event.qualifying_volume + amount

  // Ainda não bateu a meta: só acumula o volume e segue PENDING.
  if (newVolume < REFERRAL_THRESHOLD) {
    await prisma.referralEvent.update({
      where: { id: event.id },
      data: { qualifying_volume: newVolume },
    })
    return
  }

  // Meta atingida: marca COMPLETED e credita os dois lados de uma vez.
  await prisma.$transaction([
    prisma.referralEvent.update({
      where: { id: event.id },
      data: {
        qualifying_volume: newVolume,
        status: 'COMPLETED',
        completed_at: new Date(),
        triggered_order_id: orderId,
      },
    }),
    // Indicador
    prisma.user.update({
      where: { id: event.referrer_id },
      data: { credit_balance: { increment: event.referrer_reward } },
    }),
    prisma.creditTransaction.create({
      data: {
        user_id: event.referrer_id,
        amount: event.referrer_reward,
        reason: 'REFERRAL_EARNED',
        ref_id: event.id,
      },
    }),
    // Indicado
    prisma.user.update({
      where: { id: event.referred_id },
      data: { credit_balance: { increment: event.referred_reward } },
    }),
    prisma.creditTransaction.create({
      data: {
        user_id: event.referred_id,
        amount: event.referred_reward,
        reason: 'REFERRAL_BONUS',
        ref_id: event.id,
      },
    }),
  ])
}

/**
 * Debita até `amount` do saldo do usuário e retorna o quanto foi debitado.
 */
export async function consumeCredit(
  userId: string,
  amount: number,
  ref: { reason: string; ref_id?: string },
): Promise<number> {
  if (amount <= 0) return 0
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { credit_balance: true },
  })
  if (!user) return 0
  const used = Math.min(user.credit_balance, amount)
  if (used <= 0) return 0
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { credit_balance: { decrement: used } },
    }),
    prisma.creditTransaction.create({
      data: {
        user_id: userId,
        amount: -used,
        reason: ref.reason,
        ref_id: ref.ref_id,
      },
    }),
  ])
  return used
}
