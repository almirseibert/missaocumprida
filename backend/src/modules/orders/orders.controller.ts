import { Request, Response } from 'express'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '../../config/database'
import { estimatePriceDynamic } from '../../utils/priceEstimator'
import { haversineDistance, distanceBucket } from '../../utils/geo'
import * as R from '../../utils/response'
import { sendToUsers, notify } from '../push/push.service'
import { persistUpload } from '../files/files.service'
import { contactsUnlocked } from '../../utils/orderVisibility'
import { sanitizeContactInfo } from '../../utils/contactSanitizer'
import { getSettings } from '../settings/settings.service'
import {
  RawAnswer,
  buildAnswersDisplay,
  buildAnswersSnapshot,
  fuzzCoordinates,
  normalizeAnswers,
  normalizeCityState,
  parseFlexibleDate,
  resolveServiceLocation,
  validateOwnedPhotoUrls,
} from './orders.service'
import { normalizeCep } from '../geo/geo.service'
import { cancelBeforeConnectionByClient } from '../schedules/scheduleCancel.service'
import { creditProviderBalance } from '../audit/ledger.service'
import { audit } from '../audit/audit.service'
import { creditFee } from '../payments/connectionFees.service'

const answerValue = z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.null()])
const orderContentSchema = z.object({
  description: z.string().max(4000).optional().nullable(),
  answers: z.record(answerValue).optional().default({}),
  desired_date: z.union([z.string(), z.null()]).optional(),
  // ---- Local do serviço ----
  address: z.string().max(300).optional().nullable(),
  address_number: z.string().max(20).optional().nullable(),
  address_complement: z.string().max(120).optional().nullable(),
  neighborhood: z.string().max(120).optional().nullable(),
  city: z.string().max(120).optional().nullable(),
  state: z.string().max(40).optional().nullable(),
  cep: z.string().max(12).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  // GPS_AT_SITE: o cliente confirmou que está no local do serviço agora
  location_source: z.enum(['GPS_AT_SITE', 'ADDRESS_GEOCODED']).optional().nullable(),
  location_accuracy_m: z.number().min(0).max(100_000).optional().nullable(),
  // Fotos já enviadas por POST /orders/photos (opcionais, em qualquer categoria)
  photos: z.array(z.string().url()).optional().default([]),
})
const createOrderSchema = orderContentSchema.extend({
  category_id: z.string().uuid(),
  is_urgent: z.boolean().optional().default(false),
  urgency_radius_km: z.number().int().min(1).max(50).optional(),
  // Id gerado pelo app ao abrir o formulário: reenvio não duplica o pedido
  client_request_id: z.string().uuid().optional(),
})
type OrderContentInput = z.infer<typeof orderContentSchema>

const URGENCY_FEE_PCT = 0.25 // 25% sobre o preço estimado
const URGENCY_DEADLINE_HOURS = 2
const URGENCY_DEFAULT_RADIUS_KM = 10

type CategoryForOrder = Prisma.CategoryGetPayload<{ include: { questionnaire_fields: true } }>

/**
 * Valida e normaliza o conteúdo de um pedido (criação e edição usam as
 * mesmas regras). `keepPhotos` são fotos que o pedido já tinha (edição).
 */
