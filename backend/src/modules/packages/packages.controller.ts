import { Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../../config/database'
import * as R from '../../utils/response'
import { haversineDistance, distanceBucket } from '../../utils/geo'
import { env } from '../../config/env'
import { getSettings } from '../settings/settings.service'
import { acceptedOrderFields, createFeesOnAccept } from '../payments/connectionFees.service'
import { notify } from '../push/push.service'

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

// latitude/longitude do prestador são usadas só no servidor (filtro de raio);
// nunca saem na resposta — as rotas de pacote são públicas.
function publicPackage<T extends { provider?: Record<string, unknown> | null }>(pkg: T): T {
  if (!pkg.provider) return pkg
  const { latitude: _lat, longitude: _lng, ...provider } = pkg.provider
  return { ...pkg, provider }
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
  return R.created(res, publicPackage(pkg), 'Pacote criado')
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
    const withDistance = packages
      .map((p) => {
        const plat = p.provider?.latitude
        const plng = p.provider?.longitude
        const exact = plat == null || plng == null ? null : haversineDistance(flat, flng, plat, plng)
        return { pkg: p, exact }
      })
      .filter((x) => x.exact == null || x.exact <= r)
      .sort((a, b) => (a.exact ?? 999) - (b.exact ?? 999))
    return R.ok(
      res,
      withDistance.map(({ pkg, exact }) => ({
        ...publicPackage(pkg),
        ...(exact == null ? { distance_km: null, distance_label: null } : distanceBucket(exact)),
      })),
    )
  }
  packages = packages.sort((a, b) => score(b) - score(a))
  return R.ok(res, packages.map(publicPackage))
}

// GET /api/packages/:id
export async function getPackage(req: Request, res: Response) {
  const pkg = await prisma.servicePackage.findUnique({
    where: { id: req.params.id },
    select: packageSelect,
  })
  if (!pkg) return R.notFound(res, 'Pacote não encontrado')
  return R.ok(res, publicPackage(pkg))
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
  return R.ok(res, pkgs.map(publicPackage))
}

// GET /api/packages/mine — pacotes do prestador autenticado (inclui inativos)
export async function listMyPackages(req: Request, res: Response) {
  const pkgs = await prisma.servicePackage.findMany({
    where: { provider_id: req.userId! },
    orderBy: { created_at: 'desc' },
    select: packageSelect,
  })
  return R.ok(res, pkgs.map(publicPackage))
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
  return R.ok(res, publicPackage(updated))
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
  state: z.string().length(2).default('SP'),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
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
  if (!pkg.provider.is_active) return R.badRequest(res, 'Este profissional não está disponível no momento.')

  // Mesmo modelo do aceite de proposta: taxas de conexão vigentes (admin)
  const s = await getSettings()
  const financials = acceptedOrderFields(s, pkg.price)

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
        desired_date: desiredDate,
        address: parsed.data.address || undefined,
        neighborhood: parsed.data.neighborhood || undefined,
        city: parsed.data.city,
        state: parsed.data.state,
        latitude: parsed.data.latitude,
        longitude: parsed.data.longitude,
        estimated_price_min: pkg.price,
        estimated_price_max: pkg.price,
        ...financials,                      // pula etapa OPEN/proposals
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
    // Sem isso a tela de pagamento não encontrava a taxa ("Taxa não encontrada")
    if (env.FEES_ENABLED) {
      await createFeesOnAccept(tx, s, {
        order_id: order.id,
        proposal_id: proposal.id,
        client_id: req.userId!,
        provider_id: pkg.provider_id,
        value: pkg.price,
      })
    }
    await tx.servicePackage.update({
      where: { id: pkg.id },
      data: { purchases_count: { increment: 1 } },
    })
    return order
  })

  await notify(pkg.provider_id, {
    type: 'PROPOSAL_ACCEPTED',
    title: 'Seu pacote foi contratado!',
    body: env.FEES_ENABLED
      ? `Um cliente contratou "${pkg.title}". Assim que ele pagar a taxa de conexão, você paga a sua e o contato é liberado.`
      : `Um cliente contratou "${pkg.title}". O agendamento foi confirmado.`,
    data: { order_id: result.id },
    channel: 'proposal_update',
  }).catch(() => {})

  return R.created(res, {
    order_id: result.id,
    final_price: pkg.price,
    client_total: financials.client_total,
    payment_required: env.FEES_ENABLED,
  }, 'Pacote contratado! Realize o pagamento para confirmar.')
}
