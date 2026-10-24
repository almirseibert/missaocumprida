// ============================================================
// Assinatura Pro (Selo Verificado Pro) — Google Play Billing via RevenueCat.
// Fonte de verdade: a loja. O backend recebe os eventos pelo webhook e pode
// confirmar o estado direto na API REST da RevenueCat (sync), sem confiar no
// que o aparelho diz.
// ============================================================
import { prisma } from '../../config/database'
import { env } from '../../config/env'
import { notify } from '../push/push.service'
import { getSettings } from '../settings/settings.service'
import { audit } from '../audit/audit.service'

export type ProSource = 'PLAY' | 'ADMIN'

type GrantArgs = {
  userId: string
  periodEnd: Date
  source: ProSource
  productId?: string | null
  transactionId?: string | null
  environment?: string | null
  willRenew?: boolean
  eventType?: string | null
  eventAt?: Date | null
  grantedBy?: string | null
  grantReason?: string | null
}

/** Concede/renova o selo e mantém UMA assinatura ativa por usuário e origem. */
export async function grantPro(a: GrantArgs): Promise<{ firstTime: boolean }> {
  const { monthly_value } = await getProPrice()
  return prisma.$transaction(async (tx) => {
    const existing = await tx.verifiedProSubscription.findFirst({
      where: { user_id: a.userId, status: { in: ['ACTIVE', 'PAST_DUE'] }, source: a.source },
      orderBy: { created_at: 'desc' },
    })
    const data = {
      status: 'ACTIVE' as const,
      current_period_end: a.periodEnd,
      product_id: a.productId ?? existing?.product_id ?? null,
      store_transaction_id: a.transactionId ?? existing?.store_transaction_id ?? null,
      environment: a.environment ?? existing?.environment ?? null,
      will_renew: a.willRenew ?? true,
      billing_issue_at: null,
      last_event_type: a.eventType ?? null,
      last_event_at: a.eventAt ?? new Date(),
      ...(a.source === 'ADMIN' ? { granted_by: a.grantedBy ?? null, grant_reason: a.grantReason ?? null } : {}),
    }
    if (existing) {
      await tx.verifiedProSubscription.update({ where: { id: existing.id }, data })
    } else {
      await tx.verifiedProSubscription.create({
        data: { ...data, user_id: a.userId, source: a.source, monthly_value: a.source === 'ADMIN' ? 0 : monthly_value },
      })
    }
    const user = await tx.user.findUnique({
      where: { id: a.userId },
      select: { is_verified_pro: true, verified_pro_since: true, verified_pro_expires: true },
    })
    const latestEnd =
      user?.is_verified_pro && user.verified_pro_expires && user.verified_pro_expires > a.periodEnd
        ? user.verified_pro_expires
        : a.periodEnd
    await tx.user.update({
      where: { id: a.userId },
      data: {
        is_verified_pro: true,
        // Mantém a data original nas renovações
        verified_pro_since: user?.is_verified_pro && user.verified_pro_since ? user.verified_pro_since : new Date(),
        verified_pro_expires: latestEnd,
      },
    })
    return { firstTime: !user?.is_verified_pro }
  }).then((r) => {
    audit({
      type: 'PRO_GRANTED',
      userId: a.userId,
      entityType: 'VerifiedProSubscription',
      amount: a.source === 'PLAY' ? monthly_value : 0,
      reason: a.grantReason ?? null,
      actorRole: a.source === 'ADMIN' ? undefined : a.eventType === 'SYNC' ? 'SYSTEM' : 'WEBHOOK',
      metadata: { source: a.source, event: a.eventType, period_end: a.periodEnd, product: a.productId, environment: a.environment },
    })
    return r
  })
}

/**
 * Encerra a assinatura de uma origem (ou todas). O selo só sai se não
 * sobrar outra assinatura ativa (ex.: concedida pelo admin).
 */
