import { Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../../config/database'
import { estimatePriceDynamic } from '../../utils/priceEstimator'
import { haversineDistance, distanceBucket } from '../../utils/geo'
import * as R from '../../utils/response'
import { sendToUsers } from '../push/push.service'
import { persistUpload } from '../files/files.service'
import { contactsUnlocked } from '../../utils/orderVisibility'
import { sanitizeContactInfo } from '../../utils/contactSanitizer'
import { getSettings } from '../settings/settings.service'
import {
  RawAnswer,
  buildAnswersDisplay,
  normalizeAnswers,
  normalizeCityState,
  parseFlexibleDate,
  validateOwnedPhotoUrls,
} from './orders.service'

// Aceita os formatos do app antigo (booleano cru, data DD/MM/AAAA, sem UF) e
// normaliza no servidor — ver orders.service.ts.
const answerValue = z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.null()])
const createOrderSchema = z.object({
  category_id: z.string().uuid(),
  description: z.string().max(4000).optional().nullable(),
  answers: z.record(answerValue).optional().default({}),
  desired_date: z.union([z.string(), z.null()]).optional(),
  address: z.string().max(300).optional().nullable(),
  neighborhood: z.string().max(120).optional().nullable(),
  city: z.string().max(120).optional().nullable(),
  state: z.string().max(40).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  is_urgent: z.boolean().optional().default(false),
  urgency_radius_km: z.number().int().min(1).max(50).optional(),
  // Fotos já enviadas por POST /orders/photos (opcionais, em qualquer categoria)
  photos: z.array(z.string().url()).optional().default([]),
  // Id gerado pelo app ao abrir o formulário: reenvio não duplica o pedido
  client_request_id: z.string().uuid().optional(),
})

const URGENCY_FEE_PCT = 0.25 // 25% sobre o preço estimado
const URGENCY_DEADLINE_HOURS = 2
const URGENCY_DEFAULT_RADIUS_KM = 10