async function prepareOrderContent(
  d: OrderContentInput,
  category: CategoryForOrder,
  userId: string,
  opts: { keepPhotos?: string[]; isUrgent: boolean; skipPastDateCheck?: boolean },
): Promise<{ error: string } | { data: Prisma.OrderUncheckedUpdateInput & { city: string; state: string } }> {
  const client = await prisma.user.findUnique({
    where: { id: userId },
    select: { latitude: true, longitude: true, address_state: true },
  })

  const { city, state } = normalizeCityState(d.city ?? undefined, d.state ?? undefined, client?.address_state)
  const address = (d.address ?? '').trim()
  const neighborhood = (d.neighborhood ?? '').trim()
  const cep = normalizeCep(d.cep)
  if (d.cep && !cep) return { error: 'CEP inválido. Use 8 dígitos.' }

  const parsedDate = parseFlexibleDate(d.desired_date)
  if (parsedDate === 'invalid') return { error: 'Data desejada inválida. Use o formato DD/MM/AAAA.' }
  if (parsedDate && !opts.skipPastDateCheck && parsedDate.getTime() < Date.now() - 24 * 60 * 60 * 1000) {
    return { error: 'A data desejada já passou. Escolha uma data a partir de hoje.' }
  }

  // Respostas: normaliza formatos, valida opções e obrigatórias
  const { answers, missing, invalid } = normalizeAnswers(category.questionnaire_fields, d.answers as Record<string, RawAnswer>)
  if (missing.length) return { error: `Campo obrigatório não preenchido: ${missing.join(', ')}` }
  if (invalid.length) return { error: `Resposta inválida em: ${invalid.join(', ')}` }

  // Descrição: obrigatória nas categorias que antes tinham a pergunta "Descreva…"
  const description = d.description ? sanitizeContactInfo(d.description.trim()) : ''
  if (category.description_required && description.length < 5) {
    return {
      error: category.description_hint
        ? `Descreva o serviço: ${category.description_hint}`
        : 'Descreva o serviço que você precisa.',
    }
  }

  // Fotos (opcionais em todas as categorias)
  const s = await getSettings()
  if (d.photos.length > s.max_order_photos) return { error: `Envie no máximo ${s.max_order_photos} fotos.` }
  const keep = new Set(opts.keepPhotos ?? [])
  const newOnes = d.photos.filter((u) => !keep.has(u))
  const owned = await validateOwnedPhotoUrls(newOnes, userId)
  if (owned === null) return { error: 'Uma das fotos não foi encontrada. Envie as fotos novamente.' }
  const photos = Array.from(new Set(d.photos))

  // Local exato do serviço (GPS no local, endereço convertido ou perfil)
  const loc = await resolveServiceLocation(
    {
      latitude: d.latitude,
      longitude: d.longitude,
      location_source: d.location_source,
      location_accuracy_m: d.location_accuracy_m,
      address,
      address_number: d.address_number,
      neighborhood,
      city,
      state,
      cep,
    },
    client,
  )

  // Estimar preço (engine dinâmico — usa pricing_formula se existir, senão fallback legado)
  const price = estimatePriceDynamic(
    (category as any).pricing_formula,
    category.questionnaire_fields.map((f) => ({
      id: f.id,
      key: (f as any).key ?? null,
      field_type: f.field_type,
      affects_price: f.affects_price,
      price_modifier: f.price_modifier,
      pricing_effect: (f as any).pricing_effect,
    })),
    answers,
    category.base_price_min,
    category.base_price_max,
    state,
  )
  const finalMin = opts.isUrgent ? Math.round(price.min * (1 + URGENCY_FEE_PCT) * 100) / 100 : price.min
  const finalMax = opts.isUrgent ? Math.round(price.max * (1 + URGENCY_FEE_PCT) * 100) / 100 : price.max

  const locationLabel = [neighborhood, city].filter(Boolean).join(', ')
  const title = `${opts.isUrgent ? '🚨 URGENTE — ' : ''}${category.name} — ${locationLabel || city}`

  return {
    data: {
      title,
      description: description || null,
      answers,
      answers_snapshot: buildAnswersSnapshot(category.questionnaire_fields.filter((f) => f.is_active), answers) as never,
      photos,
      desired_date: parsedDate ?? null,
      address: address || null,
      address_number: (d.address_number ?? '').trim() || null,
      address_complement: (d.address_complement ?? '').trim() || null,
      neighborhood: neighborhood || null,
      city,
      state,
      cep,
      latitude: loc.latitude,
      longitude: loc.longitude,
      location_source: loc.location_source,
      location_accuracy_m: loc.location_accuracy_m,
      location_captured_at: loc.location_captured_at,
      estimated_price_min: finalMin,
      estimated_price_max: finalMax,
      urgency_fee_value: opts.isUrgent ? Math.round((finalMax - price.max) * 100) / 100 : null,
    },
  }
}

export async function createOrder(req: Request, res: Response) {
  const parsed = createOrderSchema.safeParse(req.body)
  if (!parsed.success) return R.badRequest(res, 'Dados inválidos', parsed.error.flatten().fieldErrors)

  const d = parsed.data
  const { category_id, is_urgent, urgency_radius_km, client_request_id } = d

  // Idempotência: o mesmo formulário reenviado (rede caiu) devolve o pedido já criado
  if (client_request_id) {
    const existing = await prisma.order.findUnique({
      where: { client_id_client_request_id: { client_id: req.userId, client_request_id } },
      include: {
        category: { select: { id: true, name: true, icon: true } },
        client: { select: { id: true, name: true, avatar: true } },
      },
    })
    if (existing) return R.ok(res, existing, 'Pedido já registrado')
  }

  const category = await prisma.category.findUnique({
    where: { id: category_id },
    include: { questionnaire_fields: true, group: { select: { is_active: true } } },
  })
  if (!category) return R.notFound(res, 'Categoria não encontrada')
  if (!category.is_active || !category.group?.is_active) {
    return R.badRequest(res, 'Esta categoria foi atualizada. Volte e abra o formulário novamente.')
  }

  const prepared = await prepareOrderContent(d, category, req.userId, { isUrgent: is_urgent })
  if ('error' in prepared) return R.badRequest(res, prepared.error)
  const content = prepared.data
  const latitude = content.latitude as number | null
  const longitude = content.longitude as number | null
  const city = content.city

  const order = await prisma.order.create({
    data: {
      ...(content as Prisma.OrderUncheckedCreateInput),
      client_id: req.userId,
      category_id,
      client_request_id,
      is_urgent,
      urgency_fee_pct: is_urgent ? URGENCY_FEE_PCT : null,
      urgency_deadline: is_urgent ? new Date(Date.now() + URGENCY_DEADLINE_HOURS * 60 * 60 * 1000) : null,
      urgency_radius_km: is_urgent ? (urgency_radius_km ?? URGENCY_DEFAULT_RADIUS_KM) : null,
    },
    include: {
      category: { select: { id: true, name: true, icon: true } },
      client: { select: { id: true, name: true, avatar: true } },
    },
  })

  // Notify providers who have this category skill and are active
  try {
    const skills = await prisma.providerSkill.findMany({
      where: { category_id: category_id, is_active: true },
      select: {
        provider_id: true,
        service_radius_km: true,
        provider: { select: { id: true, latitude: true, longitude: true } },
      },
    })
    // Filtra por raio. Urgente usa raio especial (urgency_radius_km),
    // pedidos normais respeitam o raio individual de cada prestador.
    let targets: string[]
    if (latitude != null && longitude != null) {
      const urgentRadius = urgency_radius_km ?? URGENCY_DEFAULT_RADIUS_KM
      targets = skills
        .filter((s) => {
          const plat = s.provider?.latitude
          const plng = s.provider?.longitude
          if (plat == null || plng == null) return false
          const dist = haversineDistance(latitude, longitude, plat!, plng!)
          const radius = is_urgent ? urgentRadius : (s.service_radius_km ?? 20)
          return dist <= radius
        })
        .map((s) => s.provider_id)
    } else {
      // Pedido sem coordenadas: notifica todos da categoria como fallback (não dá pra calcular distância)
      targets = skills.map((s) => s.provider_id)
    }
    targets = targets.filter((id) => id !== req.userId)
    if (targets.length > 0) {
      const title = is_urgent
        ? `🚨 URGENTE: ${category.name} perto de você!`
        : 'Novo pedido na sua área!'
      const body = is_urgent
        ? `Cliente precisa em até ${URGENCY_DEADLINE_HOURS}h. Atendimento prioritário em ${city}.`
        : `Um novo pedido de ${category.name} foi publicado em ${city}.`
      await prisma.notification.createMany({
        data: targets.map((id) => ({
          user_id: id,
          type: 'NEW_ORDER_NEARBY' as never,
          title,
          body,
          data: { order_id: order.id, urgent: is_urgent } as never,
        })),
        skipDuplicates: true,
      })
      await sendToUsers(targets, {
        title,
        body,
        data: { order_id: order.id, type: 'NEW_ORDER_NEARBY', urgent: is_urgent },
        channel: is_urgent ? 'urgent_orders' : 'general',
      })
    }
  } catch {
    // Non-fatal — don't fail the order creation
  }

  audit({ type: 'ORDER_CREATED', userId: req.userId, orderId: order.id, entityType: 'Order', entityId: order.id, after: { category: category.slug, city, is_urgent, location_source: content.location_source, photos: (content.photos as string[]).length } })
  return R.created(res, order, 'Pedido criado com sucesso')
}

