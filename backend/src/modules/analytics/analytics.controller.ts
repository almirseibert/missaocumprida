import { Request, Response } from 'express'
import { prisma } from '../../config/database'
import * as R from '../../utils/response'

// ============================================================
// Cache simples em memória (TTL 5 min) — substitui por Redis em prod
// ============================================================
const cache = new Map<string, { value: any; expires: number }>()
const TTL_MS = 5 * 60 * 1000

function cacheGet<T>(key: string): T | null {
  const e = cache.get(key)
  if (!e) return null
  if (e.expires < Date.now()) { cache.delete(key); return null }
  return e.value as T
}
function cacheSet(key: string, value: any) {
  cache.set(key, { value, expires: Date.now() + TTL_MS })
}

function periodFromQuery(req: Request): { from: Date; days: number; key: string } {
  const period = String(req.query.period ?? '30d')
  const m = /^(\d+)([dhm])$/i.exec(period)
  let days = 30
  if (m) {
    const n = parseInt(m[1])
    if (m[2].toLowerCase() === 'd') days = n
    else if (m[2].toLowerCase() === 'm') days = n * 30
  }
  if (period === '12m') days = 365
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  return { from, days, key: period }
}

// ============================================================
// GET /api/analytics/provider/overview?period=30d
// ============================================================
export async function providerOverview(req: Request, res: Response) {
  const { from, key } = periodFromQuery(req)
  const cacheKey = `overview:${req.userId}:${key}`
  const cached = cacheGet(cacheKey)
  if (cached) return R.ok(res, cached)

  // 1. Propostas enviadas no período
  const proposalsSent = await prisma.proposal.count({
    where: { provider_id: req.userId, created_at: { gte: from } },
  })
  const proposalsAccepted = await prisma.proposal.count({
    where: { provider_id: req.userId, created_at: { gte: from }, status: 'ACCEPTED' },
  })
  const proposalsRejected = await prisma.proposal.count({
    where: { provider_id: req.userId, created_at: { gte: from }, status: 'REJECTED' },
  })

  // 2. Agendamentos / serviços concluídos
  const schedulesAgg = await prisma.schedule.findMany({
    where: {
      provider_id: req.userId,
      created_at: { gte: from },
      status: { in: ['DONE', 'IN_PROGRESS'] },
    },
    select: { id: true, status: true },
  })

  // 3. Pagamentos liberados (ganhos reais)
  const releasedPayments = await prisma.payment.findMany({
    where: {
      provider_id: req.userId,
      status: 'RELEASED',
      released_at: { gte: from },
    },
    select: { provider_amount: true, platform_fee: true, gateway_fee: true, amount: true },
  })
  const totalEarnings = releasedPayments.reduce((s, p) => s + (p.provider_amount || 0), 0)
  const platformFeesPaid = releasedPayments.reduce((s, p) => s + (p.platform_fee || 0), 0)
  const totalReleased = releasedPayments.length

  // 4. Ticket médio (sobre pagamentos PAID e RELEASED no período)
  const paidPayments = await prisma.payment.findMany({
    where: {
      provider_id: req.userId,
      status: { in: ['PAID', 'RELEASED'] },
      paid_at: { gte: from },
    },
    select: { provider_amount: true },
  })
  const avgTicket = paidPayments.length > 0
    ? paidPayments.reduce((s, p) => s + (p.provider_amount || 0), 0) / paidPayments.length
    : 0

  // 5. Rating global do usuário (não tem histórico por período, mas é current)
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { rating_avg: true, rating_count: true, provider_balance: true },
  })

  // 6. Conversion rate (proposta enviada → aceita)
  const conversionRate = proposalsSent > 0 ? proposalsAccepted / proposalsSent : 0

  // 7. Saldo atual
  const result = {
    period: key,
    proposals_sent: proposalsSent,
    proposals_accepted: proposalsAccepted,
    proposals_rejected: proposalsRejected,
    conversion_rate: Math.round(conversionRate * 1000) / 1000,
    services_done: schedulesAgg.filter((s) => s.status === 'DONE').length,
    services_in_progress: schedulesAgg.filter((s) => s.status === 'IN_PROGRESS').length,
    total_earnings: Math.round(totalEarnings * 100) / 100,
    platform_fees_paid: Math.round(platformFeesPaid * 100) / 100,
    avg_ticket: Math.round(avgTicket * 100) / 100,
    paid_orders_count: paidPayments.length,
    released_orders_count: totalReleased,
    rating_avg: user?.rating_avg ?? 0,
    rating_count: user?.rating_count ?? 0,
    provider_balance: user?.provider_balance ?? 0,
  }
  cacheSet(cacheKey, result)
  return R.ok(res, result)
}

