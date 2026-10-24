// ============================================================
// Painel admin — rastreabilidade.
// Linha do tempo de usuário e de pedido, busca, chat, extrato, acessos,
// webhooks e conciliação. Leitura, exceto: reprocessar webhook, ajuste de
// saldo e estorno de taxa já creditada (motivo obrigatório, tudo auditado).
//
// A linha do tempo junta os eventos de audit_events com o histórico que já
// existia nas tabelas (pedido criado, taxa paga, check-in…) para o período
// anterior à auditoria — assim reclamações antigas também têm resposta.
// ============================================================
import { Request, Response } from 'express'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '../../config/database'
import * as R from '../../utils/response'
import { audit, recordEvent } from './audit.service'
import { creditProviderBalance, debitProviderBalance, reconcileBalances } from './ledger.service'
import { lookupCpf } from '../users/cpfRegistry.service'
import { processMpPayment } from '../payments/payments.controller'
import { applyRevenueCatEvent } from '../verification/pro.service'
import { notify } from '../push/push.service'

type Item = {
  id: string
  at: Date
  type: string
  source: 'audit' | 'history'
  actor_id: string | null
  actor_role: string | null
  user_id: string | null
  counterpart_id: string | null
  order_id: string | null
  entity_type: string | null
  entity_id: string | null
  amount: number | null
  reason: string | null
  before?: unknown
  after?: unknown
  metadata?: unknown
  ip?: string | null
  user_agent?: string | null
  device_id?: string | null
  app_version?: string | null
  request_id?: string | null
}

type AuditRow = Prisma.AuditEventGetPayload<object>

const MAX_TIMELINE = 500
const HISTORY_TAKE = 200

function fromAudit(e: AuditRow): Item {
  return {
    id: e.id,
    at: e.created_at,
    type: e.type,
    source: 'audit',
    actor_id: e.actor_id,
    actor_role: e.actor_role,
    user_id: e.user_id,
    counterpart_id: e.counterpart_id,
    order_id: e.order_id,
    entity_type: e.entity_type,
    entity_id: e.entity_id,
    amount: e.amount,
    reason: e.reason,
    before: e.before,
    after: e.after,
    metadata: e.metadata,
    ip: e.ip,
    user_agent: e.user_agent,
    device_id: e.device_id,
    app_version: e.app_version,
    request_id: e.request_id,
  }
}

function hist(p: Omit<Partial<Item>, 'at'> & { id: string; at: Date | null | undefined; type: string }): Item | null {
  if (!p.at) return null
  return {
    actor_id: null,
    actor_role: null,
    user_id: null,
    counterpart_id: null,
    order_id: null,
    entity_type: null,
    entity_id: null,
    amount: null,
    reason: null,
    ...p,
    at: p.at,
    source: 'history',
  }
}

// Início da auditoria: antes disso a linha do tempo usa o histórico das tabelas
let auditStartCache: Date | null = null
async function auditStart(): Promise<Date> {
  if (auditStartCache) return auditStartCache
  const first = await prisma.auditEvent.findFirst({ orderBy: { created_at: 'asc' }, select: { created_at: true } })
  if (first) auditStartCache = first.created_at
  return first?.created_at ?? new Date()
}

/** Nomes de quem aparece na linha do tempo (autor, titular, contraparte). */
async function withPeople(items: Item[]) {
  const ids = new Set<string>()
  for (const i of items) for (const id of [i.actor_id, i.user_id, i.counterpart_id]) if (id) ids.add(id)
  const users = ids.size
    ? await prisma.user.findMany({ where: { id: { in: [...ids] } }, select: { id: true, name: true, email: true, role: true } })
    : []
  return { items, people: Object.fromEntries(users.map((u) => [u.id, u])) }
}

function mergeSorted(audited: Item[], history: Array<Item | null>, before: Date): Item[] {
  const old = history.filter((h): h is Item => !!h && h.at < before)
  return [...audited, ...old].sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, MAX_TIMELINE)
}

// ---------------------------------------------------------------------------
// GET /api/admin/audit — consulta geral com filtros e paginação por cursor
// ---------------------------------------------------------------------------
const listSchema = z.object({
  type: z.string().max(500).optional(),
  user_id: z.string().uuid().optional(),
  order_id: z.string().uuid().optional(),
  actor_id: z.string().uuid().optional(),
  entity_type: z.string().max(60).optional(),
  entity_id: z.string().max(60).optional(),
  ip: z.string().max(60).optional(),
  device_id: z.string().max(100).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
})

function parseDate(s?: string): Date | undefined {
  if (!s) return undefined
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? undefined : d
}

export async function listAuditEvents(req: Request, res: Response) {
  const parsed = listSchema.safeParse(req.query)
  if (!parsed.success) return R.badRequest(res, 'Filtros inválidos', parsed.error.flatten().fieldErrors)
  const q = parsed.data
  const where: Prisma.AuditEventWhereInput = {}
  const and: Prisma.AuditEventWhereInput[] = []
  if (q.type) where.type = { in: q.type.split(',').map((t) => t.trim()).filter(Boolean) }
  if (q.user_id) and.push({ OR: [{ user_id: q.user_id }, { counterpart_id: q.user_id }, { actor_id: q.user_id }] })
  if (q.order_id) where.order_id = q.order_id
  if (q.actor_id) where.actor_id = q.actor_id
  if (q.entity_type) where.entity_type = q.entity_type
  if (q.entity_id) where.entity_id = q.entity_id
  if (q.ip) where.ip = q.ip
  if (q.device_id) where.device_id = q.device_id
  const from = parseDate(q.from)
  const to = parseDate(q.to)
  if (from || to) where.created_at = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) }
  // Cursor = "<ISO>|<id>" do último item da página anterior
  if (q.cursor) {
    const [iso, id] = q.cursor.split('|')
    const at = parseDate(iso)
    if (at && id) and.push({ OR: [{ created_at: { lt: at } }, { created_at: at, id: { lt: id } }] })
  }
  if (and.length) where.AND = and

  const rows = await prisma.auditEvent.findMany({
    where,
    orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
    take: q.limit + 1,
  })
  const page = rows.slice(0, q.limit)
  const last = page[page.length - 1]
  const next = rows.length > q.limit && last ? `${last.created_at.toISOString()}|${last.id}` : null
  return R.ok(res, { ...(await withPeople(page.map(fromAudit))), next_cursor: next })
}