// ---------------------------------------------------------------------------
// PATCH /api/orders/:id — cliente edita o pedido enquanto não aceitou proposta
// ---------------------------------------------------------------------------
const EDITABLE_STATUSES = ['OPEN', 'IN_PROPOSAL']

export async function updateOrder(req: Request, res: Response) {
  const parsed = orderContentSchema.safeParse(req.body)
  if (!parsed.success) return R.badRequest(res, 'Dados inválidos', parsed.error.flatten().fieldErrors)

  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: {
      category: { include: { questionnaire_fields: true } },
      proposals: { where: { status: 'PENDING' }, select: { id: true, provider_id: true } },
    },
  })
  if (!order) return R.notFound(res, 'Pedido não encontrado')
  if (order.client_id !== req.userId) return R.forbidden(res)
  if (!EDITABLE_STATUSES.includes(order.status)) {
    return R.conflict(res, 'Este pedido não pode mais ser editado: já existe uma proposta aceita. Combine as mudanças pelo chat ou cancele o agendamento.')
  }

  // Campos não enviados mantêm o valor atual (edição parcial)
  const body = req.body as Record<string, unknown>
  const has = (k: string) => Object.prototype.hasOwnProperty.call(body, k)
  const keepLocation = !has('latitude') && !has('longitude') && !has('address') && !has('cep') && !has('city')
  const merged: OrderContentInput = {
    description: has('description') ? parsed.data.description : order.description,
    answers: has('answers') ? parsed.data.answers : ((order.answers ?? {}) as Record<string, string>),
    desired_date: has('desired_date') ? parsed.data.desired_date : order.desired_date?.toISOString() ?? null,
    address: has('address') ? parsed.data.address : order.address,
    address_number: has('address_number') ? parsed.data.address_number : order.address_number,
    address_complement: has('address_complement') ? parsed.data.address_complement : order.address_complement,
    neighborhood: has('neighborhood') ? parsed.data.neighborhood : order.neighborhood,
    city: has('city') ? parsed.data.city : order.city,
    state: has('state') ? parsed.data.state : order.state,
    cep: has('cep') ? parsed.data.cep : order.cep,
    latitude: keepLocation ? order.latitude : parsed.data.latitude,
    longitude: keepLocation ? order.longitude : parsed.data.longitude,
    location_source: keepLocation
      ? ((order.location_source === 'GPS_AT_SITE' || order.location_source === 'ADDRESS_GEOCODED') ? order.location_source : null)
      : parsed.data.location_source,
    location_accuracy_m: keepLocation ? order.location_accuracy_m : parsed.data.location_accuracy_m,
    photos: has('photos') ? parsed.data.photos : order.photos,
  }

  const prepared = await prepareOrderContent(merged, order.category, req.userId, {
    keepPhotos: order.photos,
    isUrgent: order.is_urgent,
    skipPastDateCheck: !has('desired_date'),
  })
  if ('error' in prepared) return R.badRequest(res, prepared.error)
  const data = prepared.data
  if (keepLocation) {
    // sem mudança de endereço: mantém exatamente a origem/precisão registradas
    data.location_source = order.location_source
    data.location_captured_at = order.location_captured_at
  }

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { ...data, edited_at: new Date(), edit_count: { increment: 1 } },
    include: { category: { select: { id: true, name: true, icon: true } } },
  })

  // Quem já mandou proposta precisa saber que o pedido mudou
  const providerIds = Array.from(new Set(order.proposals.map((p) => p.provider_id)))
  if (providerIds.length > 0) {
    const title = 'Pedido editado pelo cliente'
    const bodyText = `O pedido "${updated.title}" foi alterado. Confira os detalhes e ajuste sua proposta se precisar.`
    await prisma.notification.createMany({
      data: providerIds.map((id) => ({
        user_id: id,
        type: 'ORDER_UPDATED' as never,
        title,
        body: bodyText,
        data: { order_id: order.id } as never,
      })),
    }).catch(() => {})
    await sendToUsers(providerIds, { title, body: bodyText, data: { order_id: order.id, type: 'ORDER_UPDATED' }, channel: 'proposal_update' })
  }

  audit({ type: 'ORDER_EDITED', userId: req.userId, orderId: order.id, entityType: 'Order', entityId: order.id, before: { description: order.description, answers: order.answers, address: order.address, address_number: order.address_number, city: order.city, desired_date: order.desired_date, photos: order.photos.length }, after: { description: data.description, answers: data.answers, address: data.address, address_number: data.address_number, city: data.city, desired_date: data.desired_date, photos: (data.photos as string[] | undefined)?.length }, metadata: { notified_providers: providerIds.length } })
  return R.ok(res, updated, providerIds.length ? 'Pedido atualizado. Os prestadores com proposta foram avisados.' : 'Pedido atualizado')
}

