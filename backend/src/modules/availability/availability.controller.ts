import { Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../../config/database'
import * as R from '../../utils/response'

const timeRe = /^\d{2}:\d{2}$/

const ruleSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  start_time: z.string().regex(timeRe),
  end_time: z.string().regex(timeRe),
  slot_min: z.number().int().min(15).max(480).default(60),
  category_id: z.string().uuid().nullable().optional(),
})

const bulkSchema = z.object({
  rules: z.array(ruleSchema),
})

const exceptionSchema = z.object({
  date: z.string(),
  blocked: z.boolean().default(true),
  start_time: z.string().regex(timeRe).optional().nullable(),
  end_time: z.string().regex(timeRe).optional().nullable(),
  note: z.string().max(200).optional().nullable(),
})

// PUT /api/users/me/availability — bulk upsert (replace todas as regras)
export async function putMyRules(req: Request, res: Response) {
  const parsed = bulkSchema.safeParse(req.body)
  if (!parsed.success) return R.badRequest(res, 'Dados inválidos', parsed.error.flatten().fieldErrors)
  // valida start < end por regra
  for (const r of parsed.data.rules) {
    if (r.start_time >= r.end_time) return R.badRequest(res, 'Horário inicial deve ser menor que o final')
  }
  await prisma.$transaction([
    prisma.availabilityRule.deleteMany({ where: { provider_id: req.userId! } }),
    prisma.availabilityRule.createMany({
      data: parsed.data.rules.map((r) => ({
        ...r,
        provider_id: req.userId!,
        category_id: r.category_id ?? null,
      })),
    }),
  ])
  const rules = await prisma.availabilityRule.findMany({
    where: { provider_id: req.userId! },
    orderBy: [{ weekday: 'asc' }, { start_time: 'asc' }],
  })
  return R.ok(res, rules)
}

// GET /api/users/me/availability
export async function getMyRules(req: Request, res: Response) {
  const rules = await prisma.availabilityRule.findMany({
    where: { provider_id: req.userId! },
    orderBy: [{ weekday: 'asc' }, { start_time: 'asc' }],
  })
  const exceptions = await prisma.availabilityException.findMany({
    where: { provider_id: req.userId!, date: { gte: new Date() } },
    orderBy: { date: 'asc' },
  })
  return R.ok(res, { rules, exceptions })
}

// POST /api/users/me/availability/exception
export async function postException(req: Request, res: Response) {
  const parsed = exceptionSchema.safeParse(req.body)
  if (!parsed.success) return R.badRequest(res, 'Dados inválidos', parsed.error.flatten().fieldErrors)
  const date = new Date(parsed.data.date)
  if (isNaN(date.getTime())) return R.badRequest(res, 'Data inválida')
  const onlyDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const ex = await prisma.availabilityException.upsert({
    where: { provider_id_date: { provider_id: req.userId!, date: onlyDate } },
    create: {
      provider_id: req.userId!,
      date: onlyDate,
      blocked: parsed.data.blocked,
      start_time: parsed.data.start_time ?? null,
      end_time: parsed.data.end_time ?? null,
      note: parsed.data.note ?? null,
    },
    update: {
      blocked: parsed.data.blocked,
      start_time: parsed.data.start_time ?? null,
      end_time: parsed.data.end_time ?? null,
      note: parsed.data.note ?? null,
    },
  })
  return R.ok(res, ex)
}

// DELETE /api/users/me/availability/exception/:id
export async function deleteException(req: Request, res: Response) {
  const ex = await prisma.availabilityException.findUnique({ where: { id: req.params.id } })
  if (!ex || ex.provider_id !== req.userId) return R.notFound(res, 'Exceção não encontrada')
  await prisma.availabilityException.delete({ where: { id: ex.id } })
  return R.noContent(res)
}

