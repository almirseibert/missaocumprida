import { Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../../config/database'
import { estimatePriceDynamic } from '../../utils/priceEstimator'
import { haversineDistance } from '../../utils/geo'
import { env } from '../../config/env'
import * as R from '../../utils/response'
import { sendToUsers } from '../push/push.service'

const createOrderSchema = z.object({
  category_id: z.string().uuid(),
  description: z.string().optional(),
  answers: z.record(z.string()),
  desired_date: z.string().datetime().optional(),
  address: z.string().optional().default(''),
  neighborhood: z.string().optional().default(''),
  city: z.string().optional().default(''),
  state: z.string().length(2).default('SP'),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  is_urgent: z.boolean().optional().default(false),
  urgency_radius_km: z.number().int().min(1).max(50).optional(),
})

const URGENCY_FEE_PCT = 0.25 // 25% sobre o preço estimado
const URGENCY_DEADLINE_HOURS = 2
const URGENCY_DEFAULT_RADIUS_KM = 10

export async function createOrder(req: Request, res: Response) {
  const parsed = createOrderSchema.safeParse(req.body)
  if (!parsed.success) return R.badRequest(res, 'Dados inválidos', parsed.error.flatten().fieldErrors)

  const { category_id, description, answers, desired_date, address, neighborhood, city, state, is_urgent, urgency_radius_km } = parsed.data
  let { latitude, longitude } = parsed.data

  const category = await prisma.category.findUnique({
    where: { id: category_id },
    include: { questionnaire_fields: true },
  })
  if (!category) return R.notFound(res, 'Categoria não encontrada')

  // Fallback: se o cliente não enviou coordenadas no formulário, herda do perfil
  if (latitude == null || longitude == null) {
    const client = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { latitude: true, longitude: true },
    })
    if (client?.latitude != null && client?.longitude != null) {
      latitude = client.latitude
      longitude = client.longitude
    }
  }

  // Validar campos obrigatórios
  const requiredFields = category.questionnaire_fields.filter(f => f.is_required && f.field_type !== 'PHOTO')
  for (const field of requiredFields) {
    if (!answers[field.id]) {
      return R.badRequest(res, `Campo obrigatório não preenchido: ${field.question}`)
    }
  }

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
      description,
      answers,
      desired_date: desired_date ? new Date(desired_date) : undefined,
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

export async function listMyOrders(req: Request, res: Response) {
  const { status, page = '1', limit = '10' } = req.query
  const skip = (parseInt(page as string) - 1) * parseInt(limit as string)

  const where: Record<string, unknown> = { client_id: req.userId }
  if (status) where.status = status

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip,
      take: parseInt(limit as string),
      include: {
        category: { select: { id: true, name: true, icon: true } },
        proposals: { select: { id: true, status: true } },
        schedule: { select: { id: true, status: true, scheduled_at: true } },
      },
    }),
    prisma.order.count({ where }),
  ])

  return R.ok(res, { orders, total, page: parseInt(page as string), limit: parseInt(limit as string) })
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
  const { page = '1', limit = '10', city } = req.query
  const pageNum = parseInt(page as string)
  const limitNum = parseInt(limit as string)

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

  const where: Record<string, unknown> = {
    status: 'OPEN',
    category_id: { in: categoryIds },
    client_id: { not: req.userId },
  }
  if (city) where.city = { contains: city as string, mode: 'insensitive' }

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
  // Feed always shows pre-acceptance orders — always mask sensitive location
  const paginated = filtered
    .slice((pageNum - 1) * limitNum, pageNum * limitNum)
    .map(maskLocationForProvider)

  return R.ok(res, {
    orders: paginated,
    total,
    page: pageNum,
    limit: limitNum,
    provider_has_location: providerHasLocation,
  })
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

  if (!isClient && !isProposalProvider) {
    // Unknown visitor — return minimal public view with masked location
    const { proposals: _, ...publicOrder } = order
    return R.ok(res, PRE_ACCEPTANCE_STATUSES.includes(order.status)
      ? maskLocationForProvider(publicOrder)
      : publicOrder)
  }

  if (!isClient && !isAcceptedProvider && PRE_ACCEPTANCE_STATUSES.includes(order.status)) {
    // Provider sent a proposal but it hasn't been accepted yet — mask location
    const { proposals, ...rest } = order
    return R.ok(res, { ...maskLocationForProvider(rest), proposals })
  }

  return R.ok(res, order)
}

export async function uploadOrderPhotos(req: Request, res: Response) {
  const order = await prisma.order.findUnique({ where: { id: req.params.id } })
  if (!order) return R.notFound(res, 'Pedido não encontrado')
  if (order.client_id !== req.userId) return R.forbidden(res)
  if (!req.files || !Array.isArray(req.files)) return R.badRequest(res, 'Nenhuma foto enviada')

  const urls = (req.files as Express.Multer.File[]).map(f => `${env.API_URL}/uploads/${f.filename}`)
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