// ---------------------------------------------------------------------------
// Cancelamento/exclusão pelo cliente
// ---------------------------------------------------------------------------
/** Cancela um pedido ainda sem proposta aceita: recusa as propostas, devolve boosts pagos e avisa. */
async function cancelOpenOrder(orderId: string, actorId: string, reason: string, hide: boolean, byAdmin = false) {
  const result = await prisma.$transaction(async (tx) => {
    const moved = await tx.order.updateMany({
      where: { id: orderId, status: { in: EDITABLE_STATUSES as never } },
      data: {
        status: 'CANCELLED',
        cancelled_at: new Date(),
        cancelled_by: actorId,
        cancel_reason: reason,
        ...(hide ? { hidden_by_client_at: new Date() } : {}),
      },
    })
    if (moved.count === 0) return null
    const pending = await tx.proposal.findMany({
      where: { order_id: orderId, status: 'PENDING' },
      select: { id: true, provider_id: true, boost_purchases: { select: { value: true, payment_ref: true } } },
    })
    await tx.proposal.updateMany({ where: { order_id: orderId, status: 'PENDING' }, data: { status: 'REJECTED' } })
    // Boost pago com saldo numa proposta que não vai ser avaliada volta para o prestador
    for (const p of pending) {
      const refund = p.boost_purchases
        .filter((b) => b.payment_ref === 'INTERNAL_BALANCE')
        .reduce((sum, b) => sum + (b.value ?? 0), 0)
      if (refund > 0) {
        await creditProviderBalance(tx, {
          userId: p.provider_id, amount: refund, reason: 'BOOST_REFUND',
          refType: 'Proposal', refId: p.id, orderId,
          note: byAdmin ? 'Pedido cancelado pelo suporte: destaque devolvido' : 'Pedido cancelado pelo cliente: destaque devolvido',
        })
      }
    }
    return pending
  })
  if (result === null) return null

  const providerIds = Array.from(new Set(result.map((p) => p.provider_id)))
  if (providerIds.length > 0) {
    const title = byAdmin ? 'Pedido cancelado pelo suporte' : 'Pedido cancelado pelo cliente'
    const body = 'Um pedido em que você fez proposta foi cancelado. Se você pagou destaque, o valor voltou para o seu saldo.'
    await prisma.notification.createMany({
      data: providerIds.map((id) => ({ user_id: id, type: 'ORDER_CANCELLED' as never, title, body, data: { order_id: orderId } as never })),
    }).catch(() => {})
    await sendToUsers(providerIds, { title, body, data: { order_id: orderId, type: 'ORDER_CANCELLED' }, channel: 'proposal_update' })
  }
  return result
}

