import { Request, Response } from 'express'
import { prisma } from '../../config/database'
import * as R from '../../utils/response'
import { haversineDistance } from '../../utils/geo'

// GET /api/recommendations/recent-providers — prestadores que o cliente já contratou (top 3)
export async function recentProviders(req: Request, res: Response) {
  const schedules = await prisma.schedule.findMany({
    where: { client_id: req.userId, status: { in: ['DONE', 'IN_PROGRESS', 'CONFIRMED'] } },
    orderBy: { scheduled_at: 'desc' },
    take: 30,
    select: {
      provider_id: true,
      scheduled_at: true,
      order: { select: { category: { select: { id: true, name: true, slug: true, icon: true } } } },
      provider: {
        select: {
          id: true, name: true, avatar: true,
          rating_avg: true, rating_count: true, is_verified_pro: true,
        },
      },
    },
  })

  const seen = new Map<string, any>()
  for (const s of schedules) {
    if (!s.provider) continue
    if (!seen.has(s.provider_id)) {
      seen.set(s.provider_id, {
        provider: s.provider,
        last_category: s.order?.category ?? null,
        last_used_at: s.scheduled_at,
      })
    }
    if (seen.size >= 3) break
  }
  return R.ok(res, Array.from(seen.values()))
}

// GET /api/recommendations/after-order/:orderId — sugere serviços complementares
export async function afterOrder(req: Request, res: Response) {
  const order = await prisma.order.findUnique({
    where: { id: req.params.orderId },
    include: { category: { select: { slug: true, name: true } } },
  })
  if (!order) return R.notFound(res, 'Pedido não encontrado')
  if (order.client_id !== req.userId) return R.forbidden(res)

  const affinities = await prisma.categoryAffinity.findMany({
    where: { source_category: order.category.slug },
    orderBy: { score: 'desc' },
    take: 3,
  })
  if (affinities.length === 0) return R.ok(res, { suggestions: [] })

  // Para cada categoria sugerida, pega top 3 prestadores próximos
  const suggestions = await Promise.all(
    affinities.map(async (a) => {
      const cat = await prisma.category.findUnique({
        where: { slug: a.target_category },
        select: { id: true, name: true, slug: true, icon: true, base_price_min: true, base_price_max: true },
      })
      if (!cat) return null

      // Top providers nessa categoria
      const skills = await prisma.providerSkill.findMany({
        where: { category_id: cat.id, is_active: true },
        include: {
          provider: {
            select: {
              id: true, name: true, avatar: true,
              rating_avg: true, rating_count: true,
              is_verified_pro: true,
              latitude: true, longitude: true,
            },
          },
        },
        take: 30,
      })

      let providers = skills
        .map((s) => s.provider)
        .filter((p) => p != null)
      if (order.latitude && order.longitude) {
        providers = providers
          .map((p) => ({
            ...p,
            distance_km: p.latitude != null && p.longitude != null
              ? Math.round(haversineDistance(order.latitude!, order.longitude!, p.latitude, p.longitude) * 10) / 10
              : null,
          }))
          .sort((a: any, b: any) => {
            const da = a.distance_km ?? 999
            const db = b.distance_km ?? 999
            if (da !== db) return da - db
            return (b.rating_avg ?? 0) - (a.rating_avg ?? 0)
          })
          .slice(0, 3)
      } else {
        providers = providers
          .sort((a, b) => (b.rating_avg ?? 0) - (a.rating_avg ?? 0))
          .slice(0, 3)
      }

      return {
        category: cat,
        label: a.label,
        score: a.score,
        delay_days: a.delay_days,
        providers,
      }
    }),
  )

  return R.ok(res, {
    source: order.category,
    suggestions: suggestions.filter(Boolean),
  })
}