// ============================================================
// GET /api/analytics/provider/earnings-timeseries?period=12m&granularity=month
// Série temporal de ganhos por mês (ou dia)
// ============================================================
export async function providerEarningsTimeseries(req: Request, res: Response) {
  const { from, days, key } = periodFromQuery(req)
  const granularity = String(req.query.granularity ?? (days > 90 ? 'month' : 'day'))
  const cacheKey = `ts:${req.userId}:${key}:${granularity}`
  const cached = cacheGet(cacheKey)
  if (cached) return R.ok(res, cached)

  const payments = await prisma.payment.findMany({
    where: {
      provider_id: req.userId,
      status: { in: ['PAID', 'RELEASED'] },
      paid_at: { gte: from },
    },
    select: { paid_at: true, provider_amount: true },
    orderBy: { paid_at: 'asc' },
  })

  const buckets = new Map<string, number>()
  for (const p of payments) {
    if (!p.paid_at) continue
    const d = p.paid_at
    let key2: string
    if (granularity === 'month') {
      key2 = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    } else {
      key2 = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }
    buckets.set(key2, (buckets.get(key2) ?? 0) + (p.provider_amount || 0))
  }

  // Preenche buckets vazios para gráfico contínuo
  const series: Array<{ period: string; value: number }> = []
  const now = new Date()
  if (granularity === 'month') {
    const months = Math.ceil(days / 30)
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      series.push({ period: k, value: Math.round((buckets.get(k) ?? 0) * 100) / 100 })
    }
  } else {
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      series.push({ period: k, value: Math.round((buckets.get(k) ?? 0) * 100) / 100 })
    }
  }
  cacheSet(cacheKey, series)
  return R.ok(res, series)
}

// ============================================================
// GET /api/analytics/provider/categories — performance por categoria
// ============================================================
export async function providerCategoriesPerformance(req: Request, res: Response) {
  const { from, key } = periodFromQuery(req)
  const cacheKey = `cats:${req.userId}:${key}`
  const cached = cacheGet(cacheKey)
  if (cached) return R.ok(res, cached)

  const proposals = await prisma.proposal.findMany({
    where: { provider_id: req.userId, created_at: { gte: from } },
    select: {
      status: true,
      value: true,
      order: { select: { category: { select: { id: true, name: true, icon: true } } } },
    },
  })

  const byCat = new Map<string, { id: string; name: string; icon: string; sent: number; accepted: number; total_value: number }>()
  for (const p of proposals) {
    const c = p.order.category
    if (!c) continue
    const entry = byCat.get(c.id) || { id: c.id, name: c.name, icon: c.icon, sent: 0, accepted: 0, total_value: 0 }
    entry.sent++
    if (p.status === 'ACCEPTED') {
      entry.accepted++
      entry.total_value += p.value
    }
    byCat.set(c.id, entry)
  }
  const list = Array.from(byCat.values())
    .map((c) => ({
      ...c,
      conversion_rate: c.sent > 0 ? Math.round((c.accepted / c.sent) * 1000) / 1000 : 0,
      total_value: Math.round(c.total_value * 100) / 100,
    }))
    .sort((a, b) => b.total_value - a.total_value)
  cacheSet(cacheKey, list)
  return R.ok(res, list)
}

// ============================================================
// GET /api/analytics/provider/recent — últimos serviços concluídos
// ============================================================
export async function providerRecent(req: Request, res: Response) {
  const limit = Math.min(parseInt(String(req.query.limit ?? '10')) || 10, 50)
  const schedules = await prisma.schedule.findMany({
    where: { provider_id: req.userId },
    orderBy: { created_at: 'desc' },
    take: limit,
    include: {
      order: { select: { id: true, title: true, final_price: true, status: true, category: { select: { name: true, icon: true } } } },
      client: { select: { id: true, name: true, avatar: true } },
    },
  })
  return R.ok(res, schedules)
}