// DELETE /api/orders/:id — "excluir" o pedido.
// Sem proposta aceita: cancela e tira da lista. Com proposta aceita mas taxa
// ainda pendente: segue as regras do cancelamento antes da conexão (taxa paga
// volta como crédito). Depois da conexão paga: bloqueado (Termos de Uso).
// Pedidos encerrados (cancelado/concluído) só saem da lista do cliente.
// O registro nunca é apagado de verdade — fica para auditoria e suporte.
export async function deleteOrder(req: Request, res: Response) {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: { schedule: { select: { id: true } } },
  })
  if (!order) return R.notFound(res, 'Pedido não encontrado')
  if (order.client_id !== req.userId) return R.forbidden(res)
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.slice(0, 300) : 'Excluído pelo cliente'

  if (EDITABLE_STATUSES.includes(order.status)) {
    const done = await cancelOpenOrder(order.id, req.userId, reason, true)
    if (!done) return R.conflict(res, 'O pedido mudou de estado. Atualize a tela e tente novamente.')
    audit({ type: 'ORDER_DELETED', userId: req.userId, orderId: order.id, entityType: 'Order', entityId: order.id, before: { status: order.status }, after: { status: 'CANCELLED', hidden: true }, reason })
    return R.ok(res, null, 'Pedido excluído. Os prestadores com proposta foram avisados.')
  }

  if (order.status === 'ACCEPTED' && order.schedule) {
    const result = await cancelBeforeConnectionByClient(order.schedule.id, req.userId)
    if (!result.ok) return R.conflict(res, result.message)
    await prisma.order.update({
      where: { id: order.id },
      data: { hidden_by_client_at: new Date(), cancelled_at: new Date(), cancelled_by: req.userId, cancel_reason: reason },
    })
    return R.ok(res, null, result.message)
  }

  if (['CANCELLED', 'DONE', 'RATED'].includes(order.status)) {
    await prisma.order.update({ where: { id: order.id }, data: { hidden_by_client_at: new Date() } })
    audit({ type: 'ORDER_HIDDEN', userId: req.userId, orderId: order.id, entityType: 'Order', entityId: order.id, before: { status: order.status } })
    return R.ok(res, null, 'Pedido removido da sua lista')
  }

  return R.conflict(
    res,
    'Este pedido já tem a conexão paga e não pode ser excluído. Para desistir, cancele o agendamento — pelos Termos de Uso, cancelar depois de receber os dados do profissional leva ao banimento da conta.',
  )
}

// PATCH /api/orders/:id/cancel — cancela sem tirar da lista (compatível com o site/app antigos)
export async function cancelOrder(req: Request, res: Response) {
  const order = await prisma.order.findUnique({ where: { id: req.params.id } })
  if (!order) return R.notFound(res, 'Pedido não encontrado')
  if (order.client_id !== req.userId) return R.forbidden(res)

  if (!EDITABLE_STATUSES.includes(order.status)) {
    return R.badRequest(res, 'Pedido não pode ser cancelado neste estágio. Use "Cancelar agendamento" ou fale com o suporte.')
  }
  const done = await cancelOpenOrder(order.id, req.userId, 'Cancelado pelo cliente', false)
  if (!done) return R.conflict(res, 'O pedido mudou de estado. Atualize a tela e tente novamente.')
  audit({ type: 'ORDER_CANCELLED', userId: req.userId, orderId: order.id, entityType: 'Order', entityId: order.id, before: { status: order.status }, after: { status: 'CANCELLED' } })
  return R.ok(res, null, 'Pedido cancelado')
}

const ORDER_STATUSES = ['OPEN', 'IN_PROPOSAL', 'ACCEPTED', 'SCHEDULED', 'IN_PROGRESS', 'DONE', 'RATED', 'CANCELLED', 'DISPUTED']

/** Paginação segura: evita limit gigante (dump/DoS) e valores não numéricos. */
function pageParams(query: Request['query'], defLimit = 10) {
  const page = Math.max(parseInt(String(query.page ?? '1'), 10) || 1, 1)
  const limit = Math.min(Math.max(parseInt(String(query.limit ?? defLimit), 10) || defLimit, 1), 50)
  return { page, limit }
}

export async function listMyOrders(req: Request, res: Response) {
  const { status } = req.query
  const { page, limit } = pageParams(req.query)
  const skip = (page - 1) * limit

  const where: Record<string, unknown> = { client_id: req.userId }
  if (typeof status === 'string' && ORDER_STATUSES.includes(status)) where.status = status
  // Pedidos "excluídos" pelo cliente saem da lista (o registro continua no banco)
  if (req.query.include_hidden !== '1') where.hidden_by_client_at = null

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip,
      take: limit,
      include: {
        category: { select: { id: true, name: true, icon: true } },
        proposals: { select: { id: true, status: true } },
        schedule: { select: { id: true, status: true, scheduled_at: true } },
      },
    }),
    prisma.order.count({ where }),
  ])

  return R.ok(res, { orders, total, page, limit })
}

// Antes da conexão paga: tira endereço/CEP/número e desloca o ponto 300–800 m
// (deslocamento fixo por pedido — ver fuzzCoordinates).
function maskLocationForProvider<
  T extends { id: string; latitude: number | null; longitude: number | null; address: string | null },
>(order: T): T & { location_blurred: boolean } {
  const fuzzed =
    order.latitude != null && order.longitude != null
      ? fuzzCoordinates(order.id, order.latitude, order.longitude)
      : { latitude: null, longitude: null }
  return {
    ...order,
    address: null,
    address_number: null,
    address_complement: null,
    cep: null,
    location_accuracy_m: null,
    latitude: fuzzed.latitude,
    longitude: fuzzed.longitude,
    location_blurred: true,
  }
}

const PRE_ACCEPTANCE_STATUSES = ['OPEN', 'IN_PROPOSAL']

