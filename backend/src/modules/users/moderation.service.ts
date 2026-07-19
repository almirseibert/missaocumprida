import { prisma } from '../../config/database'
import { notify } from '../push/push.service'

/**
 * Moderação de contas (Remap 2.0 — regras da Taxa de Conexão).
 * Banimento: cancelamento após receber os dados da outra parte, no-show
 * confirmado ou má-fé para evitar o pagamento/ressarcimento da taxa.
 * O ban derruba as sessões (refresh tokens) na hora; o admin pode reverter
 * via reactivate (que limpa banned_at/ban_reason).
 */

export async function banUser(userId: string, reason: string): Promise<void> {
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { is_active: false, banned_at: new Date(), ban_reason: reason, suspended_until: null },
    }),
    prisma.refreshToken.deleteMany({ where: { user_id: userId } }),
  ])
  await notify(userId, {
    type: 'GENERAL',
    title: 'Conta banida',
    body: 'Sua conta foi banida por violação dos Termos de Uso. Se acredita que houve um engano, entre em contato com o suporte.',
    channel: 'general',
  }).catch(() => {})
}

/** Suspensão imediata pendente de análise do admin (ex.: denúncia de no-show). */
export async function suspendUserForReview(userId: string, reason: string): Promise<void> {
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { is_active: false, ban_reason: reason },
    }),
    prisma.refreshToken.deleteMany({ where: { user_id: userId } }),
  ])
  await notify(userId, {
    type: 'GENERAL',
    title: 'Conta suspensa para análise',
    body: 'Recebemos uma reclamação sobre um serviço não realizado. Sua conta foi suspensa enquanto analisamos o caso.',
    channel: 'general',
  }).catch(() => {})
}
