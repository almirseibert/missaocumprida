import { prisma } from '../../config/database'

const REFERRER_REWARD = 30
const REFERRED_REWARD = 20

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
 * Cria um ReferralEvent PENDING e dá crédito ao indicado para usar no 1º pedido.
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
      data: {
        referred_by_id: referrer.id,
        credit_balance: { increment: REFERRED_REWARD },
      },
    }),
    prisma.creditTransaction.create({
      data: {
        user_id: newUserId,
        amount: REFERRED_REWARD,
        reason: 'REFERRAL_BONUS',
      },
    }),
  ])
  return { applied: true }
}

/**
 * Chamado quando o indicado COMPLETA o 1º pedido (status RATED).
 * Credita o indicador.
 */
export async function maybeCompleteReferral(userId: string, orderId: string) {
  const event = await prisma.referralEvent.findUnique({
    where: { referred_id: userId },
  })
  if (!event || event.status !== 'PENDING') return

  await prisma.$transaction([
    prisma.referralEvent.update({
      where: { id: event.id },
      data: {
        status: 'COMPLETED',
        completed_at: new Date(),
        triggered_order_id: orderId,
      },
    }),
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