export async function getProviderFeed(req: Request, res: Response) {
  const { city } = req.query
  const { page: pageNum, limit: limitNum } = pageParams(req.query)

  // Busca habilidades e localização do prestador
  const [skills, provider] = await Promise.all([
    prisma.providerSkill.findMany({
      where: { provider_id: req.userId, is_active: true },
      select: { category_id: true, service_radius_km: true },
    }),
    prisma.user.findUnique({
      where: { id: req.userId },
      select: { latitude: true, longitude: true },
    }),
  ])

  const categoryIds = skills.map(s => s.category_id)
  if (categoryIds.length === 0) {
    return R.ok(res, { orders: [], total: 0, message: 'Cadastre suas habilidades para ver pedidos disponíveis' })
  }

  // Mapa de raio por categoria
  const radiusByCategory = new Map(skills.map(s => [s.category_id, s.service_radius_km]))

  // OPEN e IN_PROPOSAL: o pedido continua visível para os demais prestadores
  // depois da primeira proposta (antes sumia do feed de todo mundo).
  const where: Record<string, unknown> = {
    status: { in: PRE_ACCEPTANCE_STATUSES },
    category_id: { in: categoryIds },
    client_id: { not: req.userId },
  }
  if (typeof city === 'string' && city) where.city = { contains: city, mode: 'insensitive' }

  // Busca todos os pedidos candidatos para filtrar por distância em memória
  // Urgentes primeiro (com deadline ainda vigente), depois por data
  const allOrders = await prisma.order.findMany({
    where,
    orderBy: [{ is_urgent: 'desc' }, { created_at: 'desc' }],
    include: {
      category: { select: { id: true, name: true, icon: true } },
      client: { select: { id: true, name: true, avatar: true, rating_avg: true } },
      proposals: { where: { provider_id: req.userId }, select: { id: true, status: true } },
    },
  })

  // Filtro e enriquecimento por distância
  const providerHasLocation = provider?.latitude != null && provider?.longitude != null

  type OrderWithDistance = typeof allOrders[0] & { distance_km: number | null }

  const enriched: OrderWithDistance[] = allOrders.map(order => {
    if (!providerHasLocation || order.latitude == null || order.longitude == null) {
      return { ...order, distance_km: null }
    }
    const dist = haversineDistance(
      provider!.latitude!,
      provider!.longitude!,
      order.latitude,
      order.longitude,
    )
    return { ...order, distance_km: Math.round(dist * 10) / 10 }
  })

  const filtered = enriched.filter(order => {
    // Prestador sem localização cadastrada: mostra tudo (não dá pra filtrar)
    if (!providerHasLocation) return true
    const radius = radiusByCategory.get(order.category_id) ?? 20
    // Pedido sem coordenadas é excluído quando o prestador tem localização —
    // evita mostrar pedido potencialmente a 50 km pra quem atende só 5 km.
    if (order.distance_km == null) return false
    return order.distance_km <= radius
  })

  // Ordenar: com distância primeiro (mais próximo), depois sem localização
  filtered.sort((a, b) => {
    if (a.distance_km == null && b.distance_km == null) return 0
    if (a.distance_km == null) return 1
    if (b.distance_km == null) return -1
    return a.distance_km - b.distance_km
  })

  const total = filtered.length
  // Feed always shows pre-acceptance orders — always mask sensitive location.
  // A distância sai em faixas ("1–3 km"): o prestador pode mudar a própria
  // posição à vontade, e com a distância exata triangularia o endereço.
  const paginated = filtered
    .slice((pageNum - 1) * limitNum, pageNum * limitNum)
    .map((order) => ({
      ...maskLocationForProvider(order),
      ...(order.distance_km == null
        ? { distance_km: null, distance_label: null }
        : distanceBucket(order.distance_km)),
    }))

  return R.ok(res, {
    orders: paginated,
    total,
    page: pageNum,
    limit: limitNum,
    provider_has_location: providerHasLocation,
  })
}

// Remove o telefone do cliente da resposta (Taxa de Conexão: contato só
// depois que as duas taxas foram pagas)
function stripClientPhone<T extends { client: { phone?: string | null } }>(order: T): T {
  return { ...order, client: { ...order.client, phone: null } }
}

