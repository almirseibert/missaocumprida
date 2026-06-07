import { Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../../config/database'
import { ok, created, badRequest, forbidden, notFound } from '../../utils/response'
import { sendToUser } from '../push/push.service'
import { getIO } from '../realtime/realtime'

const sendSchema = z.object({
  content: z.string().min(1).max(2000),
})

export async function listMessages(req: Request, res: Response) {
  const { scheduleId } = req.params

  const schedule = await prisma.schedule.findUnique({ where: { id: scheduleId } })
  if (!schedule) return notFound(res, 'Agendamento não encontrado')

  if (schedule.provider_id !== req.userId && schedule.client_id !== req.userId) {
    return forbidden(res)
  }

  const messages = await prisma.message.findMany({
    where: { schedule_id: scheduleId },
    include: { sender: { select: { id: true, name: true, avatar: true } } },
    orderBy: { created_at: 'asc' },
    take: 100,
  })

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

  const schedule = await prisma.schedule.findUnique({ where: { id: scheduleId } })
  if (!schedule) return notFound(res, 'Agendamento não encontrado')

  if (schedule.provider_id !== req.userId && schedule.client_id !== req.userId) {
    return forbidden(res)
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
