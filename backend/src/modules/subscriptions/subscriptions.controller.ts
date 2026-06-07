import { Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../../config/database'
import * as R from '../../utils/response'
import { computeNextOccurrence } from './subscriptions.service'

const createSchema = z.object({
  provider_id: z.string().uuid(),
  category_id: z.string().uuid(),
  frequency: z.enum(['WEEKLY', 'BIWEEKLY', 'MONTHLY']),
  weekday: z.number().int().min(0).max(6).nullable().optional(),
  day_of_month: z.number().int().min(1).max(31).nullable().optional(),
  time_slot: z.string().regex(/^\d{2}:\d{2}$/).default('08:00'),
  base_value: z.number().positive(),
  discount_pct: z.number().min(0).max(0.5).default(0.1),
  payment_method: z.enum(['PIX', 'CARD']).default('PIX'),
  auto_charge: z.boolean().default(true),
  title: z.string().min(3).max(200),
  description: z.string().max(2000).optional(),
  answers: z.record(z.unknown()).optional().default({}),
  address: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string(),
  state: z.string().default('SP'),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  start_date: z.string().datetime().optional(),
})

const subSelect = {
  id: true, frequency: true, weekday: true, day_of_month: true, time_slot: true,
  base_value: true, discount_pct: true, status: true, next_occurrence: true,
  payment_method: true, auto_charge: true, title: true, description: true,
  city: true, state: true, neighborhood: true, address: true,
  created_at: true,
  client: { select: { id: true, name: true, avatar: true } },
  provider: { select: { id: true, name: true, avatar: true, rating_avg: true } },
  category: { select: { id: true, name: true, slug: true, icon: true } },
} as const

// POST /api/subscriptions
export async function createSubscription(req: Request, res: Response) {
  const parsed = createSchema.safeParse(req.body)
  if (!parsed.success) return R.badRequest(res, 'Dados inválidos', parsed.error.flatten().fieldErrors)
  const d = parsed.data
  if (d.provider_id === req.userId) return R.badRequest(res, 'Você não pode assinar consigo mesmo')

  if ((d.frequency === 'WEEKLY' || d.frequency === 'BIWEEKLY') && (d.weekday == null)) {
    return R.badRequest(res, 'Informe o dia da semana')
  }
  if (d.frequency === 'MONTHLY' && (d.day_of_month == null)) {
    return R.badRequest(res, 'Informe o dia do mês')
  }

  const startDate = d.start_date ? new Date(d.start_date) : new Date()
  const next = computeNextOccurrence(d.frequency, startDate, {
    weekday: d.weekday ?? null,
    day_of_month: d.day_of_month ?? null,
    time_slot: d.time_slot,
  })

  const sub = await prisma.subscription.create({
    data: {
      client_id: req.userId!,
      provider_id: d.provider_id,
      category_id: d.category_id,
      frequency: d.frequency,
      weekday: d.weekday ?? null,
      day_of_month: d.day_of_month ?? null,
      time_slot: d.time_slot,
      base_value: d.base_value,
      discount_pct: d.discount_pct,
      payment_method: d.payment_method,
      auto_charge: d.auto_charge,
      title: d.title,
      description: d.description,
      answers: d.answers as any,
      address: d.address,
      neighborhood: d.neighborhood,
      city: d.city,
      state: d.state,
      latitude: d.latitude,
      longitude: d.longitude,
      next_occurrence: next,
      status: 'ACTIVE',
    },
    select: subSelect,
  })
  return R.created(res, sub, 'Assinatura criada')
}

// GET /api/subscriptions — cliente vê suas; prestador vê as dele
export async function listSubscriptions(req: Request, res: Response) {
  const role = String(req.query.role || 'client')
  const where =
    role === 'provider' ? { provider_id: req.userId! } : { client_id: req.userId! }
  const subs = await prisma.subscription.findMany({
    where,
    orderBy: [{ status: 'asc' }, { next_occurrence: 'asc' }],
    select: subSelect,
  })
  return R.ok(res, subs)
}

// GET /api/subscriptions/:id
export async function getSubscription(req: Request, res: Response) {
  const sub = await prisma.subscription.findUnique({
    where: { id: req.params.id },
    select: {
      ...subSelect,
      latitude: true,
      longitude: true,
      occurrences: {
        orderBy: { scheduled_for: 'desc' },
        take: 30,
        include: {
          order: { select: { id: true, status: true, final_price: true } },
        },
      },
    },
  })
  if (!sub) return R.notFound(res, 'Assinatura não encontrada')
  if (sub.client.id !== req.userId && sub.provider.id !== req.userId) return R.forbidden(res)
  return R.ok(res, sub)
}

// PATCH /api/subscriptions/:id
const updateSchema = z.object({
  status: z.enum(['ACTIVE', 'PAUSED', 'CANCELLED']).optional(),
  time_slot: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  weekday: z.number().int().min(0).max(6).optional(),
  day_of_month: z.number().int().min(1).max(31).optional(),
})

export async function updateSubscription(req: Request, res: Response) {
  const parsed = updateSchema.safeParse(req.body)
  if (!parsed.success) return R.badRequest(res, 'Dados inválidos', parsed.error.flatten().fieldErrors)
  const sub = await prisma.subscription.findUnique({ where: { id: req.params.id } })
  if (!sub) return R.notFound(res, 'Assinatura não encontrada')
  if (sub.client_id !== req.userId && sub.provider_id !== req.userId) return R.forbidden(res)

  const data: any = { ...parsed.data }
  // recalcula next_occurrence se mudou agenda
  if (parsed.data.time_slot || parsed.data.weekday != null || parsed.data.day_of_month != null) {
    const next = computeNextOccurrence(sub.frequency, new Date(), {
      weekday: parsed.data.weekday ?? sub.weekday,
      day_of_month: parsed.data.day_of_month ?? sub.day_of_month,
      time_slot: parsed.data.time_slot ?? sub.time_slot,
    })
    data.next_occurrence = next
  }
  if (parsed.data.status === 'CANCELLED') data.cancelled_at = new Date()

  const updated = await prisma.subscription.update({
    where: { id: sub.id },
    data,
    select: subSelect,
  })
  return R.ok(res, updated)
}

// DELETE /api/subscriptions/:id — cancela futuras
export async function cancelSubscription(req: Request, res: Response) {
  const sub = await prisma.subscription.findUnique({ where: { id: req.params.id } })
  if (!sub) return R.notFound(res, 'Assinatura não encontrada')
  if (sub.client_id !== req.userId && sub.provider_id !== req.userId) return R.forbidden(res)
  await prisma.subscription.update({
    where: { id: sub.id },
    data: { status: 'CANCELLED', cancelled_at: new Date() },
  })
  return R.ok(res, null, 'Assinatura cancelada. Ocorrências futuras não serão geradas.')
}

// POST /api/subscriptions/:id/skip-next
export async function skipNext(req: Request, res: Response) {
  const sub = await prisma.subscription.findUnique({ where: { id: req.params.id } })
  if (!sub) return R.notFound(res, 'Assinatura não encontrada')
  if (sub.client_id !== req.userId) return R.forbidden(res)

  await prisma.subscriptionOccurrence.create({
    data: {
      subscription_id: sub.id,
      scheduled_for: sub.next_occurrence,
      status: 'SKIPPED',
      reason: 'Pulado pelo cliente',
    },
  })
  const next = computeNextOccurrence(sub.frequency, sub.next_occurrence, {
    weekday: sub.weekday,
    day_of_month: sub.day_of_month,
    time_slot: sub.time_slot,
  })
  const updated = await prisma.subscription.update({
    where: { id: sub.id },
    data: { next_occurrence: next },
    select: subSelect,
  })
  return R.ok(res, updated, 'Próxima ocorrência pulada')
}