// GET /api/admin/audit/types — tipos existentes (para o filtro)
export async function listAuditTypes(_req: Request, res: Response) {
  const rows = await prisma.auditEvent.groupBy({ by: ['type'], _count: { type: true }, orderBy: { type: 'asc' } })
  return R.ok(res, rows.map((r) => ({ type: r.type, count: r._count.type })))
}

// ---------------------------------------------------------------------------
// GET /api/admin/audit/search?q= — e-mail, nome, telefone, CPF ou nº do pedido
// ---------------------------------------------------------------------------
export async function searchAudit(req: Request, res: Response) {
  const q = String(req.query.q ?? '').trim()
  if (q.length < 3) return R.badRequest(res, 'Digite ao menos 3 caracteres')
  const digits = q.replace(/\D/g, '')
  const userSelect = {
    id: true, name: true, email: true, phone: true, role: true, is_active: true, banned_at: true,
    created_at: true, is_verified_pro: true,
  } as const

  const userIds = new Set<string>()
  const cpfMatches: Array<{ user_id: string; status: string }> = []
  if (digits.length === 11) {
    for (const c of await lookupCpf(digits)) {
      userIds.add(c.user_id)
      cpfMatches.push({ user_id: c.user_id, status: c.status })
    }
  }
  const or: Prisma.UserWhereInput[] = [
    { email: { contains: q, mode: 'insensitive' } },
    { name: { contains: q, mode: 'insensitive' } },
  ]
  if (digits.length >= 8) or.push({ phone: { contains: digits } })
  if (/^[0-9a-f-]{8,36}$/i.test(q)) or.push({ id: { startsWith: q.toLowerCase() } })

  const [users, byCpf, orders] = await Promise.all([
    prisma.user.findMany({ where: { OR: or }, select: userSelect, take: 20, orderBy: { created_at: 'desc' } }),
    userIds.size ? prisma.user.findMany({ where: { id: { in: [...userIds] } }, select: userSelect }) : Promise.resolve([]),
    /^[0-9a-f-]{6,36}$/i.test(q)
      ? prisma.order.findMany({
          where: { id: { startsWith: q.toLowerCase() } },
          select: { id: true, title: true, status: true, created_at: true, client: { select: { id: true, name: true } } },
          take: 10,
        })
      : prisma.order.findMany({
          where: { title: { contains: q, mode: 'insensitive' } },
          select: { id: true, title: true, status: true, created_at: true, client: { select: { id: true, name: true } } },
          take: 10,
          orderBy: { created_at: 'desc' },
        }),
  ])
  const merged = [...byCpf, ...users.filter((u) => !userIds.has(u.id))]
  return R.ok(res, { users: merged, orders, cpf_matches: cpfMatches })
}

// ---------------------------------------------------------------------------
// GET /api/admin/users/:id/timeline
// ---------------------------------------------------------------------------
export async function userTimeline(req: Request, res: Response) {
  const built = await buildUserTimeline(req.params.id)
  if (!built) return R.notFound(res, 'Usuário não encontrado')
  return R.ok(res, { ...(await withPeople(built.items)), audit_started_at: built.start })
}

