import { prisma } from '../../config/database'
import { notify } from '../push/push.service'
import { contactsUnlocked } from '../../utils/orderVisibility'
import { creditFee, cancelPendingFeesForProposal } from '../payments/connectionFees.service'
import { archiveScheduleTx } from './scheduleArchive.service'

/**
 * Cliente desiste depois de aceitar uma proposta, mas ANTES da conexão ser
 * paga pelos dois lados: sem punição. O agendamento é arquivado (prova) e
 * removido, a proposta é cancelada, o pedido fica CANCELLED e a taxa que o
 * cliente já tenha pago volta como crédito.
 * Usado por POST /schedules/:id/cancel e por DELETE /orders/:id.
 */
export async function cancelBeforeConnectionByClient(
  scheduleId: string,
  actorId: string,
): Promise<{ ok: boolean; message: string }> {
  const schedule = await prisma.schedule.findUnique({
    where: { id: scheduleId },
    include: { order: { include: { connection_fees: true } } },
  })
  if (!schedule) return { ok: false, message: 'Agendamento não encontrado' }
  const order = schedule.order
  if (schedule.client_id !== actorId) return { ok: false, message: 'Sem permissão' }
  if (schedule.status !== 'CONFIRMED' || contactsUnlocked(order.status, order.provider_fee_paid_at)) {
    return { ok: false, message: 'A conexão já foi concluída — este pedido não pode mais ser cancelado sem penalidade.' }
  }

  await prisma.$transaction(async (tx) => {
    await archiveScheduleTx(tx, schedule.id, 'CLIENT_CANCELLED_BEFORE_CONNECTION', actorId)
    await tx.message.deleteMany({ where: { schedule_id: schedule.id } })
    await tx.rating.deleteMany({ where: { schedule_id: schedule.id } })
    await tx.schedule.delete({ where: { id: schedule.id } })
    await tx.proposal.update({ where: { id: schedule.proposal_id }, data: { status: 'CANCELLED' } })
    await tx.order.update({
      where: { id: order.id },
      data: {
        status: 'CANCELLED',
        client_fee_paid_at: null,
        provider_fee_due_at: null,
        cancelled_at: new Date(),
        cancelled_by: actorId,
        cancel_reason: 'Cliente cancelou antes da conexão',
      },
    })
  })
  await cancelPendingFeesForProposal(schedule.proposal_id)
  const clientFee = order.connection_fees.find((f) => f.side === 'CLIENT')
  if (clientFee) await creditFee(clientFee, 'PRE_CONNECTION_CANCEL')
  await notify(schedule.provider_id, {
    type: 'GENERAL',
    title: 'Pedido cancelado',
    body: 'O cliente cancelou o pedido antes da conexão ser concluída.',
    data: { order_id: order.id },
    channel: 'schedule_update',
  }).catch(() => {})
  return { ok: true, message: 'Pedido cancelado. Se você já tinha pago a taxa, ela voltou como crédito.' }
}