export async function revokePro(userId: string, opts: { source?: ProSource; eventType?: string } = {}): Promise<void> {
  audit({
    type: 'PRO_REVOKED',
    userId,
    entityType: 'VerifiedProSubscription',
    actorRole: opts.eventType?.startsWith('ADMIN') ? undefined : opts.eventType === 'EXPIRED_BY_CRON' ? 'SYSTEM' : 'WEBHOOK',
    metadata: { source: opts.source ?? 'ALL', event: opts.eventType ?? null },
  })
  await prisma.$transaction(async (tx) => {
    await tx.verifiedProSubscription.updateMany({
      where: { user_id: userId, status: { in: ['ACTIVE', 'PAST_DUE'] }, ...(opts.source ? { source: opts.source } : {}) },
      data: { status: 'CANCELLED', cancelled_at: new Date(), will_renew: false, last_event_type: opts.eventType ?? null, last_event_at: new Date() },
    })
    const remaining = await tx.verifiedProSubscription.findFirst({
      where: { user_id: userId, status: { in: ['ACTIVE', 'PAST_DUE'] }, current_period_end: { gt: new Date() } },
      orderBy: { current_period_end: 'desc' },
    })
    await tx.user.updateMany({
      where: { id: userId },
      data: remaining
        ? { is_verified_pro: true, verified_pro_expires: remaining.current_period_end }
        : { is_verified_pro: false, verified_pro_expires: new Date() },
    })
  })
}

export async function getProPrice(): Promise<{ monthly_value: number }> {
  const s = await getSettings()
  return { monthly_value: s.pro_monthly_price }
}

// ---------------------------------------------------------------------------
// Webhook da RevenueCat
// ---------------------------------------------------------------------------
export type RcEvent = {
  id?: string
  type?: string
  app_user_id?: string
  original_app_user_id?: string
  aliases?: string[]
  expiration_at_ms?: number | null
  event_timestamp_ms?: number
  product_id?: string
  transaction_id?: string
  environment?: 'SANDBOX' | 'PRODUCTION'
  cancel_reason?: string
  transferred_from?: string[]
  transferred_to?: string[]
}

const GRANT_EVENTS = new Set(['INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION', 'PRODUCT_CHANGE', 'NON_RENEWING_PURCHASE'])

