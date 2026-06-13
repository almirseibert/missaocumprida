import { prisma } from '../../config/database'
import { env } from '../../config/env'
import { notify } from '../push/push.service'
import { accrueReferralVolume } from '../referrals/referrals.service'

/**
 * Segurança de Transação
 * ------------------------------------------------------------------
 * Quando o cliente confirma o serviço, o pagamento não é liberado na hora:
 * entra em garantia (status HELD) por TRANSACTION_HOLD_DAYS dias. O valor só
 * vira saldo sacável do prestador quando:
 *   1) um admin aprova a transação (admin_approved_at preenchido), E
 *   2) o prazo de retenção terminou (hold_until <= agora).
 * Reembolsos dentro da janela são tratados manualmente (status REFUNDED).
 */

export const HOLD_DAYS = env.TRANSACTION_HOLD_DAYS

/** Calcula o fim da janela de garantia a partir de uma data de confirmação. */
export function computeHoldUntil(from: Date = new Date()): Date {
  return new Date(from.getTime() + HOLD_DAYS * 24 * 60 * 60 * 1000)
}

type ReleasablePayment = {
  id: string
  order_id: string
  provider_id: string
  client_id: string
  provider_amount: number
}

/**
 * Libera de fato um pagamento ao prestador: credita o saldo, marca RELEASED,
 * registra a receita para o programa de indicação e notifica. Idempotente por
 * transação (só age se o registro ainda não estiver RELEASED).
 */
export async function releasePayment(payment: ReleasablePayment): Promise<void> {
  // A condição no updateMany garante que dois processos concorrentes
  // (cron + clique do admin) não creditem o saldo em dobro.
  const updated = await prisma.$transaction(async (tx) => {
    const res = await tx.payment.updateMany({
      where: { id: payment.id, status: { in: ['HELD', 'DISPUTED'] } },
      data: { status: 'RELEASED', released_at: new Date() },
    })
    if (res.count === 0) return false
    await tx.user.update({
      where: { id: payment.provider_id },
      data: { provider_balance: { increment: payment.provider_amount } },
    })
    return true
  })

  if (!updated) return

  // Receita real liberada → conta para a meta do programa de indicação.
  const order = await prisma.order.findUnique({
    where: { id: payment.order_id },
    select: { final_price: true, client_total: true },
  })
  const serviceValue = order?.final_price ?? order?.client_total ?? 0
  await accrueReferralVolume(payment.client_id, payment.order_id, serviceValue).catch(() => {})

  await notify(payment.provider_id, {
    type: 'PAYMENT_RECEIVED',
    title: 'Pagamento liberado 💰',
    body: `R$ ${payment.provider_amount.toFixed(2)} caíram no seu saldo após a análise de Segurança de Transação.`,
    data: { payment_id: payment.id, order_id: payment.order_id },
    channel: 'payment',
  })
}

/**
 * Job: libera todos os pagamentos elegíveis — em garantia (HELD), já aprovados
 * por um admin e com a janela de retenção encerrada. Rodado por cron diário.
 */
export async function releaseEligiblePayments(): Promise<{ released: number }> {
  const now = new Date()
  const eligible = await prisma.payment.findMany({
    where: {
      status: 'HELD',
      admin_approved_at: { not: null },
      hold_until: { lte: now },
    },
    select: {
      id: true,
      order_id: true,
      provider_id: true,
      client_id: true,
      provider_amount: true,
    },
  })

  let released = 0
  for (const p of eligible) {
    try {
      await releasePayment(p)
      released++
    } catch (err) {
      console.error(`[seguranca-transacao] falha ao liberar payment ${p.id}:`, err)
    }
  }
  return { released }
}