export async function getOrder(req: Request, res: Response) {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: {
      category: {
        include: { questionnaire_fields: { orderBy: { order: 'asc' } } },
      },
      client: { select: { id: true, name: true, avatar: true, rating_avg: true, phone: true } },
      proposals: {
        include: {
          provider: { select: { id: true, name: true, avatar: true, rating_avg: true, rating_count: true, bio: true } },
        },
        orderBy: { created_at: 'asc' },
      },
      schedule: true,
    },
  })
  if (!order) return R.notFound(res, 'Pedido não encontrado')

  const isClient = order.client_id === req.userId
  // Provider whose proposal was accepted (or schedule exists for them)
  const isAcceptedProvider =
    order.schedule?.provider_id === req.userId ||
    order.proposals.some(p => p.provider_id === req.userId && p.status === 'ACCEPTED')
  const isProposalProvider = order.proposals.some(p => p.provider_id === req.userId)
  const unlocked = contactsUnlocked(order.status, order.provider_fee_paid_at)

  // Respostas do questionário em formato legível — o prestador precisa delas
  // para orçar. Contatos digitados nas respostas só aparecem após a conexão.
  const fullAccess = isClient || (isAcceptedProvider && unlocked)
  const answers_display = buildAnswersDisplay(order.category?.questionnaire_fields ?? [], order.answers, {
    maskContacts: !fullAccess,
    snapshot: order.answers_snapshot,
  })
  const withDisplay = { ...order, answers_display }

  if (fullAccess) {
    // Fotos do check-in/conclusão (com GPS) só para as partes da conexão paga
    const service_photos = await prisma.orderPhoto.findMany({
      where: { order_id: order.id },
      orderBy: { created_at: 'asc' },
      select: { id: true, stage: true, url: true, latitude: true, longitude: true, created_at: true },
    })
    return R.ok(res, { ...withDisplay, service_photos })
  }
  const order_ = {
    ...withDisplay,
    description: order.description ? sanitizeContactInfo(order.description) : order.description,
  }

  // O agendamento guarda endereço/GPS de check-in e conclusão: fora da
  // conexão liberada, só id/status/data.
  const safeSchedule = order.schedule
    ? { id: order.schedule.id, status: order.schedule.status, scheduled_at: order.schedule.scheduled_at }
    : null

  if (!isProposalProvider) {
    // Unknown visitor — minimal public view, always masked (location + phone)
    const { proposals: _, ...publicOrder } = stripClientPhone(order_)
    return R.ok(res, maskLocationForProvider({ ...publicOrder, schedule: safeSchedule }))
  }

  // Provider with proposal (accepted or not) BEFORE the fees are paid:
  // keeps only their own proposal visible (others' values are competitors'
  // data) and masks address/coords and client phone.
  const { proposals, ...rest } = stripClientPhone(order_)
  const ownProposals = proposals.filter((p) => p.provider_id === req.userId)
  return R.ok(res, { ...maskLocationForProvider({ ...rest, schedule: safeSchedule }), proposals: ownProposals })
}

// POST /api/orders/photos — envia fotos ANTES de criar o pedido (o formulário
// manda as URLs junto com o pedido; assim, falha de rede no upload não deixa
// pedido criado pela metade). Fotos opcionais, em qualquer categoria.
export async function preUploadOrderPhotos(req: Request, res: Response) {
  const files = Array.isArray(req.files) ? (req.files as Express.Multer.File[]) : []
  if (files.length === 0) return R.badRequest(res, 'Nenhuma foto enviada')
  const s = await getSettings()
  if (files.length > s.max_order_photos) return R.badRequest(res, `Envie no máximo ${s.max_order_photos} fotos.`)
  const urls: string[] = []
  for (const f of files) urls.push(await persistUpload(req, f, { ownerId: req.userId }))
  return R.created(res, { urls }, 'Fotos enviadas')
}

// POST /api/orders/:id/photos — adiciona fotos a um pedido já criado
export async function uploadOrderPhotos(req: Request, res: Response) {
  const order = await prisma.order.findUnique({ where: { id: req.params.id } })
  if (!order) return R.notFound(res, 'Pedido não encontrado')
  if (order.client_id !== req.userId) return R.forbidden(res)
  if (['CANCELLED', 'DONE', 'RATED'].includes(order.status)) {
    return R.badRequest(res, 'Não é possível adicionar fotos a este pedido')
  }
  if (!req.files || !Array.isArray(req.files) || req.files.length === 0) return R.badRequest(res, 'Nenhuma foto enviada')

  const files = req.files as Express.Multer.File[]
  const s = await getSettings()
  if (order.photos.length + files.length > s.max_order_photos) {
    return R.badRequest(res, `Cada pedido aceita no máximo ${s.max_order_photos} fotos.`)
  }
  const urls: string[] = []
  for (const f of files) urls.push(await persistUpload(req, f, { ownerId: req.userId }))
  const updated = await prisma.order.update({
    where: { id: req.params.id },
    data: { photos: { push: urls } },
    select: { id: true, photos: true },
  })
  return R.ok(res, updated, 'Fotos adicionadas com sucesso')
}


// ============================================================
// ADMIN — acompanhamento e intervenção em pedidos
// ============================================================

// GET /api/orders/admin/list?status=&search=
export async function adminListOrders(req: Request, res: Response) {
  const status = req.query.status ? String(req.query.status).toUpperCase() : ''
  const search = req.query.search ? String(req.query.search).trim() : ''

  const where: Record<string, unknown> = {}
  const STATUSES = ['OPEN', 'IN_PROPOSAL', 'ACCEPTED', 'SCHEDULED', 'IN_PROGRESS', 'DONE', 'RATED', 'CANCELLED', 'DISPUTED']
  if (STATUSES.includes(status)) where.status = status
  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { client: { name: { contains: search, mode: 'insensitive' } } },
    ]
  }

  const orders = await prisma.order.findMany({
    where,
    orderBy: { created_at: 'desc' },
    take: 100,
    select: {
      id: true, title: true, status: true, city: true, neighborhood: true,
      final_price: true, client_total: true, is_urgent: true, created_at: true,
      category: { select: { name: true, icon: true } },
      client: { select: { id: true, name: true } },
      schedule: {
        select: {
          id: true, status: true, scheduled_at: true,
          provider: { select: { id: true, name: true } },
        },
      },
      payment: { select: { status: true, amount: true, provider_amount: true } },
      _count: { select: { proposals: true } },
    },
  })
  return R.ok(res, orders)
}

