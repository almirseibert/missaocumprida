import { Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../../config/database'
import { ok, created, badRequest, forbidden, notFound } from '../../utils/response'
import { sendToUser } from '../push/push.service'
import { getIO } from '../realtime/realtime'
import { contactsUnlocked } from '../../utils/orderVisibility'

const sendSchema = z.object({
  content: z.string().min(1).max(2000),
})

const CHAT_LOCKED_MSG = 'O chat é liberado depois que as taxas de conexão forem confirmadas'

export async function listMessages(req: Request, res: Response) {
  const { scheduleId } = req.params

  const schedule = await prisma.schedule.findUnique({
    where: { id: scheduleId },
    include: { order: { select: { status: true, provider_fee_paid_at: true } } },
  })
  if (!schedule) return notFound(res, 'Agendamento não encontrado')

  if (schedule.provider_id !== req.userId && schedule.client_id !== req.userId) {
    return forbidden(res)
  }
  // Taxa de Conexão: chat só depois que as duas taxas foram pagas
  if (!contactsUnlocked(schedule.order?.status, schedule.order?.provider_fee_paid_at)) {
    return forbidden(res, CHAT_LOCKED_MSG)
  }

  // Paginação do mais novo para o mais antigo: ?before=<ISO>&limit=50.
  // A resposta continua em ordem cronológica (o app antigo espera assim) —
  // antes vinham as 100 mais ANTIGAS e as novas não apareciam.
  const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '100'), 10) || 100, 1), 200)
  const before = typeof req.query.before === 'string' ? new Date(req.query.before) : null
  const newestFirst = await prisma.message.findMany({
    where: {
      schedule_id: scheduleId,
      ...(before && !Number.isNaN(before.getTime()) ? { created_at: { lt: before } } : {}),
    },
    include: { sender: { select: { id: true, name: true, avatar: true } } },
    orderBy: { created_at: 'desc' },
    take: limit,
  })
  const messages = newestFirst.reverse()

  // Mark received messages as read
  await prisma.message.updateMany({
    where: { schedule_id: scheduleId, sender_id: { not: req.userId }, is_read: false },
    data: { is_read: true },
  })

  return ok(res, messages)
}

export async function sendMessage(req: Request, res: Response) {
  const { scheduleId } = req.params
  const parsed = sendSchema.safeParse(req.body)
  if (!parsed.success) return badRequest(res, parsed.error.errors[0].message)

  const schedule = await prisma.schedule.findUnique({
    where: { id: scheduleId },
    include: { order: { select: { status: true, provider_fee_paid_at: true } } },
  })
  if (!schedule) return notFound(res, 'Agendamento não encontrado')

  if (schedule.provider_id !== req.userId && schedule.client_id !== req.userId) {
    return forbidden(res)
  }
  if (!contactsUnlocked(schedule.order?.status, schedule.order?.provider_fee_paid_at)) {
    return forbidden(res, CHAT_LOCKED_MSG)
  }

  const message = await prisma.message.create({
    data: {
      schedule_id: scheduleId,
      sender_id: req.userId!,
      content: parsed.data.content,
    },
    include: { sender: { select: { id: true, name: true, avatar: true } } },
  })

  // Broadcast via Socket.io (caso houver clientes conectados)
  try {
    getIO()?.to(`schedule:${scheduleId}`).emit('chat:message:new', message)
  } catch {}

  // Push to the other party
  const recipientId =
    schedule.provider_id === req.userId ? schedule.client_id : schedule.provider_id
  await sendToUser(recipientId, {
    title: message.sender.name,
    body: parsed.data.content.length > 80 ? parsed.data.content.slice(0, 77) + '…' : parsed.data.content,
    data: { schedule_id: scheduleId, message_id: message.id, type: 'CHAT_MESSAGE' },
    channel: 'chat_message',
  })

  return created(res, message)
}
