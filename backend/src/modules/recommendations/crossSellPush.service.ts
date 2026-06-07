import { prisma } from '../../config/database'
import { notify } from '../push/push.service'

const MAX_PER_SCHEDULE = 1
const LOOK_BACK_DAYS = 60

/**
 * Cron: para cada Schedule concluído nos últimos N dias, dispara push de cross-sell
 * para as categorias com afinidade quando o delay_days da afinidade já foi atingido.
 * Idempotente via Notification (data->>'cross_sell_key' = `${schedule_id}:${target_slug}`).
 */
export async function runCrossSellPushSweep(): Promise<{ scanned: number; sent: number }> {
  const since = new Date(Date.now() - LOOK_BACK_DAYS * 24 * 60 * 60 * 1000)
  const schedules = await prisma.schedule.findMany({
    where: {
      status: { in: ['DONE'] },
      done_at: { gte: since, not: null },
    },
    include: {
      order: {
        include: { category: { select: { slug: true, name: true } } },
      },
    },
  })

  let sent = 0
  for (const schedule of schedules) {
    if (!schedule.done_at || !schedule.order?.category?.slug) continue
    const affinities = await prisma.categoryAffinity.findMany({
      where: { source_category: schedule.order.category.slug },
      orderBy: { score: 'desc' },
      take: 3,
    })
    if (affinities.length === 0) continue

    let sentForThisSchedule = 0
    for (const aff of affinities) {
      if (sentForThisSchedule >= MAX_PER_SCHEDULE) break
      const minDoneAt = new Date(schedule.done_at.getTime() + aff.delay_days * 24 * 60 * 60 * 1000)
      if (Date.now() < minDoneAt.getTime()) continue

      const key = `${schedule.id}:${aff.target_category}`
      const existing = await prisma.notification.findFirst({
        where: {
          user_id: schedule.client_id,
          data: { path: ['cross_sell_key'], equals: key } as any,
        },
        select: { id: true },
      })
      if (existing) continue

      const targetCat = await prisma.category.findUnique({
        where: { slug: aff.target_category },
        select: { name: true, icon: true, slug: true },
      })
      if (!targetCat) continue

      await notify(schedule.client_id, {
        type: 'GENERAL' as never,
        title: `${targetCat.icon || '💡'} Que tal contratar ${targetCat.name}?`,
        body: aff.label,
        channel: 'cross_sell',
        data: {
          cross_sell_key: key,
          schedule_id: schedule.id,
          category_slug: targetCat.slug,
        },
      }).catch((err) => console.error('[cross-sell] notify err:', err))
      sent++
      sentForThisSchedule++
    }
  }
  return { scanned: schedules.length, sent }
}
