import { Request, Response } from 'express'
import { prisma } from '../../config/database'
import * as R from '../../utils/response'

const scheduleInclude = {
  order: {
    include: {
      category: { select: { id: true, name: true, icon: true } },
    },
  },
  provider: { select: { id: true, name: true, avatar: true, phone: true, rating_avg: true } },
  client: { select: { id: true, name: true, avatar: true, phone: true, rating_avg: true } },
  ratings: { select: { id: true, score: true, reviewer_role: true, reviewer_id: true } },
}

export async function listMySchedules(req: Request, res: Response) {
  const { status } = req.query
  const where: Record<string, unknown> = {
    OR: [{ client_id: req.userId }, { provider_id: req.userId }],
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
  return R.ok(res, schedule)
}

export async function checkin(req: Request, res: Response) {
  const schedule = await prisma.schedule.findUnique({ where: { id: req.params.id } })
  if (!schedule) return R.notFound(res, 'Agendamento não encontrado')
  if (schedule.provider_id !== req.userId) return R.forbidden(res)
  if (schedule.status !== 'CONFIRMED') return R.badRequest(res, 'Check-in não permitido neste estágio')

  const updated = await prisma.schedule.update({
    where: { id: schedule.id },
    data: { status: 'IN_PROGRESS', checkin_at: new Date() },
  })
  await prisma.order.update({ where: { id: schedule.order_id }, data: { status: 'IN_PROGRESS' } })

  return R.ok(res, updated, 'Check-in realizado com sucesso')
}

export async function completeByProvider(req: Request, res: Response) {
  const schedule = await prisma.schedule.findUnique({ where: { id: req.params.id } })
  if (!schedule) return R.notFound(res, 'Agendamento não encontrado')
  if (schedule.provider_id !== req.userId) return R.forbidden(res)
  if (schedule.status !== 'IN_PROGRESS') return R.badRequest(res, 'Serviço ainda não foi iniciado (check-in)')

  await prisma.schedule.update({
    where: { id: schedule.id },
    data: { done_at: new Date() },
  })

  return R.ok(res, null, 'Serviço marcado como concluído. Aguardando confirmação do cliente.')
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

  const ops: Parameters<typeof prisma.$transaction>[0] = [
    prisma.schedule.update({ where: { id: schedule.id }, data: { status: 'DONE' } }),
    prisma.order.update({ where: { id: schedule.order_id }, data: { status: 'DONE' } }),
  ]

  // Libera pagamento ao prestador se existir registro de pagamento pago
  const payment = schedule.order.payment
  if (payment && payment.status === 'PAID') {
    ops.push(
      prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'RELEASED', released_at: new Date() },
      }) as never,
      prisma.user.update({
        where: { id: schedule.provider_id },
        data: { provider_balance: { increment: payment.provider_amount } },
      }) as never,
    )
  }

  await prisma.$transaction(ops)

  return R.ok(res, null, 'Serviço confirmado! O pagamento foi liberado ao prestador. Agora avalie o serviço.')
}
