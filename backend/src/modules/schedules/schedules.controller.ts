import { Request, Response } from 'express'
import { prisma } from '../../config/database'
import { env } from '../../config/env'
import * as R from '../../utils/response'
import { sendToUser, PushChannel } from '../push/push.service'
import { persistUpload } from '../files/files.service'
import { computeHoldUntil } from '../payments/payments.service'

const scheduleInclude = {
  order: {
    include: {
      category: { select: { id: true, name: true, icon: true } },
    },
  },
  provider: { select: { id: true, name: true, avatar: true, phone: true, rating_avg: true, hourly_rate: true } },
  client: { select: { id: true, name: true, avatar: true, phone: true, rating_avg: true } },
  ratings: { select: { id: true, score: true, reviewer_role: true, reviewer_id: true } },
}

// Helper: create in-app notification + send push
async function notify(
  userId: string,
  type: string,
  title: string,
  body: string,
  data?: object,
  channel: PushChannel = 'schedule_update'
) {
  try {
    await prisma.notification.create({
      data: { user_id: userId, type: type as never, title, body, data: data ?? undefined },
    })
  } catch (err) {
    console.error('[notify] db error:', err)
  }
  await sendToUser(userId, { title, body, data: data as any, channel })
}

// Statuses visible to the provider only after payment is confirmed
const PROVIDER_VISIBLE_ORDER_STATUSES = ['SCHEDULED', 'IN_PROGRESS', 'DONE', 'RATED', 'CANCELLED', 'DISPUTED']

export async function listMySchedules(req: Request, res: Response) {
  const { status } = req.query
  const where: Record<string, unknown> = {
    OR: [
      { client_id: req.userId },
      // Provider only sees schedules once the order is paid (SCHEDULED or beyond)
      {
        provider_id: req.userId,
        order: { status: { in: PROVIDER_VISIBLE_ORDER_STATUSES } },
      },
    ],
  }
  if (status) where.status = status

  const schedules = await prisma.schedule.findMany({
    where,
    orderBy: { scheduled_at: 'asc' },
    include: scheduleInclude,
  })
  return R.ok(res, schedules)
}

export async function getSchedule(req: Request, res: Response) {
  const schedule = await prisma.schedule.findUnique({
    where: { id: req.params.id },
    include: { ...scheduleInclude, messages: { orderBy: { created_at: 'asc' }, take: 50 } },
  })
  if (!schedule) return R.notFound(res, 'Agendamento não encontrado')
  if (schedule.client_id !== req.userId && schedule.provider_id !== req.userId) {
    return R.forbidden(res)
  }
  // Provider can only access the schedule after payment is confirmed
  if (
    schedule.provider_id === req.userId &&
    schedule.client_id !== req.userId &&
    !PROVIDER_VISIBLE_ORDER_STATUSES.includes(schedule.order?.status as string)
  ) {
    return R.notFound(res, 'Agendamento não encontrado')
  }
  return R.ok(res, schedule)
}

export async function checkin(req: Request, res: Response) {
  const schedule = await prisma.schedule.findUnique({ where: { id: req.params.id } })
  if (!schedule) return R.notFound(res, 'Agendamento não encontrado')
  if (schedule.provider_id !== req.userId) return R.forbidden(res)
  if (schedule.status !== 'CONFIRMED') return R.badRequest(res, 'Check-in não permitido neste estágio')

  if (!req.file) return R.badRequest(res, 'Foto de check-in é obrigatória')

  const lat = req.body.lat ? parseFloat(req.body.lat) : null
  const lng = req.body.lng ? parseFloat(req.body.lng) : null
  const address = req.body.address ?? null

  const photoUrl = await persistUpload(req, req.file)

  const updated = await prisma.schedule.update({
    where: { id: schedule.id },
    data: {
      status: 'IN_PROGRESS',
      checkin_at: new Date(),
      checkin_photo_url: photoUrl,
      checkin_lat: lat,
      checkin_lng: lng,
      checkin_address: address,
    },
  })
  await prisma.order.update({ where: { id: schedule.order_id }, data: { status: 'IN_PROGRESS' } })

  // Notify client
  await notify(
    schedule.client_id,
    'CHECKIN_DONE',
    'Prestador iniciou o serviço',
    'O prestador realizou o check-in e o serviço está em andamento.',
    { schedule_id: schedule.id },
  )

  return R.ok(res, updated, 'Check-in realizado com sucesso')
}