async function buildUserTimeline(userId: string): Promise<{ items: Item[]; start: Date } | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, created_at: true, terms_accepted_at: true, terms_version: true, terms_accepted_ip: true,
      document_submitted_at: true, document_reviewed_at: true, document_verification_status: true,
      banned_at: true, ban_reason: true, deletion_requested_at: true,
    },
  })
  if (!user) return null
  const start = await auditStart()
  const old = { lt: start }

  const [events, orders, proposals, fees, schedules, ratings, withdrawals, credits, tickets, pro] = await Promise.all([
    prisma.auditEvent.findMany({
      where: { OR: [{ user_id: userId }, { counterpart_id: userId }, { actor_id: userId }] },
      orderBy: { created_at: 'desc' },
      take: MAX_TIMELINE,
    }),
    prisma.order.findMany({ where: { client_id: userId, created_at: old }, orderBy: { created_at: 'desc' }, take: HISTORY_TAKE,
      select: { id: true, title: true, status: true, created_at: true, cancelled_at: true, cancel_reason: true, cancelled_by: true } }),
    prisma.proposal.findMany({ where: { provider_id: userId, created_at: old }, orderBy: { created_at: 'desc' }, take: HISTORY_TAKE,
      select: { id: true, order_id: true, value: true, status: true, created_at: true, order: { select: { client_id: true } } } }),
    prisma.connectionFee.findMany({ where: { user_id: userId, created_at: old }, orderBy: { created_at: 'desc' }, take: HISTORY_TAKE }),
    prisma.schedule.findMany({ where: { provider_id: userId, created_at: old }, orderBy: { created_at: 'desc' }, take: HISTORY_TAKE,
      select: { id: true, order_id: true, client_id: true, checkin_at: true, done_at: true, status: true } }),
    prisma.rating.findMany({ where: { reviewer_id: userId, created_at: old }, orderBy: { created_at: 'desc' }, take: HISTORY_TAKE,
      select: { id: true, score: true, comment: true, created_at: true, reviewed_id: true, schedule: { select: { order_id: true } } } }),
    prisma.providerWithdrawal.findMany({ where: { provider_id: userId, created_at: old }, orderBy: { created_at: 'desc' }, take: HISTORY_TAKE }),
    prisma.creditTransaction.findMany({ where: { user_id: userId, created_at: old }, orderBy: { created_at: 'desc' }, take: HISTORY_TAKE }),
    prisma.supportTicket.findMany({ where: { user_id: userId, created_at: old }, orderBy: { created_at: 'desc' }, take: HISTORY_TAKE,
      select: { id: true, subject: true, category: true, created_at: true } }),
    prisma.verifiedProSubscription.findMany({ where: { user_id: userId, created_at: old }, orderBy: { created_at: 'desc' }, take: 50 }),
  ])

  const history: Array<Item | null> = [
    hist({ id: `u:${user.id}`, at: user.created_at, type: 'USER_REGISTERED', user_id: userId, actor_id: userId }),
    hist({ id: `t:${user.id}`, at: user.terms_accepted_at, type: 'TERMS_ACCEPTED', user_id: userId, actor_id: userId,
      metadata: { version: user.terms_version }, ip: user.terms_accepted_ip }),
    hist({ id: `k:${user.id}`, at: user.document_submitted_at, type: 'KYC_SUBMITTED', user_id: userId, actor_id: userId }),
    hist({ id: `kr:${user.id}`, at: user.document_reviewed_at, type: 'KYC_REVIEWED', user_id: userId,
      metadata: { status: user.document_verification_status } }),
    hist({ id: `b:${user.id}`, at: user.banned_at, type: 'USER_BANNED', user_id: userId, reason: user.ban_reason }),
    hist({ id: `d:${user.id}`, at: user.deletion_requested_at, type: 'ACCOUNT_DELETION_REQUESTED', user_id: userId, actor_id: userId }),
    ...orders.flatMap((o) => [
      hist({ id: `o:${o.id}`, at: o.created_at, type: 'ORDER_CREATED', user_id: userId, actor_id: userId, order_id: o.id,
        entity_type: 'Order', entity_id: o.id, metadata: { title: o.title } }),
      hist({ id: `oc:${o.id}`, at: o.cancelled_at, type: 'ORDER_CANCELLED', user_id: userId, actor_id: o.cancelled_by, order_id: o.id,
        entity_type: 'Order', entity_id: o.id, reason: o.cancel_reason }),
    ]),
    ...proposals.map((p) => hist({ id: `p:${p.id}`, at: p.created_at, type: 'PROPOSAL_CREATED', user_id: userId, actor_id: userId,
      counterpart_id: p.order.client_id, order_id: p.order_id, entity_type: 'Proposal', entity_id: p.id, amount: p.value,
      metadata: { status_now: p.status } })),
    ...fees.flatMap((f) => feeHistory(f)),
    ...schedules.flatMap((s) => [
      hist({ id: `ci:${s.id}`, at: s.checkin_at, type: 'SERVICE_CHECKIN', user_id: userId, actor_id: userId, counterpart_id: s.client_id,
        order_id: s.order_id, entity_type: 'Schedule', entity_id: s.id }),
      hist({ id: `dn:${s.id}`, at: s.done_at, type: 'SERVICE_COMPLETED_BY_PROVIDER', user_id: userId, actor_id: userId,
        counterpart_id: s.client_id, order_id: s.order_id, entity_type: 'Schedule', entity_id: s.id }),
    ]),
    ...ratings.map((r) => hist({ id: `r:${r.id}`, at: r.created_at, type: 'RATING_CREATED', user_id: userId, actor_id: userId,
      counterpart_id: r.reviewed_id, order_id: r.schedule.order_id, entity_type: 'Rating', entity_id: r.id,
      metadata: { score: r.score, comment: r.comment } })),
    ...withdrawals.flatMap((w) => [
      hist({ id: `w:${w.id}`, at: w.created_at, type: 'WITHDRAWAL_REQUESTED', user_id: userId, actor_id: userId,
        entity_type: 'ProviderWithdrawal', entity_id: w.id, amount: w.amount }),
      hist({ id: `wp:${w.id}`, at: w.processed_at, type: `WITHDRAWAL_${w.status}`, user_id: userId,
        entity_type: 'ProviderWithdrawal', entity_id: w.id, amount: w.amount, reason: w.notes }),
    ]),
    ...credits.map((c) => hist({ id: `cr:${c.id}`, at: c.created_at, type: c.amount >= 0 ? 'CREDIT_ADDED' : 'CREDIT_USED',
      user_id: userId, amount: c.amount, reason: c.reason, entity_type: 'CreditTransaction', entity_id: c.id })),
    ...tickets.map((t) => hist({ id: `tk:${t.id}`, at: t.created_at, type: 'TICKET_CREATED', user_id: userId, actor_id: userId,
      entity_type: 'SupportTicket', entity_id: t.id, metadata: { subject: t.subject, category: t.category } })),
    ...pro.flatMap((s) => [
      hist({ id: `pro:${s.id}`, at: s.created_at, type: 'PRO_GRANTED', user_id: userId, amount: s.monthly_value,
        entity_type: 'VerifiedProSubscription', entity_id: s.id, metadata: { source: s.source, period_end: s.current_period_end } }),
      hist({ id: `proc:${s.id}`, at: s.cancelled_at, type: 'PRO_REVOKED', user_id: userId,
        entity_type: 'VerifiedProSubscription', entity_id: s.id, metadata: { source: s.source } }),
    ]),
  ]

  return { items: mergeSorted(events.map(fromAudit), history, start), start }
}

