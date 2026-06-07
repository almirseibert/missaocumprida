import { prisma } from '../../config/database'
import { haversineDistance } from '../../utils/geo'
import { sendToUsers, notify } from '../push/push.service'

const RADIUS_STEP_KM = 5
const RADIUS_MAX_KM = 50
const EXPAND_INTERVAL_MIN = 30

/**
 * Cron: SLA do modo urgência.
 * - Pedidos OPEN/IN_PROPOSAL com is_urgent=true ainda sem proposta aceita:
 *   - Se urgency_deadline expirou → cancela com notificação ao cliente
 *   - Senão se faz >= 30min desde a última expansão e raio < 50km → expande +5km e re-envia push
 */
export async function runUrgencySla(): Promise<{ checked: number; expanded: number; cancelled: number }> {
  const now = Date.now()
  const orders = await prisma.order.findMany({
    where: {
      is_urgent: true,
      status: { in: ['OPEN', 'IN_PROPOSAL'] },
    },
    include: {
      category: { select: { id: true, name: true } },
    },
  })

  let expanded = 0
  let cancelled = 0

  for (const order of orders) {
    // Expirou: cancela e devolve eventual crédito aplicado
    if (order.urgency_deadline && order.urgency_deadline.getTime() <= now) {
      try {
        await prisma.$transaction(async (tx) => {
          await tx.order.update({
            where: { id: order.id },
            data: { status: 'CANCELLED' },
          })
          await tx.proposal.updateMany({
            where: { order_id: order.id, status: 'PENDING' },
            data: { status: 'REJECTED' },
          })
          // Reembolso de crédito aplicado, se houver
          if (order.credit_applied && order.credit_applied > 0) {
            await tx.user.update({
              where: { id: order.client_id },
              data: { credit_balance: { increment: order.credit_applied } },
            })
            await tx.creditTransaction.create({
              data: {
                user_id: order.client_id,
                amount: order.credit_applied,
                reason: 'ADJUSTMENT',
                ref_id: order.id,
              },
            })
          }
        })

        await notify(order.client_id, {
          type: 'GENERAL' as never,
          title: '⏳ Pedido urgente expirado',
          body: `Não encontramos um prestador para "${order.category.name}" no tempo limite. ${
            order.credit_applied && order.credit_applied > 0
              ? `R$ ${order.credit_applied.toFixed(2)} foram devolvidos ao seu saldo.`
              : 'Tente novamente em outro horário.'
          }`,
          channel: 'urgent_orders',
          data: { order_id: order.id, reason: 'URGENCY_EXPIRED' },
        }).catch(() => {})

        cancelled++
      } catch (err) {
        console.error('[urgency-sla] cancel error:', err)
      }
      continue
    }

    // Expande raio se faz >= 30min desde a última expansão (ou criação) e raio < máximo
    const lastExpansion = order.urgency_expanded_at?.getTime() ?? order.created_at.getTime()
    const minutesSince = (now - lastExpansion) / (60 * 1000)
    const currentRadius = order.urgency_radius_km ?? 10

    if (minutesSince >= EXPAND_INTERVAL_MIN && currentRadius < RADIUS_MAX_KM) {
      const newRadius = Math.min(currentRadius + RADIUS_STEP_KM, RADIUS_MAX_KM)
      const newTargets = await findNewProvidersInRing({
        categoryId: order.category_id,
        latitude: order.latitude,
        longitude: order.longitude,
        innerRadius: currentRadius,
        outerRadius: newRadius,
        excludeIds: [order.client_id],
      })

      await prisma.order.update({
        where: { id: order.id },
        data: { urgency_radius_km: newRadius, urgency_expanded_at: new Date() },
      })

      if (newTargets.length > 0) {
        await sendToUsers(newTargets, {
          title: `🚨 URGENTE: ${order.category.name} perto de você!`,
          body: `Cliente precisa em até ${formatHoursLeft(order.urgency_deadline, now)}. Raio ampliado.`,
          data: { order_id: order.id, type: 'NEW_ORDER_NEARBY', urgent: true },
          channel: 'urgent_orders',
        }).catch(() => {})
      }
      expanded++
    }
  }

  return { checked: orders.length, expanded, cancelled }
}

function formatHoursLeft(deadline: Date | null, now: number): string {
  if (!deadline) return '2h'
  const minutes = Math.max(0, Math.round((deadline.getTime() - now) / 60000))
  if (minutes >= 60) return `${Math.floor(minutes / 60)}h${minutes % 60 ? minutes % 60 + 'm' : ''}`
  return `${minutes}min`
}

async function findNewProvidersInRing(params: {
  categoryId: string
  latitude: number | null
  longitude: number | null
  innerRadius: number
  outerRadius: number
  excludeIds: string[]
}): Promise<string[]> {
  const { categoryId, latitude, longitude, innerRadius, outerRadius, excludeIds } = params
  if (latitude == null || longitude == null) return []

  const skills = await prisma.providerSkill.findMany({
    where: { category_id: categoryId, is_active: true, provider_id: { notIn: excludeIds } },
    select: {
      provider_id: true,
      provider: { select: { latitude: true, longitude: true } },
    },
  })

  return skills
    .filter((s) => {
      const plat = s.provider?.latitude
      const plng = s.provider?.longitude
      if (plat == null || plng == null) return false
      const d = haversineDistance(latitude, longitude, plat, plng)
      return d > innerRadius && d <= outerRadius
    })
    .map((s) => s.provider_id)
}