// GET /api/users/:providerId/availability?from=YYYY-MM-DD&to=YYYY-MM-DD&category=slug
export async function getProviderSlots(req: Request, res: Response) {
  const providerId = req.params.providerId
  const fromStr = String(req.query.from || '')
  const toStr = String(req.query.to || '')
  const categorySlug = req.query.category as string | undefined

  const from = fromStr ? new Date(fromStr) : new Date()
  const to = toStr ? new Date(toStr) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
  if (isNaN(from.getTime()) || isNaN(to.getTime())) return R.badRequest(res, 'Datas inválidas')

  const category = categorySlug
    ? await prisma.category.findUnique({ where: { slug: categorySlug }, select: { id: true } })
    : null

  const [rules, exceptions, schedules] = await Promise.all([
    prisma.availabilityRule.findMany({
      where: {
        provider_id: providerId,
        OR: [{ category_id: null }, ...(category ? [{ category_id: category.id }] : [])],
      },
    }),
    prisma.availabilityException.findMany({
      where: { provider_id: providerId, date: { gte: from, lte: to } },
    }),
    prisma.schedule.findMany({
      where: {
        provider_id: providerId,
        status: { in: ['CONFIRMED', 'IN_PROGRESS'] },
        scheduled_at: { gte: from, lte: to },
      },
      select: { scheduled_at: true },
    }),
  ])

  const busySlots = new Set(schedules.map((s) => s.scheduled_at.toISOString()))
  const exMap = new Map<string, typeof exceptions[number]>()
  exceptions.forEach((e) => exMap.set(toUTCDateStr(e.date), e))

  const days: Array<{ date: string; slots: string[] }> = []
  const cur = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()))
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()))
  while (cur <= end) {
    const dayKey = toUTCDateStr(cur)
    const weekday = cur.getUTCDay()
    const ex = exMap.get(dayKey)

    let slots: string[] = []
    if (ex && ex.blocked && !ex.start_time) {
      // dia bloqueado por completo
    } else {
      // se exception com horário sobrescreve, usa só ela; senão usa rules do weekday
      const intervals: Array<{ start: string; end: string; slot: number }> = []
      if (ex && !ex.blocked && ex.start_time && ex.end_time) {
        intervals.push({ start: ex.start_time, end: ex.end_time, slot: 60 })
      } else {
        rules
          .filter((r) => r.weekday === weekday)
          .forEach((r) => intervals.push({ start: r.start_time, end: r.end_time, slot: r.slot_min }))
      }
      for (const iv of intervals) {
        const [sh, sm] = iv.start.split(':').map(Number)
        const [eh, em] = iv.end.split(':').map(Number)
        const startMin = sh * 60 + sm
        const endMin = eh * 60 + em
        for (let m = startMin; m + iv.slot <= endMin; m += iv.slot) {
          const hh = String(Math.floor(m / 60)).padStart(2, '0')
          const mm = String(m % 60).padStart(2, '0')
          const iso = new Date(`${dayKey}T${hh}:${mm}:00.000Z`).toISOString()
          if (!busySlots.has(iso)) slots.push(`${hh}:${mm}`)
        }
      }
      slots = [...new Set(slots)].sort()
    }
    if (slots.length) days.push({ date: dayKey, slots })
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return R.ok(res, { provider_id: providerId, days })
}

// POST /api/orders/direct-book — cliente reserva slot direto
const bookSchema = z.object({
  provider_id: z.string().uuid(),
  category_id: z.string().uuid(),
  scheduled_at: z.string().datetime(),
  title: z.string().min(3).max(200),
  description: z.string().max(2000).optional(),
  answers: z.record(z.unknown()).optional().default({}),
  address: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string(),
  state: z.string().default('SP'),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  agreed_price: z.number().positive(),
})

export async function directBook(req: Request, res: Response) {
  const parsed = bookSchema.safeParse(req.body)
  if (!parsed.success) return R.badRequest(res, 'Dados inválidos', parsed.error.flatten().fieldErrors)
  const d = parsed.data
  if (d.provider_id === req.userId) return R.badRequest(res, 'Você não pode agendar consigo mesmo')

  const scheduledAt = new Date(d.scheduled_at)
  // valida que o slot não está ocupado
  const conflict = await prisma.schedule.findFirst({
    where: {
      provider_id: d.provider_id,
      scheduled_at: scheduledAt,
      status: { in: ['CONFIRMED', 'IN_PROGRESS'] },
    },
  })
  if (conflict) return R.badRequest(res, 'Horário não está mais disponível')

  const PROVIDER_FEE_PCT = 0.1
  const CLIENT_FEE_PCT = 0.1
  const providerFeeValue = Math.round(d.agreed_price * PROVIDER_FEE_PCT * 100) / 100
  const providerAmount = Math.round((d.agreed_price - providerFeeValue) * 100) / 100
  const clientFeeValue = Math.round(d.agreed_price * CLIENT_FEE_PCT * 100) / 100
  const clientTotal = Math.round((d.agreed_price + clientFeeValue) * 100) / 100

  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        client_id: req.userId!,
        category_id: d.category_id,
        title: d.title,
        description: d.description,
        answers: d.answers as any,
        status: 'ACCEPTED',
        desired_date: scheduledAt,
        address: d.address,
        neighborhood: d.neighborhood,
        city: d.city,
        state: d.state,
        latitude: d.latitude,
        longitude: d.longitude,
        estimated_price_min: d.agreed_price,
        estimated_price_max: d.agreed_price,
        final_price: d.agreed_price,
        platform_fee_pct: PROVIDER_FEE_PCT,
        platform_fee_value: providerFeeValue,
        provider_amount: providerAmount,
        client_fee_pct: CLIENT_FEE_PCT,
        client_fee_value: clientFeeValue,
        client_total: clientTotal,
      },
    })
    const proposal = await tx.proposal.create({
      data: {
        order_id: order.id,
        provider_id: d.provider_id,
        value: d.agreed_price,
        message: 'Agendamento direto via agenda pública',
        status: 'ACCEPTED',
      },
    })
    await tx.schedule.create({
      data: {
        order_id: order.id,
        proposal_id: proposal.id,
        provider_id: d.provider_id,
        client_id: req.userId!,
        scheduled_at: scheduledAt,
      },
    })
    return order
  })
  return R.created(res, { order_id: result.id, client_total: clientTotal, payment_required: true })
}

function toUTCDateStr(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}