/** Aplica um evento. Devolve o que foi feito (para o registro do webhook). */
export async function applyRevenueCatEvent(event: RcEvent): Promise<{ status: 'PROCESSED' | 'IGNORED'; note?: string; userId?: string }> {
  const type = event.type ?? ''
  if (type === 'TEST') return { status: 'IGNORED', note: 'evento de teste' }
  if (event.environment === 'SANDBOX' && !env.RC_ALLOW_SANDBOX) {
    return { status: 'IGNORED', note: 'sandbox desativado (RC_ALLOW_SANDBOX=false)' }
  }

  // "Restaurar compras" em outra conta move a assinatura: o selo sai da conta antiga
  if (type === 'TRANSFER') {
    for (const fromId of event.transferred_from ?? []) {
      if (!fromId.startsWith('$RCAnonymousID')) await revokePro(fromId, { source: 'PLAY', eventType: type })
    }
    return { status: 'PROCESSED', note: 'transfer' }
  }

  const candidates = [event.app_user_id, event.original_app_user_id, ...(event.aliases ?? [])].filter(
    (id): id is string => !!id && !id.startsWith('$RCAnonymousID'),
  )
  const user = candidates.length
    ? await prisma.user.findFirst({ where: { id: { in: candidates } }, select: { id: true } })
    : null
  if (!user) return { status: 'IGNORED', note: 'usuário não encontrado' }
  const userId = user.id

  // Evento mais antigo que o último aplicado (entrega fora de ordem) não volta o estado
  const eventAt = event.event_timestamp_ms ? new Date(event.event_timestamp_ms) : new Date()
  const current = await prisma.verifiedProSubscription.findFirst({
    where: { user_id: userId, source: 'PLAY' },
    orderBy: { created_at: 'desc' },
  })
  if (current?.last_event_at && current.last_event_at > eventAt && type !== 'EXPIRATION') {
    return { status: 'IGNORED', note: 'evento fora de ordem', userId }
  }

  if (GRANT_EVENTS.has(type)) {
    const periodEnd = event.expiration_at_ms
      ? new Date(event.expiration_at_ms)
      : (() => { const d = new Date(); d.setMonth(d.getMonth() + 1); return d })()
    const { firstTime } = await grantPro({
      userId,
      periodEnd,
      source: 'PLAY',
      productId: event.product_id,
      transactionId: event.transaction_id,
      environment: event.environment ?? null,
      willRenew: type !== 'NON_RENEWING_PURCHASE',
      eventType: type,
      eventAt,
    })
    if (firstTime || type === 'INITIAL_PURCHASE') {
      await notify(userId, {
        type: 'VERIFIED_PRO',
        title: 'Assinatura Pro ativa ✓',
        body: 'Sua assinatura foi confirmada. Aproveite os benefícios!',
        data: {},
        channel: 'general',
      }).catch(() => {})
    }
    return { status: 'PROCESSED', userId }
  }

  if (type === 'CANCELLATION') {
    // Renovação automática desligada: o selo fica até o fim do período pago.
    // Reembolso pelo suporte da loja encerra na hora.
    if (event.cancel_reason === 'CUSTOMER_SUPPORT') {
      await revokePro(userId, { source: 'PLAY', eventType: type })
      return { status: 'PROCESSED', note: 'reembolsado', userId }
    }
    await prisma.verifiedProSubscription.updateMany({
      where: { user_id: userId, source: 'PLAY', status: { in: ['ACTIVE', 'PAST_DUE'] } },
      data: { will_renew: false, last_event_type: type, last_event_at: eventAt },
    })
    return { status: 'PROCESSED', userId }
  }

  if (type === 'BILLING_ISSUE') {
    // Problema no pagamento: a loja tenta de novo durante o período de carência
    await prisma.verifiedProSubscription.updateMany({
      where: { user_id: userId, source: 'PLAY', status: 'ACTIVE' },
      data: { status: 'PAST_DUE', billing_issue_at: eventAt, last_event_type: type, last_event_at: eventAt },
    })
    return { status: 'PROCESSED', userId }
  }

  if (type === 'EXPIRATION' || type === 'SUBSCRIPTION_PAUSED') {
    await revokePro(userId, { source: 'PLAY', eventType: type })
    return { status: 'PROCESSED', userId }
  }

  return { status: 'IGNORED', note: `tipo ${type} sem ação`, userId }
}