// GET /api/orders/admin/orders/:id — detalhe completo
export async function adminGetOrder(req: Request, res: Response) {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: {
      category: { select: { name: true, icon: true } },
      client: { select: { id: true, name: true, email: true, phone: true } },
      proposals: {
        select: { id: true, value: true, status: true, message: true, provider: { select: { id: true, name: true } } },
      },
      schedule: { include: { provider: { select: { id: true, name: true, phone: true } } } },
      payment: true,
    },
  })
  if (!order) return R.notFound(res, 'Pedido não encontrado')
  return R.ok(res, order)
}

// PATCH /api/orders/admin/orders/:id/cancel — intervenção do admin
// PATCH /api/orders/admin/orders/:id/cancel — cancelamento pelo suporte.
// Motivo obrigatório (fica na linha do tempo). Taxas pendentes são canceladas;
// taxas já pagas voltam como crédito (cliente) / saldo (prestador), a menos
// que o admin marque credit_fees=false (ex.: fraude comprovada).
const adminCancelSchema = z.object({
  reason: z.string().trim().min(5, 'Informe o motivo (mínimo 5 caracteres)').max(500),
  credit_fees: z.boolean().optional().default(true),
})

export async function adminCancelOrder(req: Request, res: Response) {
  const parsed = adminCancelSchema.safeParse(req.body ?? {})
  if (!parsed.success) return R.badRequest(res, parsed.error.errors[0]?.message ?? 'Motivo obrigatório')
  const { reason, credit_fees } = parsed.data

  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: { schedule: { select: { id: true, status: true, provider_id: true, proposal_id: true } }, connection_fees: true },
  })
  if (!order) return R.notFound(res, 'Pedido não encontrado')
  if (['DONE', 'RATED', 'CANCELLED'].includes(order.status)) {
    return R.badRequest(res, `Pedido já está ${order.status} e não pode ser cancelado.`)
  }

  // Sem proposta aceita: mesmo caminho do cliente (recusa propostas, devolve boosts, avisa)
  if (EDITABLE_STATUSES.includes(order.status)) {
    const done = await cancelOpenOrder(order.id, req.userId, reason, false, true)
    if (!done) return R.conflict(res, 'O pedido mudou de estado. Atualize e tente novamente.')
    await notify(order.client_id, {
      type: 'ORDER_CANCELLED',
      title: 'Pedido cancelado pelo suporte',
      body: `Seu pedido "${order.title}" foi cancelado. Motivo: ${reason}`,
      data: { order_id: order.id },
      channel: 'proposal_update',
    }).catch(() => {})
    audit({
      type: 'ORDER_CANCELLED_BY_ADMIN', userId: order.client_id, orderId: order.id, entityType: 'Order',
      entityId: order.id, reason, before: { status: order.status }, after: { status: 'CANCELLED' },
      metadata: { rejected_proposals: done.length },
    })
    return R.ok(res, null, 'Pedido cancelado. Cliente e prestadores foram avisados.')
  }

  // Com proposta aceita: o agendamento fica guardado (status CANCELLED), nada é apagado
  const moved = await prisma.$transaction(async (tx) => {
    const m = await tx.order.updateMany({
      where: { id: order.id, status: order.status },
      data: { status: 'CANCELLED', cancelled_at: new Date(), cancelled_by: req.userId, cancel_reason: reason },
    })
    if (m.count === 0) return false
    if (order.schedule) {
      await tx.schedule.update({ where: { id: order.schedule.id }, data: { status: 'CANCELLED' } })
      await tx.proposal.update({ where: { id: order.schedule.proposal_id }, data: { status: 'CANCELLED' } })
    }
    await tx.proposal.updateMany({ where: { order_id: order.id, status: 'PENDING' }, data: { status: 'REJECTED' } })
    await tx.connectionFee.updateMany({ where: { order_id: order.id, status: 'PENDING' }, data: { status: 'CANCELLED' } })
    return true
  })
  if (!moved) return R.conflict(res, 'O pedido mudou de estado. Atualize e tente novamente.')

  const credited: Array<{ side: string; fee_id: string }> = []
  if (credit_fees) {
    for (const fee of order.connection_fees) {
      if (fee.status !== 'PAID' && fee.status !== 'COVERED') continue
      if (await creditFee(fee, 'ADMIN_CANCEL', { notes: reason, adminId: req.userId })) {
        credited.push({ side: fee.side, fee_id: fee.id })
      }
    }
  }

  const body = `O pedido "${order.title}" foi cancelado pelo suporte. Motivo: ${reason}`
  const recipients = [order.client_id, order.schedule?.provider_id].filter(Boolean) as string[]
  for (const uid of recipients) {
    await notify(uid, {
      type: 'ORDER_CANCELLED',
      title: 'Pedido cancelado pelo suporte',
      body,
      data: { order_id: order.id },
      channel: 'schedule_update',
    }).catch(() => {})
  }
  audit({
    type: 'ORDER_CANCELLED_BY_ADMIN', userId: order.client_id, counterpartId: order.schedule?.provider_id ?? null,
    orderId: order.id, entityType: 'Order', entityId: order.id, reason,
    before: { status: order.status, schedule: order.schedule?.status ?? null },
    after: { status: 'CANCELLED' },
    metadata: { credit_fees, credited },
  })
  return R.ok(
    res,
    { credited },
    credited.length > 0
      ? 'Pedido cancelado. As taxas pagas voltaram como crédito/saldo para quem pagou.'
      : 'Pedido cancelado. As duas partes foram avisadas.',
  )
}
