import { prisma } from '../../config/database'
import { SubFrequency } from '@prisma/client'

export function computeNextOccurrence(
  frequency: SubFrequency,
  current: Date,
  opts: { weekday?: number | null; day_of_month?: number | null; time_slot: string },
): Date {
  const [hh, mm] = opts.time_slot.split(':').map(Number)
  const base = new Date(current)
  base.setHours(hh, mm, 0, 0)

  if (frequency === 'WEEKLY' || frequency === 'BIWEEKLY') {
    const target = opts.weekday ?? base.getDay()
    const step = frequency === 'WEEKLY' ? 7 : 14
    // avança até atingir o weekday no futuro
    let next = new Date(base)
    while (next.getDay() !== target || next <= current) {
      next.setDate(next.getDate() + 1)
    }
    // garante futuro
    if (next <= current) next.setDate(next.getDate() + step)
    return next
  }

  // MONTHLY
  const day = opts.day_of_month ?? base.getDate()
  const next = new Date(base.getFullYear(), base.getMonth(), day, hh, mm, 0, 0)
  if (next <= current) next.setMonth(next.getMonth() + 1)
  return next
}

// Gera ocorrências dos próximos N dias para assinaturas ativas
export async function generateUpcomingOccurrences(daysAhead = 7) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() + daysAhead)

  const due = await prisma.subscription.findMany({
    where: {
      status: 'ACTIVE',
      next_occurrence: { lte: cutoff },
    },
  })

  let generated = 0
  for (const sub of due) {
    try {
      await prisma.$transaction(async (tx) => {
        const occurrence = await tx.subscriptionOccurrence.create({
          data: {
            subscription_id: sub.id,
            scheduled_for: sub.next_occurrence,
            status: 'GENERATED',
          },
        })
        const finalPrice = round2(sub.base_value * (1 - sub.discount_pct))
        const providerFee = round2(finalPrice * 0.1)
        const providerAmount = round2(finalPrice - providerFee)
        const clientFee = round2(finalPrice * 0.1)
        const clientTotal = round2(finalPrice + clientFee)

        const order = await tx.order.create({
          data: {
            client_id: sub.client_id,
            category_id: sub.category_id,
            title: sub.title,
            description: sub.description,
            answers: sub.answers as any,
            status: 'ACCEPTED',
            desired_date: sub.next_occurrence,
            address: sub.address,
            neighborhood: sub.neighborhood,
            city: sub.city,
            state: sub.state,
            latitude: sub.latitude,
            longitude: sub.longitude,
            estimated_price_min: finalPrice,
            estimated_price_max: finalPrice,
            final_price: finalPrice,
            platform_fee_pct: 0.1,
            platform_fee_value: providerFee,
            provider_amount: providerAmount,
            client_fee_pct: 0.1,
            client_fee_value: clientFee,
            client_total: clientTotal,
            subscription_id: sub.id,
            subscription_occurrence_id: occurrence.id,
          },
        })
        const proposal = await tx.proposal.create({
          data: {
            order_id: order.id,
            provider_id: sub.provider_id,
            value: finalPrice,
            message: `Ocorrência de assinatura: ${sub.title}`,
            status: 'ACCEPTED',
          },
        })
        await tx.schedule.create({
          data: {
            order_id: order.id,
            proposal_id: proposal.id,
            provider_id: sub.provider_id,
            client_id: sub.client_id,
            scheduled_at: sub.next_occurrence,
          },
        })

        // calcula próxima ocorrência
        const next = computeNextOccurrence(sub.frequency, sub.next_occurrence, {
          weekday: sub.weekday,
          day_of_month: sub.day_of_month,
          time_slot: sub.time_slot,
        })
        await tx.subscription.update({
          where: { id: sub.id },
          data: { next_occurrence: next },
        })
      })
      generated++
    } catch (err: any) {
      console.error(`[subscriptions] falha ao gerar ocorrência da assinatura ${sub.id}:`, err.message)
      await prisma.subscriptionOccurrence.create({
        data: {
          subscription_id: sub.id,
          scheduled_for: sub.next_occurrence,
          status: 'FAILED',
          reason: err.message?.slice(0, 200),
        },
      }).catch(() => {})
    }
  }
  return { generated, total: due.length }
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}
