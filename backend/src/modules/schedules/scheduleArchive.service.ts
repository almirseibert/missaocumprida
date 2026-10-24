import { Prisma } from '@prisma/client'

/**
 * Antes de um agendamento ser apagado (conexão desfeita: desistência,
 * no-show, prazo da taxa), guarda uma cópia com o chat e as avaliações em
 * schedule_archives. É a prova que o suporte usa para responder reclamações
 * e decidir reembolsos. Roda dentro da mesma transação do delete.
 */
export async function archiveScheduleTx(
  tx: Prisma.TransactionClient,
  scheduleId: string,
  reason: string,
  archivedBy?: string | null,
): Promise<void> {
  const schedule = await tx.schedule.findUnique({
    where: { id: scheduleId },
    include: {
      messages: { orderBy: { created_at: 'asc' } },
      ratings: true,
    },
  })
  if (!schedule) return
  const photos = await tx.orderPhoto.findMany({ where: { schedule_id: scheduleId } })
  const { messages, ratings, ...scheduleData } = schedule
  await tx.scheduleArchive.create({
    data: {
      schedule_id: schedule.id,
      order_id: schedule.order_id,
      proposal_id: schedule.proposal_id,
      provider_id: schedule.provider_id,
      client_id: schedule.client_id,
      reason,
      archived_by: archivedBy ?? null,
      snapshot: JSON.parse(JSON.stringify({ schedule: scheduleData, messages, ratings, photos })),
    },
  })
}