export async function completeByProvider(req: Request, res: Response) {
  const schedule = await prisma.schedule.findUnique({
    where: { id: req.params.id },
    include: { provider: { select: { hourly_rate: true } } },
  })
  if (!schedule) return R.notFound(res, 'Agendamento não encontrado')
  if (schedule.provider_id !== req.userId) return R.forbidden(res)
  if (schedule.status !== 'IN_PROGRESS') return R.badRequest(res, 'Serviço ainda não foi iniciado (check-in)')

  if (!req.file) return R.badRequest(res, 'Foto de conclusão é obrigatória')

  const lat = req.body.lat ? parseFloat(req.body.lat) : null
  const lng = req.body.lng ? parseFloat(req.body.lng) : null
  const address = req.body.address ?? null

  // Calculate duration and hourly amount
  let durationMinutes: number | null = null
  let hourlyAmount: number | null = null
  if (schedule.checkin_at) {
    durationMinutes = Math.round((Date.now() - schedule.checkin_at.getTime()) / 60000)
    const rate = schedule.provider?.hourly_rate ?? null
    if (rate) {
      hourlyAmount = Math.round((durationMinutes / 60) * rate * 100) / 100
    }
  }

  const photoUrl = await persistUpload(req, req.file)

  await prisma.schedule.update({
    where: { id: schedule.id },
    data: {
      done_at: new Date(),
      complete_photo_url: photoUrl,
      complete_lat: lat,
      complete_lng: lng,
      complete_address: address,
      duration_minutes: durationMinutes,
      hourly_amount: hourlyAmount,
    },
  })

  // Notify client
  await notify(
    schedule.client_id,
    'SERVICE_COMPLETED',
    'Serviço concluído pelo prestador',
    'O prestador marcou o serviço como concluído. Confirme para liberar o pagamento.',
    { schedule_id: schedule.id },
  )

  return R.ok(res, { duration_minutes: durationMinutes, hourly_amount: hourlyAmount }, 'Serviço marcado como concluído. Aguardando confirmação do cliente.')
}

export async function confirmByClient(req: Request, res: Response) {
  const schedule = await prisma.schedule.findUnique({
    where: { id: req.params.id },
    include: { order: { include: { payment: true } } },
  })
  if (!schedule) return R.notFound(res, 'Agendamento não encontrado')
  if (schedule.client_id !== req.userId) return R.forbidden(res)
  if (!schedule.done_at) return R.badRequest(res, 'O prestador ainda não marcou o serviço como concluído')
  if (schedule.status !== 'IN_PROGRESS') return R.badRequest(res, 'Confirmação não permitida neste estágio')

  const payment = schedule.order.payment

  // Segurança de Transação: o valor pago NÃO é liberado na hora. Entra em
  // garantia (HELD) por TRANSACTION_HOLD_DAYS dias e só vira saldo sacável do
  // prestador após análise/aprovação de um admin. Isso preserva uma janela
  // legal para reclamação e possível reembolso, mesmo com o aceite do cliente.
  const now = new Date()
  const holdUntil = computeHoldUntil(now)
  const goesToHold = !!payment && payment.status === 'PAID'

  const ops = [
    prisma.schedule.update({ where: { id: schedule.id }, data: { status: 'DONE' } }),
    prisma.order.update({ where: { id: schedule.order_id }, data: { status: 'DONE' } }),
    ...(goesToHold
      ? [
          prisma.payment.update({
            where: { id: payment!.id },
            data: { status: 'HELD', confirmed_at: now, hold_until: holdUntil },
          }),
        ]
      : []),
  ]

  await prisma.$transaction(ops)

  // Notify provider — valor em garantia (não liberado ainda)
  await notify(
    schedule.provider_id,
    'SERVICE_CONFIRMED',
    'Serviço confirmado pelo cliente',
    goesToHold
      ? `R$ ${(payment?.provider_amount ?? 0).toFixed(2)} entraram em garantia (Segurança de Transação) e serão liberados após análise, em até ${env.TRANSACTION_HOLD_DAYS} dias.`
      : 'O cliente confirmou a conclusão do serviço.',
    { schedule_id: schedule.id, payment_id: payment?.id, hold_until: goesToHold ? holdUntil.toISOString() : undefined },
    'schedule_update',
  )

  return R.ok(
    res,
    null,
    `Serviço confirmado! O pagamento entrou em garantia (Segurança de Transação) e será liberado ao prestador após análise, em até ${env.TRANSACTION_HOLD_DAYS} dias. Agora avalie o serviço.`,
  )
}