function feeHistory(f: Prisma.ConnectionFeeGetPayload<object>): Array<Item | null> {
  const base = { user_id: f.user_id, order_id: f.order_id, entity_type: 'ConnectionFee', entity_id: f.id }
  return [
    hist({ ...base, id: `fc:${f.id}`, at: f.created_at, type: 'FEE_CREATED', amount: f.base_amount, metadata: { side: f.side, pct: f.pct_applied } }),
    hist({ ...base, id: `fp:${f.id}`, at: f.paid_at, type: 'FEE_PAID', actor_id: f.user_id, amount: f.gateway_amount || f.base_amount,
      metadata: { side: f.side, method: f.method, credit_used: f.credit_used, mp: f.mp_payment_id } }),
    hist({ ...base, id: `fcr:${f.id}`, at: f.credited_at, type: 'FEE_CREDITED', amount: round2(f.credit_used + f.gateway_amount),
      actor_id: f.admin_reviewer_id, reason: f.credit_reason, metadata: { side: f.side, notes: f.notes } }),
  ]
}

const round2 = (n: number) => Math.round(n * 100) / 100

// ---------------------------------------------------------------------------
// GET /api/admin/orders/:id/timeline
// ---------------------------------------------------------------------------
export async function orderTimeline(req: Request, res: Response) {
  const items = await buildOrderTimeline(req.params.id)
  if (!items) return R.notFound(res, 'Pedido não encontrado')
  return R.ok(res, { ...(await withPeople(items.items)), audit_started_at: items.start })
}

async function buildOrderTimeline(orderId: string): Promise<{ items: Item[]; start: Date } | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      proposals: { include: { boost_purchases: true } },
      connection_fees: true,
      schedule: { include: { ratings: true } },
      payment: true,
      service_photos: true,
    },
  })
  if (!order) return null
  const start = await auditStart()
  const [events, archives] = await Promise.all([
    prisma.auditEvent.findMany({ where: { order_id: orderId }, orderBy: { created_at: 'desc' }, take: MAX_TIMELINE }),
    prisma.scheduleArchive.findMany({ where: { order_id: orderId }, select: { id: true, reason: true, archived_at: true, archived_by: true, provider_id: true } }),
  ])
  const c = order.client_id
  const s = order.schedule
  const history: Array<Item | null> = [
    hist({ id: `o:${order.id}`, at: order.created_at, type: 'ORDER_CREATED', user_id: c, actor_id: c, order_id: order.id,
      entity_type: 'Order', entity_id: order.id, metadata: { title: order.title, city: order.city, location_source: order.location_source } }),
    hist({ id: `oe:${order.id}`, at: order.edited_at, type: 'ORDER_EDITED', user_id: c, actor_id: c, order_id: order.id,
      entity_type: 'Order', entity_id: order.id, metadata: { edit_count: order.edit_count } }),
    hist({ id: `oc:${order.id}`, at: order.cancelled_at, type: 'ORDER_CANCELLED', user_id: c, actor_id: order.cancelled_by,
      order_id: order.id, entity_type: 'Order', entity_id: order.id, reason: order.cancel_reason }),
    ...order.proposals.flatMap((p) => [
      hist({ id: `p:${p.id}`, at: p.created_at, type: 'PROPOSAL_CREATED', user_id: p.provider_id, actor_id: p.provider_id,
        counterpart_id: c, order_id: order.id, entity_type: 'Proposal', entity_id: p.id, amount: p.value, metadata: { status_now: p.status } }),
      ...p.boost_purchases.map((b) => hist({ id: `bo:${b.id}`, at: b.created_at, type: 'PROPOSAL_BOOSTED', user_id: p.provider_id,
        actor_id: p.provider_id, order_id: order.id, entity_type: 'Proposal', entity_id: p.id, amount: b.value,
        metadata: { level: b.level, paid_with: b.payment_ref } })),
    ]),
    ...order.connection_fees.flatMap((f) => feeHistory(f)),
    ...(s
      ? [
          hist({ id: `sc:${s.id}`, at: s.created_at, type: 'PROPOSAL_ACCEPTED', user_id: c, actor_id: c, counterpart_id: s.provider_id,
            order_id: order.id, entity_type: 'Schedule', entity_id: s.id, metadata: { scheduled_at: s.scheduled_at } }),
          hist({ id: `ci:${s.id}`, at: s.checkin_at, type: 'SERVICE_CHECKIN', user_id: s.provider_id, actor_id: s.provider_id,
            counterpart_id: c, order_id: order.id, entity_type: 'Schedule', entity_id: s.id,
            metadata: { lat: s.checkin_lat, lng: s.checkin_lng, address: s.checkin_address } }),
          hist({ id: `dn:${s.id}`, at: s.done_at, type: 'SERVICE_COMPLETED_BY_PROVIDER', user_id: s.provider_id, actor_id: s.provider_id,
            counterpart_id: c, order_id: order.id, entity_type: 'Schedule', entity_id: s.id,
            metadata: { lat: s.complete_lat, lng: s.complete_lng, address: s.complete_address } }),
          ...s.ratings.map((r) => hist({ id: `r:${r.id}`, at: r.created_at, type: 'RATING_CREATED', user_id: r.reviewer_id,
            actor_id: r.reviewer_id, counterpart_id: r.reviewed_id, order_id: order.id, entity_type: 'Rating', entity_id: r.id,
            metadata: { score: r.score, comment: r.comment } })),
        ]
      : []),
    ...(order.payment
      ? [
          hist({ id: `pp:${order.payment.id}`, at: order.payment.paid_at, type: 'PAYMENT_PAID', user_id: c, order_id: order.id,
            entity_type: 'Payment', entity_id: order.payment.id, amount: order.payment.amount }),
          hist({ id: `pr:${order.payment.id}`, at: order.payment.released_at, type: 'PAYMENT_RELEASED', user_id: order.payment.provider_id,
            order_id: order.id, entity_type: 'Payment', entity_id: order.payment.id, amount: order.payment.provider_amount }),
        ]
      : []),
    ...order.service_photos.map((ph) => hist({ id: `ph:${ph.id}`, at: ph.created_at, type: `PHOTO_${ph.stage}`,
      user_id: ph.uploaded_by, actor_id: ph.uploaded_by, order_id: order.id, entity_type: 'OrderPhoto', entity_id: ph.id })),
    ...archives.map((a) => hist({ id: `ar:${a.id}`, at: a.archived_at, type: 'SCHEDULE_ARCHIVED', user_id: c, actor_id: a.archived_by,
      counterpart_id: a.provider_id, order_id: order.id, entity_type: 'ScheduleArchive', entity_id: a.id, reason: a.reason })),
  ]
  return { items: mergeSorted(events.map(fromAudit), history, start), start }
}

