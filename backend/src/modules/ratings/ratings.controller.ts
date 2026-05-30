import { Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../../config/database'
import * as R from '../../utils/response'

const rateSchema = z.object({
  score: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
})

export async function rateSchedule(req: Request, res: Response) {
  const parsed = rateSchema.safeParse(req.body)
  if (!parsed.success) return R.badRequest(res, 'Dados inválidos', parsed.error.flatten().fieldErrors)

  const schedule = await prisma.schedule.findUnique({ where: { id: req.params.scheduleId } })
  if (!schedule) return R.notFound(res, 'Agendamento não encontrado')
  if (schedule.status !== 'DONE') return R.badRequest(res, 'Avalie somente após a confirmação do serviço')

  const isClient = schedule.client_id === req.userId
  const isProvider = schedule.provider_id === req.userId
  if (!isClient && !isProvider) return R.forbidden(res)

  const reviewedId = isClient ? schedule.provider_id : schedule.client_id
  const reviewerRole = isClient ? 'CLIENT' : 'PROVIDER'

  // Verifica se já avaliou
  const existing = await prisma.rating.findUnique({
    where: { schedule_id_reviewer_id: { schedule_id: schedule.id, reviewer_id: req.userId } },
  })
  if (existing) return R.conflict(res, 'Você já avaliou este serviço')

  const rating = await prisma.rating.create({
    data: {
      schedule_id: schedule.id,
      reviewer_id: req.userId,
      reviewed_id: reviewedId,
      score: parsed.data.score,
      comment: parsed.data.comment,
      reviewer_role: reviewerRole,
    },
  })

  // Recalcula média do avaliado
  const agg = await prisma.rating.aggregate({
    where: { reviewed_id: reviewedId },
    _avg: { score: true },
    _count: { score: true },
  })
  await prisma.user.update({
    where: { id: reviewedId },
    data: {
      rating_avg: Math.round((agg._avg.score || 0) * 10) / 10,
      rating_count: agg._count.score,
    },
  })

  // Se ambos avaliaram, atualiza pedido para RATED
  const ratingsCount = await prisma.rating.count({ where: { schedule_id: schedule.id } })
  if (ratingsCount >= 2) {
    await prisma.order.update({ where: { id: schedule.order_id }, data: { status: 'RATED' } })
  }

  return R.created(res, rating, 'Avaliação registrada com sucesso')
}

export async function getUserRatings(req: Request, res: Response) {
  const { page = '1', limit = '10', role } = req.query
  const skip = (parseInt(page as string) - 1) * parseInt(limit as string)

  const where: Record<string, unknown> = { reviewed_id: req.params.userId }
  if (role) where.reviewer_role = role

  const [ratings, total] = await Promise.all([
    prisma.rating.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip,
      take: parseInt(limit as string),
      include: {
        reviewer: { select: { id: true, name: true, avatar: true } },
        schedule: {
          select: {
            order: { select: { category: { select: { name: true, icon: true } } } },
          },
        },
      },
    }),
    prisma.rating.count({ where }),
  ])

  return R.ok(res, { ratings, total })
}