export async function createOrder(req: Request, res: Response) {
  const parsed = createOrderSchema.safeParse(req.body)
  if (!parsed.success) return R.badRequest(res, 'Dados inválidos', parsed.error.flatten().fieldErrors)

  const d = parsed.data
  const { category_id, is_urgent, urgency_radius_km, client_request_id } = d
  let { latitude, longitude } = d

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

  const client = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { latitude: true, longitude: true, address_state: true },
  })

  // Fallback: se o cliente não enviou coordenadas no formulário, herda do perfil
  if (latitude == null || longitude == null) {
    if (client?.latitude != null && client?.longitude != null) {
      latitude = client.latitude
      longitude = client.longitude
    }
  }

  const { city, state } = normalizeCityState(d.city ?? undefined, d.state ?? undefined, client?.address_state)
  const address = (d.address ?? '').trim()
  const neighborhood = (d.neighborhood ?? '').trim()

  const parsedDate = parseFlexibleDate(d.desired_date)
  if (parsedDate === 'invalid') return R.badRequest(res, 'Data desejada inválida. Use o formato DD/MM/AAAA.')
  if (parsedDate && parsedDate.getTime() < Date.now() - 24 * 60 * 60 * 1000) {
    return R.badRequest(res, 'A data desejada já passou. Escolha uma data a partir de hoje.')
  }

  // Respostas: normaliza formatos, valida opções e obrigatórias
  const { answers, missing, invalid } = normalizeAnswers(category.questionnaire_fields, d.answers as Record<string, RawAnswer>)
  if (missing.length) return R.badRequest(res, `Campo obrigatório não preenchido: ${missing.join(', ')}`)
  if (invalid.length) return R.badRequest(res, `Resposta inválida em: ${invalid.join(', ')}`)

  // Descrição: obrigatória nas categorias que antes tinham a pergunta "Descreva…"
  const description = d.description ? sanitizeContactInfo(d.description.trim()) : ''
  if (category.description_required && description.length < 5) {
    return R.badRequest(res, category.description_hint
      ? `Descreva o serviço: ${category.description_hint}`
      : 'Descreva o serviço que você precisa.')
  }

  // Fotos (opcionais em todas as categorias)
  const s = await getSettings()
  if (d.photos.length > s.max_order_photos) {
    return R.badRequest(res, `Envie no máximo ${s.max_order_photos} fotos.`)
  }
  const photos = await validateOwnedPhotoUrls(d.photos, req.userId)
  if (photos === null) return R.badRequest(res, 'Uma das fotos não foi encontrada. Envie as fotos novamente.')

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

  const locationLabel = [neighborhood, city].filter(Boolean).join(', ')
  const title = `${is_urgent ? '🚨 URGENTE — ' : ''}${category.name} — ${locationLabel || city}`

  // Aplica acréscimo de urgência
  const finalMin = is_urgent ? Math.round(price.min * (1 + URGENCY_FEE_PCT) * 100) / 100 : price.min
  const finalMax = is_urgent ? Math.round(price.max * (1 + URGENCY_FEE_PCT) * 100) / 100 : price.max
  const urgencyFeeValue = is_urgent ? Math.round((finalMax - price.max) * 100) / 100 : null
  const urgencyDeadline = is_urgent ? new Date(Date.now() + URGENCY_DEADLINE_HOURS * 60 * 60 * 1000) : null

  const order = await prisma.order.create({
    data: {
      client_id: req.userId,
      category_id,
      title,
      description: description || undefined,
      answers,
      photos,
      client_request_id,
      desired_date: parsedDate ?? undefined,
      address: address || undefined,
      neighborhood: neighborhood || undefined,
      city,
      state,
      latitude,
      longitude,
      estimated_price_min: finalMin,
      estimated_price_max: finalMax,
      is_urgent,
      urgency_fee_pct: is_urgent ? URGENCY_FEE_PCT : null,
      urgency_fee_value: urgencyFeeValue,
      urgency_deadline: urgencyDeadline,
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

  return R.created(res, order, 'Pedido criado com sucesso')
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

// Blurs coordinates to a ~500m grid cell (0.005° ≈ 555m) and strips exact address
function maskLocationForProvider<T extends { latitude: number | null; longitude: number | null; address: string | null }>(
  order: T
): T & { location_blurred: boolean } {
  const blurredLat = order.latitude != null ? Math.round(order.latitude / 0.005) * 0.005 : null
  const blurredLng = order.longitude != null ? Math.round(order.longitude / 0.005) * 0.005 : null
  return { ...order, address: null, latitude: blurredLat, longitude: blurredLng, location_blurred: true }
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

export async function cancelOrder(req: Request, res: Response) {
  const order = await prisma.order.findUnique({ where: { id: req.params.id } })
  if (!order) return R.notFound(res, 'Pedido não encontrado')
  if (order.client_id !== req.userId) return R.forbidden(res)

  const cancelable = ['OPEN', 'IN_PROPOSAL']
  if (!cancelable.includes(order.status)) {
    return R.badRequest(res, 'Pedido não pode ser cancelado neste estágio. Entre em contato com o suporte.')
  }

  await prisma.order.update({ where: { id: req.params.id }, data: { status: 'CANCELLED' } })
  return R.ok(res, null, 'Pedido cancelado')
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
export async function adminCancelOrder(req: Request, res: Response) {
  const order = await prisma.order.findUnique({ where: { id: req.params.id }, select: { id: true, status: true } })
  if (!order) return R.notFound(res, 'Pedido não encontrado')
  if (['DONE', 'RATED', 'CANCELLED'].includes(order.status)) {
    return R.badRequest(res, `Pedido já está ${order.status} e não pode ser cancelado.`)
  }
  await prisma.order.update({ where: { id: req.params.id }, data: { status: 'CANCELLED' } })
  return R.ok(res, null, 'Pedido cancelado pelo admin')
}