// ---------------------------------------------------------------------------
// GET /api/admin/orders/:id — tudo do pedido para o suporte
// ---------------------------------------------------------------------------
export async function orderDetails(req: Request, res: Response) {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: {
      category: { select: { id: true, name: true, slug: true, icon: true } },
      client: { select: { id: true, name: true, email: true, phone: true, is_verified_pro: true, banned_at: true, is_active: true } },
      proposals: {
        orderBy: { created_at: 'asc' },
        include: { provider: { select: { id: true, name: true, email: true, phone: true } }, boost_purchases: true },
      },
      connection_fees: { orderBy: { created_at: 'asc' } },
      schedule: {
        include: {
          provider: { select: { id: true, name: true, email: true, phone: true } },
          ratings: true,
          _count: { select: { messages: true } },
        },
      },
      payment: true,
      service_photos: { orderBy: { created_at: 'asc' } },
    },
  })
  if (!order) return R.notFound(res, 'Pedido não encontrado')
  const archives = await prisma.scheduleArchive.findMany({
    where: { order_id: order.id },
    select: { id: true, reason: true, archived_at: true, archived_by: true, provider_id: true, client_id: true },
    orderBy: { archived_at: 'asc' },
  })
  return R.ok(res, { ...order, archives })
}

// ---------------------------------------------------------------------------
// GET /api/admin/orders/:id/chat — conversa atual + conversas arquivadas.
// Abrir o chat fica registrado (privacidade das partes).
// ---------------------------------------------------------------------------
export async function orderChat(req: Request, res: Response) {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    select: { id: true, client_id: true, schedule: { select: { id: true, provider_id: true } } },
  })
  if (!order) return R.notFound(res, 'Pedido não encontrado')
  const reason = typeof req.query.reason === 'string' ? req.query.reason.slice(0, 300) : null

  const current = order.schedule
    ? await prisma.message.findMany({
        where: { schedule_id: order.schedule.id },
        orderBy: { created_at: 'asc' },
        take: 2000,
        select: { id: true, sender_id: true, content: true, photo_url: true, is_read: true, created_at: true },
      })
    : []
  const archives = await prisma.scheduleArchive.findMany({
    where: { order_id: order.id },
    orderBy: { archived_at: 'asc' },
    select: { id: true, reason: true, archived_at: true, provider_id: true, snapshot: true },
  })
  const archived = archives.map((a) => {
    const snap = (a.snapshot ?? {}) as { messages?: Array<Record<string, unknown>> }
    return {
      archive_id: a.id,
      reason: a.reason,
      archived_at: a.archived_at,
      provider_id: a.provider_id,
      messages: (snap.messages ?? []).map((m) => ({
        id: m.id, sender_id: m.sender_id, content: m.content, photo_url: m.photo_url, created_at: m.created_at,
      })),
    }
  })
  const ids = new Set<string>([order.client_id])
  if (order.schedule) ids.add(order.schedule.provider_id)
  for (const a of archived) ids.add(a.provider_id)
  const people = await prisma.user.findMany({ where: { id: { in: [...ids] } }, select: { id: true, name: true, role: true } })

  audit({
    type: 'ADMIN_VIEWED_CHAT', userId: order.client_id, counterpartId: order.schedule?.provider_id ?? null,
    orderId: order.id, entityType: 'Order', entityId: order.id, reason,
    metadata: { messages: current.length, archived: archived.length },
  })
  return R.ok(res, { current, archived, people: Object.fromEntries(people.map((p) => [p.id, p])) })
}

// ---------------------------------------------------------------------------
// GET /api/admin/users/:id/access-logs
// ---------------------------------------------------------------------------
export async function userAccessLogs(req: Request, res: Response) {
  const limit = Math.min(Math.max(Number(req.query.limit ?? 100) || 100, 1), 500)
  const rows = await prisma.accessLog.findMany({
    where: { user_id: req.params.id },
    orderBy: { created_at: 'desc' },
    take: limit,
  })
  // Aparelhos/IPs distintos ajudam a detectar conta compartilhada ou invadida
  const devices = await prisma.accessLog.groupBy({
    by: ['device_id'],
    where: { user_id: req.params.id, device_id: { not: null } },
    _count: { device_id: true },
    _max: { created_at: true },
  })
  return R.ok(res, {
    items: rows,
    devices: devices.map((d) => ({ device_id: d.device_id, count: d._count.device_id, last_seen: d._max.created_at })),
  })
}

