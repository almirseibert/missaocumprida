import { Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../../config/database'
import * as R from '../../utils/response'
import { haversineDistance } from '../../utils/geo'

const createSchema = z.object({
  category_id: z.string().uuid(),
  title: z.string().min(3).max(120),
  description: z.string().min(10).max(2000),
  price: z.number().positive(),
  duration_min: z.number().int().positive().default(60),
  includes: z.array(z.string().max(120)).max(20).default([]),
  photos: z.array(z.string().url()).max(8).default([]),
})

const updateSchema = createSchema.partial().extend({
  is_active: z.boolean().optional(),
})

const packageSelect = {
  id: true, title: true, description: true, price: true,
  duration_min: true, includes: true, photos: true, is_active: true,
  purchases_count: true, rating_avg: true, created_at: true,
  category: { select: { id: true, name: true, slug: true, icon: true } },
  provider: {
    select: {
      id: true, name: true, avatar: true, bio: true,
      rating_avg: true, rating_count: true, is_verified_pro: true,
      latitude: true, longitude: true,
    },
  },
}

// POST /api/packages — prestador cria pacote
export async function createPackage(req: Request, res: Response) {
  const parsed = createSchema.safeParse(req.body)
  if (!parsed.success) return R.badRequest(res, 'Dados inválidos', parsed.error.flatten().fieldErrors)

  // Verifica se o prestador tem skill nessa categoria
  const hasSkill = await prisma.providerSkill.findFirst({
    where: { provider_id: req.userId, category_id: parsed.data.category_id, is_active: true },
  })
  if (!hasSkill) {
    return R.badRequest(res, 'Cadastre a habilidade desta categoria antes de criar um pacote.')
  }

  const pkg = await prisma.servicePackage.create({
    data: { ...parsed.data, provider_id: req.userId! },
    select: packageSelect,
  })
  return R.created(res, pkg, 'Pacote criado')
}

// GET /api/packages?category=&lat=&lng=&radius=&min=&max=&verified_only=1
export async function listPackages(req: Request, res: Response) {
  const { category, lat, lng, radius, min, max, verified_only } = req.query as Record<string, string>
  const verifiedOnly = verified_only === '1' || verified_only === 'true'

  const where: any = { is_active: true }
  if (category) where.category = { slug: category }
  if (min) where.price = { ...(where.price ?? {}), gte: Number(min) }
  if (max) where.price = { ...(where.price ?? {}), lte: Number(max) }
  if (verifiedOnly) where.provider = { is_verified_pro: true }

  let packages = await prisma.servicePackage.findMany({
    where,
    orderBy: [
      { provider: { is_verified_pro: 'desc' } },
      { purchases_count: 'desc' },
      { rating_avg: 'desc' },
      { created_at: 'desc' },
    ],
    take: 100,
    select: packageSelect,
  })

  // Pacotes de Verified Pro publicados nos últimos 7 dias ficam em destaque grátis
  const NOW = Date.now()
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000
  packages = packages.map((p: any) => {
    const isNewProPkg =
      p.provider?.is_verified_pro &&
      p.created_at &&
      NOW - new Date(p.created_at).getTime() <= SEVEN_DAYS_MS
    return { ...p, is_pro_highlighted: !!isNewProPkg }
  })

  // Reordena pacotes aplicando boost de 1.3x para Verified Pro e +50% se em destaque grátis
  const score = (p: any) =>
    (p.purchases_count ?? 0) *
      (p.provider?.is_verified_pro ? 1.3 : 1) *
      (p.is_pro_highlighted ? 1.5 : 1) +
    (p.rating_avg ?? 0) * 0.5 +
    (p.is_pro_highlighted ? 2 : 0)

  // Filtro de raio quando lat/lng informados
  if (lat && lng) {
    const r = Number(radius || '50')
    const flat = parseFloat(lat), flng = parseFloat(lng)
    packages = packages
      .map((p) => {
        const plat = p.provider?.latitude
        const plng = p.provider?.longitude
        if (plat == null || plng == null) return { ...p, distance_km: null }
        const d = haversineDistance(flat, flng, plat, plng)
        return { ...p, distance_km: Math.round(d * 10) / 10 }
      })
      .filter((p) => p.distance_km == null || p.distance_km <= r)
      .sort((a, b) => (a.distance_km ?? 999) - (b.distance_km ?? 999))
  } else {
    packages = packages.sort((a, b) => score(b) - score(a))
  }
  return R.ok(res, packages)
}

// GET /api/packages/:id
export async function getPackage(req: Request, res: Response) {
  const pkg = await prisma.servicePackage.findUnique({
    where: { id: req.params.id },
    select: packageSelect,
  })
  if (!pkg) return R.notFound(res, 'Pacote não encontrado')
  return R.ok(res, pkg)
}

// GET /api/users/:providerId/packages
export async function listProviderPackages(req: Request, res: Response) {
  const onlyActive = req.params.providerId !== req.userId
  const pkgs = await prisma.servicePackage.findMany({
    where: {
      provider_id: req.params.providerId,
      ...(onlyActive ? { is_active: true } : {}),
    },
    orderBy: { created_at: 'desc' },
    select: packageSelect,
  })
  return R.ok(res, pkgs)
}

// GET /api/packages/mine — pacotes do prestador autenticado (inclui inativos)
export async function listMyPackages(req: Request, res: Response) {
  const pkgs = await prisma.servicePackage.findMany({
    where: { provider_id: req.userId! },
    orderBy: { created_at: 'desc' },
    select: packageSelect,
  })
  return R.ok(res, pkgs)
}

// PATCH /api/packages/:id
export async function updatePackage(req: Request, res: Response) {
  const parsed = updateSchema.safeParse(req.body)
  if (!parsed.success) return R.badRequest(res, 'Dados inválidos', parsed.error.flatten().fieldErrors)

  const existing = await prisma.servicePackage.findUnique({ where: { id: req.params.id } })
  if (!existing) return R.notFound(res, 'Pacote não encontrado')
  if (existing.provider_id !== req.userId) return R.forbidden(res)

  const updated = await prisma.servicePackage.update({
    where: { id: req.params.id },
    data: parsed.data,
    select: packageSelect,
  })
  return R.ok(res, updated)
}

// DELETE /api/packages/:id
export async function deletePackage(req: Request, res: Response) {
  const existing = await prisma.servicePackage.findUnique({ where: { id: req.params.id } })
  if (!existing) return R.notFound(res, 'Pacote não encontrado')
  if (existing.provider_id !== req.userId) return R.forbidden(res)

  // Se já houve compras, apenas desativa
  if (existing.purchases_count > 0) {
    await prisma.servicePackage.update({ where: { id: existing.id }, data: { is_active: false } })
    return R.ok(res, null, 'Pacote desativado (havia compras anteriores).')
  }
  await prisma.servicePackage.delete({ where: { id: existing.id } })
  return R.noContent(res)
}

// POST /api/packages/:id/purchase — cliente contrata pacote
const purchaseSchema = z.object({
  desired_date: z.string().datetime().optional(),
  address: z.string().optional().default(''),
  neighborhood: z.string().optional().default(''),
  city: z.string().min(2),
  state: z.string().default('SP'),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  notes: z.string().max(1000).optional(),
})

export async function purchasePackage(req: Request, res: Response) {
  const parsed = purchaseSchema.safeParse(req.body)
  if (!parsed.success) return R.badRequest(res, 'Dados inválidos', parsed.error.flatten().fieldErrors)
  const pkg = await prisma.servicePackage.findUnique({
    where: { id: req.params.id },
    include: { category: true, provider: true },
  })
  if (!pkg) return R.notFound(res, 'Pacote não encontrado')
  if (!pkg.is_active) return R.badRequest(res, 'Este pacote não está mais disponível.')
  if (pkg.provider_id === req.userId) return R.badRequest(res, 'Você não pode contratar seu próprio pacote.')

  const PROVIDER_FEE_PCT = 0.10
  const CLIENT_FEE_PCT = 0.10
  const providerFeeValue = Math.round(pkg.price * PROVIDER_FEE_PCT * 100) / 100
  const providerAmount = Math.round((pkg.price - providerFeeValue) * 100) / 100
  const clientFeeValue = Math.round(pkg.price * CLIENT_FEE_PCT * 100) / 100
  const clientTotal = Math.round((pkg.price + clientFeeValue) * 100) / 100

  const title = `${pkg.title} — ${parsed.data.city}`
  const desiredDate = parsed.data.desired_date ? new Date(parsed.data.desired_date) : new Date()

  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        client_id: req.userId!,
        category_id: pkg.category_id,
        title,
        description: parsed.data.notes,
        answers: {} as any,
        status: 'ACCEPTED',                 // pula etapa OPEN/proposals
        desired_date: desiredDate,
        address: parsed.data.address || undefined,
        neighborhood: parsed.data.neighborhood || undefined,
        city: parsed.data.city,
        state: parsed.data.state,
        latitude: parsed.data.latitude,
        longitude: parsed.data.longitude,
        estimated_price_min: pkg.price,
        estimated_price_max: pkg.price,
        final_price: pkg.price,
        platform_fee_pct: PROVIDER_FEE_PCT,
        platform_fee_value: providerFeeValue,
        provider_amount: providerAmount,
        client_fee_pct: CLIENT_FEE_PCT,
        client_fee_value: clientFeeValue,
        client_total: clientTotal,
        package_id: pkg.id,
      },
    })
    // Cria proposta "fantasma" do prestador (já aceita) para manter o pipeline
    const proposal = await tx.proposal.create({
      data: {
        order_id: order.id,
        provider_id: pkg.provider_id,
        value: pkg.price,
        message: `Contrato direto do pacote: ${pkg.title}`,
        status: 'ACCEPTED',
      },
    })
    // Cria agendamento
    await tx.schedule.create({
      data: {
        order_id: order.id,
        proposal_id: proposal.id,
        provider_id: pkg.provider_id,
        client_id: req.userId!,
        scheduled_at: desiredDate,
      },
    })
    await tx.servicePackage.update({
      where: { id: pkg.id },
      data: { purchases_count: { increment: 1 } },
    })
    return order
  })

  return R.created(res, {
    order_id: result.id,
    final_price: pkg.price,
    client_total: clientTotal,
    payment_required: true,
  }, 'Pacote contratado! Realize o pagamento para confirmar.')
}
