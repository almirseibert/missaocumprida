import { Request, Response } from 'express'
import { prisma } from '../../config/database'
import * as R from '../../utils/response'

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000'

function makeSlug(title: string): string {
  const base = (title || 'pedido')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
  const rand = Math.random().toString(36).slice(2, 8)
  return `${base}-${rand}`
}

// POST /api/orders/:id/share — habilita compartilhamento e devolve slug + url
export async function enableShare(req: Request, res: Response) {
  const order = await prisma.order.findUnique({ where: { id: req.params.id } })
  if (!order) return R.notFound(res, 'Pedido não encontrado')
  if (order.client_id !== req.userId) return R.forbidden(res)
  if (!['OPEN', 'IN_PROPOSAL'].includes(order.status)) {
    return R.badRequest(res, 'Só é possível compartilhar pedidos abertos ou em proposta.')
  }

  let slug = order.public_share_slug
  if (!slug) {
    // tenta até 5x evitar colisão
    for (let i = 0; i < 5; i++) {
      const candidate = makeSlug(order.title)
      const exists = await prisma.order.findUnique({ where: { public_share_slug: candidate } })
      if (!exists) { slug = candidate; break }
    }
    if (!slug) slug = `pedido-${order.id.slice(0, 8)}`
  }

  await prisma.order.update({
    where: { id: order.id },
    data: { public_share_slug: slug, public_share_enabled: true },
  })

  return R.ok(res, {
    slug,
    url: `${FRONTEND_URL}/p/pedido/${slug}`,
    deep_link: `missaocumprida://pedido/${slug}`,
  })
}

// DELETE /api/orders/:id/share — desativa compartilhamento (mantém slug histórico)
export async function disableShare(req: Request, res: Response) {
  const order = await prisma.order.findUnique({ where: { id: req.params.id } })
  if (!order) return R.notFound(res, 'Pedido não encontrado')
  if (order.client_id !== req.userId) return R.forbidden(res)
  await prisma.order.update({
    where: { id: order.id },
    data: { public_share_enabled: false },
  })
  return R.ok(res, null, 'Compartilhamento desativado')
}

// GET /api/public/orders/:slug — landing pública (sem auth)
export async function getPublicOrder(req: Request, res: Response) {
  const order = await prisma.order.findUnique({
    where: { public_share_slug: req.params.slug },
    select: {
      id: true, title: true, description: true, neighborhood: true, city: true, state: true,
      desired_date: true, estimated_price_min: true, estimated_price_max: true,
      photos: true, status: true, public_share_enabled: true,
      created_at: true,
      category: { select: { id: true, name: true, slug: true, icon: true, pricing_unit: true } },
      client: { select: { name: true, avatar: true, rating_avg: true, rating_count: true } },
      _count: { select: { proposals: true } },
    },
  })
  if (!order) return R.notFound(res, 'Pedido não encontrado')
  if (!order.public_share_enabled) return R.notFound(res, 'Compartilhamento desativado')
  if (!['OPEN', 'IN_PROPOSAL'].includes(order.status)) {
    return R.badRequest(res, 'Este pedido não está mais aberto.')
  }

  // Incrementa contador (best effort, sem aguardar)
  prisma.order.update({
    where: { id: order.id },
    data: { public_view_count: { increment: 1 } },
  }).catch(() => {})

  // Mascara dados sensíveis: só primeiro nome do cliente, sem endereço completo
  const firstName = order.client.name.split(' ')[0]

  return R.ok(res, {
    id: order.id,
    title: order.title,
    description: order.description,
    category: order.category,
    location: { neighborhood: order.neighborhood, city: order.city, state: order.state },
    desired_date: order.desired_date,
    estimated_price_min: order.estimated_price_min,
    estimated_price_max: order.estimated_price_max,
    photos: order.photos,
    status: order.status,
    created_at: order.created_at,
    proposals_count: order._count.proposals,
    client: {
      first_name: firstName,
      avatar: order.client.avatar,
      rating_avg: order.client.rating_avg,
      rating_count: order.client.rating_count,
    },
  })
}