// ---------------------------------------------------------------------------
// GET /api/admin/users/:id/ledger — saldo do prestador + crédito do cliente
// ---------------------------------------------------------------------------
export async function userLedger(req: Request, res: Response) {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: { id: true, provider_balance: true, credit_balance: true },
  })
  if (!user) return R.notFound(res, 'Usuário não encontrado')
  const [balance, credits, withdrawals, fees, sum] = await Promise.all([
    prisma.providerBalanceTransaction.findMany({ where: { user_id: user.id }, orderBy: { created_at: 'desc' }, take: 300 }),
    prisma.creditTransaction.findMany({ where: { user_id: user.id }, orderBy: { created_at: 'desc' }, take: 300 }),
    prisma.providerWithdrawal.findMany({ where: { provider_id: user.id }, orderBy: { created_at: 'desc' }, take: 100 }),
    prisma.connectionFee.findMany({
      where: { user_id: user.id },
      orderBy: { created_at: 'desc' },
      take: 200,
      include: { order: { select: { id: true, title: true, status: true } } },
    }),
    prisma.providerBalanceTransaction.aggregate({ where: { user_id: user.id }, _sum: { amount: true } }),
  ])
  const ledgerTotal = round2(sum._sum.amount ?? 0)
  return R.ok(res, {
    provider_balance: user.provider_balance,
    credit_balance: user.credit_balance,
    ledger_total: ledgerTotal,
    ledger_matches: Math.abs(ledgerTotal - user.provider_balance) < 0.01,
    balance_transactions: balance,
    credit_transactions: credits,
    withdrawals: withdrawals.map((w) => ({ ...w, pix_key: w.pix_key.length > 6 ? `${w.pix_key.slice(0, 3)}***${w.pix_key.slice(-2)}` : '***' })),
    fees,
  })
}

// ---------------------------------------------------------------------------
// POST /api/admin/users/:id/balance-adjust — ajuste manual (reembolso/correção)
// kind=PROVIDER mexe no saldo sacável do prestador; kind=CREDIT no crédito
// da plataforma (abatido em taxas). Motivo obrigatório; vira extrato + auditoria.
// ---------------------------------------------------------------------------
const adjustSchema = z.object({
  kind: z.enum(['PROVIDER', 'CREDIT']),
  amount: z.number().refine((n) => n !== 0 && Math.abs(n) <= 5000, 'Valor entre -5000 e 5000, diferente de zero'),
  reason: z.string().trim().min(5, 'Informe o motivo (mínimo 5 caracteres)').max(500),
  order_id: z.string().uuid().optional().nullable(),
  notify_user: z.boolean().optional().default(true),
})

export async function adjustBalance(req: Request, res: Response) {
  const parsed = adjustSchema.safeParse(req.body ?? {})
  if (!parsed.success) return R.badRequest(res, parsed.error.errors[0]?.message ?? 'Dados inválidos')
  const { kind, reason, order_id, notify_user } = parsed.data
  const amount = round2(parsed.data.amount)
  const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true, provider_balance: true, credit_balance: true } })
  if (!user) return R.notFound(res, 'Usuário não encontrado')

  const ok = await prisma.$transaction(async (tx) => {
    if (kind === 'PROVIDER') {
      const entry = { userId: user.id, reason: 'ADMIN_ADJUSTMENT', refType: 'Admin', refId: req.userId, orderId: order_id ?? null, note: reason }
      if (amount > 0) {
        await creditProviderBalance(tx, { ...entry, amount })
        return true
      }
      return debitProviderBalance(tx, { ...entry, amount: -amount })
    }
    if (amount < 0) {
      const moved = await tx.user.updateMany({
        where: { id: user.id, credit_balance: { gte: -amount } },
        data: { credit_balance: { decrement: -amount } },
      })
      if (moved.count === 0) return false
    } else {
      await tx.user.update({ where: { id: user.id }, data: { credit_balance: { increment: amount } } })
    }
    await tx.creditTransaction.create({ data: { user_id: user.id, amount, reason: 'ADMIN_ADJUSTMENT', ref_id: order_id ?? null } })
    await recordEvent(
      {
        type: amount > 0 ? 'CREDIT_ADJUSTED_UP' : 'CREDIT_ADJUSTED_DOWN', userId: user.id, orderId: order_id ?? null,
        entityType: 'User', entityId: user.id, amount, reason, before: { credit_balance: user.credit_balance },
      },
      tx,
    )
    return true
  })
  if (!ok) return R.conflict(res, 'Saldo insuficiente para este débito')
  if (kind === 'PROVIDER') {
    audit({ type: 'BALANCE_ADJUSTED_BY_ADMIN', userId: user.id, orderId: order_id ?? null, entityType: 'User', entityId: user.id, amount, reason })
  }
  if (notify_user) {
    const what = kind === 'PROVIDER' ? 'saldo' : 'crédito'
    await notify(user.id, {
      type: 'GENERAL',
      title: amount > 0 ? `Ajuste no seu ${what}: +R$ ${amount.toFixed(2)}` : `Ajuste no seu ${what}: -R$ ${(-amount).toFixed(2)}`,
      body: `Motivo: ${reason}`,
      data: order_id ? { order_id } : {},
      channel: 'payment',
    }).catch(() => {})
  }
  return R.ok(res, null, 'Ajuste registrado')
}