// ---------------------------------------------------------------------------
// Sincronização direta com a RevenueCat (não confia no aparelho)
// ---------------------------------------------------------------------------
export async function syncFromRevenueCat(userId: string): Promise<{ synced: boolean; active: boolean }> {
  if (!env.REVENUECAT_SECRET_API_KEY) return { synced: false, active: false }
  const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, {
    headers: { Authorization: `Bearer ${env.REVENUECAT_SECRET_API_KEY}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`RevenueCat HTTP ${res.status}`)
  const body: any = await res.json()
  const ent = body?.subscriber?.entitlements?.[env.REVENUECAT_ENTITLEMENT]
  const expires = ent?.expires_date ? new Date(ent.expires_date) : null
  const productId: string | undefined = ent?.product_identifier
  const sub = productId ? body?.subscriber?.subscriptions?.[productId] : null
  const isSandbox = !!sub?.is_sandbox
  if (isSandbox && !env.RC_ALLOW_SANDBOX) return { synced: true, active: false }

  if (ent && (!expires || expires > new Date())) {
    await grantPro({
      userId,
      periodEnd: expires ?? (() => { const d = new Date(); d.setFullYear(d.getFullYear() + 10); return d })(),
      source: 'PLAY',
      productId,
      transactionId: sub?.store_transaction_id ?? null,
      environment: isSandbox ? 'SANDBOX' : 'PRODUCTION',
      willRenew: !sub?.unsubscribe_detected_at,
      eventType: 'SYNC',
    })
    if (sub?.billing_issues_detected_at) {
      await prisma.verifiedProSubscription.updateMany({
        where: { user_id: userId, source: 'PLAY', status: 'ACTIVE' },
        data: { status: 'PAST_DUE', billing_issue_at: new Date(sub.billing_issues_detected_at) },
      })
    }
    return { synced: true, active: true }
  }
  const hadPlay = await prisma.verifiedProSubscription.count({
    where: { user_id: userId, source: 'PLAY', status: { in: ['ACTIVE', 'PAST_DUE'] } },
  })
  if (hadPlay) await revokePro(userId, { source: 'PLAY', eventType: 'SYNC' })
  return { synced: true, active: false }
}

// ---------------------------------------------------------------------------
// Cron: encerra selos vencidos (webhook perdido, concessão do admin expirada)
// ---------------------------------------------------------------------------
const EXPIRY_GRACE_MS = 24 * 60 * 60 * 1000

export async function expireOverduePro(): Promise<{ expired: number }> {
  const limit = new Date(Date.now() - EXPIRY_GRACE_MS)
  const overdue = await prisma.verifiedProSubscription.findMany({
    where: { status: { in: ['ACTIVE', 'PAST_DUE'] }, current_period_end: { lt: limit } },
    select: { user_id: true, source: true },
    take: 500,
  })
  for (const s of overdue) {
    await revokePro(s.user_id, { source: s.source as ProSource, eventType: 'EXPIRED_BY_CRON' })
  }
  // Usuário marcado como Pro sem nenhuma assinatura vigente
  const orphans = await prisma.user.findMany({
    where: {
      is_verified_pro: true,
      verified_pro_expires: { lt: limit },
      verified_pro_subs: { none: { status: { in: ['ACTIVE', 'PAST_DUE'] }, current_period_end: { gt: new Date() } } },
    },
    select: { id: true },
    take: 500,
  })
  if (orphans.length) {
    await prisma.user.updateMany({ where: { id: { in: orphans.map((o) => o.id) } }, data: { is_verified_pro: false } })
  }
  return { expired: overdue.length + orphans.length }
}

/** Status do Pro para as telas (app e site). */
export async function getProStatus(userId: string) {
  const [user, subs, price] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, role: true, is_verified_pro: true, verified_pro_since: true, verified_pro_expires: true,
        document_verification_status: true, verification_data: true,
      },
    }),
    prisma.verifiedProSubscription.findMany({
      where: { user_id: userId, status: { in: ['ACTIVE', 'PAST_DUE'] } },
      orderBy: { current_period_end: 'desc' },
    }),
    getProPrice(),
  ])
  const s = await getSettings()
  const play = subs.find((x) => x.source === 'PLAY') ?? null
  const active = subs[0] ?? null
  const eligible = user?.document_verification_status === 'APPROVED'
  return {
    ...user,
    active_subscription: active,
    monthly_value: price.monthly_value,
    pro: {
      active: !!user?.is_verified_pro,
      expires_at: user?.verified_pro_expires ?? null,
      since: user?.verified_pro_since ?? null,
      source: active?.source ?? null,
      will_renew: play ? play.will_renew : false,
      billing_issue: play?.status === 'PAST_DUE',
      environment: play?.environment ?? null,
      product_id: play?.product_id ?? null,
    },
    eligible,
    ineligible_reason: eligible ? null : 'Envie seus documentos e aguarde a aprovação da conta antes de assinar.',
    benefits: {
      client: [
        'Selo "Cliente Verificado Pro" visível aos profissionais',
        `${Math.round(s.pro_client_fee_discount_pct * 100)}% de desconto na sua taxa de conexão`,
        'Atendimento prioritário no suporte',
      ],
      provider: [
        'Selo "Verificado Pro" no perfil e nas propostas',
        'Destaque grátis em todas as propostas',
        'Prioridade na lista de pacotes e recomendações',
        'Atendimento prioritário no suporte',
      ],
    },
  }
}
