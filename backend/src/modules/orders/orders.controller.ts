import { Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../../config/database'
import { estimatePrice } from '../../utils/priceEstimator'
import { haversineDistance } from '../../utils/geo'
import { env } from '../../config/env'
import * as R from '../../utils/response'

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
})

export async function createOrder(req: Request, res: Response) {
  const parsed = createOrderSchema.safeParse(req.body)
  if (!parsed.success) return R.badRequest(res, 'Dados inválidos', parsed.error.flatten().fieldErrors)

  const { category_id, description, answers, desired_date, address, neighborhood, city, state, latitude, longitude } = parsed.data

  const category = await prisma.category.findUnique({
    where: { id: category_id },
    include: { questionnaire_fields: true },
  })
  if (!category) return R.notFound(res, 'Categoria não encontrada')

  // Validar campos obrigatórios
  const requiredFields = category.questionnaire_fields.filter(f => f.is_required && f.field_type !== 'PHOTO')
  for (const field of requiredFields) {
    if (!answers[field.id]) {
      return R.badRequest(res, `Campo obrigatório não preenchido: ${field.question}`)
    }
  }

  // Estimar preço
  const priceFields = category.questionnaire_fields.map(f => ({
    affects_price: f.affects_price,
    price_modifier: f.price_modifier as Record<string, number> | null,
  }))
  const price = estimatePrice(category.base_price_min, category.base_price_max, priceFields, answers)

  const locationLabel = [neighborhood, city].filter(Boolean).join(', ')
  const title = `${category.name} — ${locationLabel || city}`

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
      estimated_price_min: price.min,
      estimated_price_max: price.max,
    },
    include: {
      category: { select: { id: true, name: true, icon: true } },
      client: { select: { id: true, name: true, avatar: true } },
    },
  })

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
  const allOrders = await prisma.order.findMany({
    where,
    orderBy: { created_at: 'desc' },
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
    if (!providerHasLocation || order.distance_km == null) return true
    const radius = radiusByCategory.get(order.category_id) ?? 20
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