// ---------------------------------------------------------------------------
// POST /api/admin/fees/:id/refund-credited — taxa que já voltou como crédito,
// mas o usuário pediu o dinheiro de volta: retira o crédito/saldo e marca como
// estornada (o estorno bancário é feito no painel do Mercado Pago).
// ---------------------------------------------------------------------------
export async function refundCreditedFee(req: Request, res: Response) {
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : ''
  if (reason.length < 5) return R.badRequest(res, 'Informe o motivo (mínimo 5 caracteres)')
  const fee = await prisma.connectionFee.findUnique({ where: { id: req.params.id } })
  if (!fee) return R.notFound(res, 'Taxa não encontrada')
  if (fee.status !== 'CREDITED') return R.badRequest(res, `Só taxas devolvidas como crédito usam este caminho (status: ${fee.status})`)
  const value = round2(fee.credit_used + fee.gateway_amount)

  const result = await prisma.$transaction(async (tx) => {
    const marked = await tx.connectionFee.updateMany({
      where: { id: fee.id, status: 'CREDITED' },
      data: { status: 'REFUNDED', admin_reviewer_id: req.userId, notes: reason },
    })
    if (marked.count === 0) return 'CHANGED' as const
    if (value > 0) {
      if (fee.side === 'CLIENT') {
        const moved = await tx.user.updateMany({
          where: { id: fee.user_id, credit_balance: { gte: value } },
          data: { credit_balance: { decrement: value } },
        })
        if (moved.count === 0) throw new Error('CREDIT_ALREADY_USED')
        await tx.creditTransaction.create({ data: { user_id: fee.user_id, amount: -value, reason: 'FEE_CREDIT_REVERSED', ref_id: fee.id } })
      } else {
        const debited = await debitProviderBalance(tx, {
          userId: fee.user_id, amount: value, reason: 'ADMIN_REVERSAL', refType: 'ConnectionFee', refId: fee.id,
          orderId: fee.order_id, note: `Crédito da taxa estornado em dinheiro: ${reason}`,
        })
        if (!debited) throw new Error('CREDIT_ALREADY_USED')
      }
    }
    await recordEvent(
      {
        type: 'FEE_CREDIT_REVERSED', userId: fee.user_id, orderId: fee.order_id, entityType: 'ConnectionFee', entityId: fee.id,
        amount: value, reason, before: { status: 'CREDITED' }, after: { status: 'REFUNDED' }, metadata: { side: fee.side },
      },
      tx,
    )
    return 'OK' as const
  }).catch((err: Error) => (err.message === 'CREDIT_ALREADY_USED' ? ('USED' as const) : Promise.reject(err)))

  if (result === 'CHANGED') return R.conflict(res, 'A taxa mudou de estado. Atualize e tente novamente.')
  if (result === 'USED') {
    return R.conflict(res, 'O usuário já usou parte desse crédito. Ajuste o saldo manualmente antes de estornar em dinheiro.')
  }
  return R.ok(res, { value }, `Crédito de R$ ${value.toFixed(2)} retirado. Faça o estorno bancário no painel do Mercado Pago.`)
}

// ---------------------------------------------------------------------------
// Webhooks recebidos (Mercado Pago, RevenueCat)
// ---------------------------------------------------------------------------
export async function listWebhooks(req: Request, res: Response) {
  const where: Prisma.WebhookEventWhereInput = {}
  if (typeof req.query.provider === 'string' && req.query.provider) where.provider = req.query.provider
  if (typeof req.query.status === 'string' && req.query.status) where.status = req.query.status
  if (typeof req.query.user_id === 'string' && req.query.user_id) where.user_id = req.query.user_id
  if (typeof req.query.q === 'string' && req.query.q.trim()) where.external_id = { contains: req.query.q.trim() }
  const limit = Math.min(Math.max(Number(req.query.limit ?? 50) || 50, 1), 200)
  const [items, counts] = await Promise.all([
    prisma.webhookEvent.findMany({
      where,
      orderBy: { received_at: 'desc' },
      take: limit,
      select: {
        id: true, provider: true, external_id: true, event_type: true, user_id: true, status: true, error: true,
        attempts: true, received_at: true, processed_at: true,
      },
    }),
    prisma.webhookEvent.groupBy({ by: ['provider', 'status'], _count: { status: true } }),
  ])
  return R.ok(res, { items, counts: counts.map((c) => ({ provider: c.provider, status: c.status, count: c._count.status })) })
}

export async function getWebhook(req: Request, res: Response) {
  const item = await prisma.webhookEvent.findUnique({ where: { id: req.params.id } })
  if (!item) return R.notFound(res, 'Evento não encontrado')
  return R.ok(res, item)
}

// POST /api/admin/webhooks/:id/replay — reprocessa (idempotente: não credita 2×)
export async function replayWebhook(req: Request, res: Response) {
  const item = await prisma.webhookEvent.findUnique({ where: { id: req.params.id } })
  if (!item) return R.notFound(res, 'Evento não encontrado')
  try {
    let status: string
    if (item.provider === 'MERCADOPAGO') {
      const payload = item.payload as { payment?: { id?: string }; notification?: unknown }
      const mpId = payload?.payment?.id ?? item.external_id.split(':')[1]
      if (!mpId) return R.badRequest(res, 'Evento sem id de pagamento')
      status = await processMpPayment(String(mpId), payload?.notification ?? null, { force: true })
    } else if (item.provider === 'REVENUECAT') {
      const payload = item.payload as { event?: Parameters<typeof applyRevenueCatEvent>[0] }
      if (!payload?.event) return R.badRequest(res, 'Evento sem conteúdo')
      const result = await applyRevenueCatEvent(payload.event)
      await prisma.webhookEvent.update({
        where: { id: item.id },
        data: { status: result.status, error: result.note ?? null, attempts: { increment: 1 }, processed_at: new Date() },
      })
      status = result.status
    } else {
      return R.badRequest(res, 'Provedor desconhecido')
    }
    audit({
      type: 'WEBHOOK_REPLAYED', userId: item.user_id, entityType: 'WebhookEvent', entityId: item.id,
      before: { status: item.status }, after: { status }, metadata: { provider: item.provider, external_id: item.external_id },
    })
    return R.ok(res, { status }, status === 'DUPLICATE' ? 'Já estava processado' : `Reprocessado: ${status}`)
  } catch (err) {
    audit({
      type: 'WEBHOOK_REPLAY_FAILED', userId: item.user_id, entityType: 'WebhookEvent', entityId: item.id,
      reason: String((err as Error)?.message ?? err).slice(0, 300),
    })
    return R.serverError(res, `Falha ao reprocessar: ${(err as Error)?.message ?? 'erro'}`)
  }
}

// ---------------------------------------------------------------------------
// GET /api/admin/reconciliation — o que precisa de atenção do financeiro
// ---------------------------------------------------------------------------
export async function reconciliation(_req: Request, res: Response) {
  const dayAgo = new Date(Date.now() - 24 * 3600_000)
  const [balanceMismatch, failedWebhooks, stuckFees, reversed, pendingWithdrawals, unlockedWithoutFee] = await Promise.all([
    reconcileBalances(200),
    prisma.webhookEvent.findMany({
      where: { status: { in: ['FAILED', 'RECEIVED'] }, received_at: { lt: new Date(Date.now() - 10 * 60_000) } },
      orderBy: { received_at: 'desc' },
      take: 100,
      select: { id: true, provider: true, external_id: true, event_type: true, status: true, error: true, received_at: true, attempts: true },
    }),
    // Taxa paga há mais de 24 h com o pedido ainda aguardando a outra parte
    prisma.connectionFee.findMany({
      where: { status: { in: ['PAID', 'COVERED'] }, paid_at: { lt: dayAgo }, order: { status: 'ACCEPTED' } },
      take: 100,
      select: { id: true, side: true, user_id: true, order_id: true, gateway_amount: true, paid_at: true },
    }),
    prisma.auditEvent.findMany({
      where: { type: 'FEE_REVERSED_BY_GATEWAY' },
      orderBy: { created_at: 'desc' },
      take: 50,
    }),
    prisma.providerWithdrawal.findMany({
      where: { status: { in: ['REQUESTED', 'PROCESSING'] } },
      orderBy: { created_at: 'asc' },
      take: 100,
      select: { id: true, provider_id: true, amount: true, status: true, created_at: true },
    }),
    // Contato liberado sem a taxa do prestador (não deveria existir desde a Fase 1)
    prisma.order.findMany({
      where: { status: { in: ['SCHEDULED', 'IN_PROGRESS', 'DONE', 'RATED'] }, provider_fee_paid_at: null, payment: null },
      take: 100,
      select: { id: true, title: true, status: true, client_id: true, created_at: true },
    }),
  ])
  return R.ok(res, {
    balance_mismatch: balanceMismatch,
    failed_webhooks: failedWebhooks,
    stuck_fees: stuckFees,
    gateway_reversals: reversed.map(fromAudit),
    pending_withdrawals: pendingWithdrawals,
    unlocked_without_fee: unlockedWithoutFee,
  })
}

// ---------------------------------------------------------------------------
// Dossiê CSV (para responder reclamação / Procon / chargeback)
// ---------------------------------------------------------------------------
function csvCell(v: unknown): string {
  if (v === null || v === undefined) return ''
  let s = typeof v === 'string' ? v : v instanceof Date ? v.toISOString() : JSON.stringify(v)
  // Evita fórmula ao abrir no Excel/Sheets
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return `"${s.replace(/"/g, '""')}"`
}

const brDate = (d: Date) =>
  d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'medium' })

function toCsv(items: Item[], people: Record<string, { name: string; email: string }>): string {
  const name = (id: string | null) => (id ? (people[id] ? `${people[id].name} <${people[id].email}>` : id) : '')
  const header = ['data_hora', 'evento', 'origem', 'autor', 'papel', 'titular', 'contraparte', 'pedido', 'valor', 'motivo', 'ip', 'aparelho', 'versao_app', 'antes', 'depois', 'detalhes']
  const lines = items.map((i) =>
    [
      brDate(i.at), i.type, i.source === 'audit' ? 'registro' : 'histórico', name(i.actor_id), i.actor_role ?? '', name(i.user_id),
      name(i.counterpart_id), i.order_id ?? '', i.amount ?? '', i.reason ?? '', i.ip ?? '', i.device_id ?? '', i.app_version ?? '',
      i.before ?? '', i.after ?? '', i.metadata ?? '',
    ].map(csvCell).join(';'),
  )
  return `﻿${header.join(';')}\n${lines.join('\n')}\n`
}

export async function orderDossier(req: Request, res: Response) {
  const built = await buildOrderTimeline(req.params.id)
  if (!built) return R.notFound(res, 'Pedido não encontrado')
  const { people } = await withPeople(built.items)
  audit({ type: 'ADMIN_EXPORTED_DOSSIER', orderId: req.params.id, entityType: 'Order', entityId: req.params.id })
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="pedido-${req.params.id.slice(0, 8)}.csv"`)
  res.setHeader('Cache-Control', 'private, no-store')
  return res.send(toCsv([...built.items].reverse(), people))
}

export async function userDossier(req: Request, res: Response) {
  const built = await buildUserTimeline(req.params.id)
  if (!built) return R.notFound(res, 'Usuário não encontrado')
  const { people } = await withPeople(built.items)
  audit({ type: 'ADMIN_EXPORTED_DOSSIER', userId: req.params.id, entityType: 'User', entityId: req.params.id })
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="usuario-${req.params.id.slice(0, 8)}.csv"`)
  res.setHeader('Cache-Control', 'private, no-store')
  return res.send(toCsv([...built.items].reverse(), people))
}
