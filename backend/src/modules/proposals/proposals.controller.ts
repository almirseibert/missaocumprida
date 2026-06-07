import { Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../../config/database'
import { env } from '../../config/env'
import * as R from '../../utils/response'
import { notify } from '../push/push.service'

const createSchema = z.object({
  value: z.number().positive('Valor deve ser positivo'),
  message: z.string().max(1000).optional(),
})

export async function createProposal(req: Request, res: Response) {
  const parsed = createSchema.safeParse(req.body)
  if (!parsed.success) return R.badRequest(res, 'Dados inválidos', parsed.error.flatten().fieldErrors)

  const order = await prisma.order.findUnique({ where: { id: req.params.orderId } })
  if (!order) return R.notFound(res, 'Pedido não encontrado')
  if (!['OPEN', 'IN_PROPOSAL'].includes(order.status)) {
    return R.badRequest(res, 'Este pedido não está aceitando propostas')
  }
  if (order.client_id === req.userId) {
    return R.badRequest(res, 'Você não pode fazer proposta no seu próprio pedido')
  }

  // Verifica se o prestador tem a habilidade cadastrada
  const skill = await prisma.providerSkill.findFirst({
    where: { provider_id: req.userId, category_id: order.category_id, is_active: true },
  })
  if (!skill) {
    return R.forbidden(res, 'Cadastre a habilidade correspondente antes de fazer uma proposta')
  }

  // Verifica se já enviou proposta
  const existing = await prisma.proposal.findUnique({
    where: { order_id_provider_id: { order_id: order.id, provider_id: req.userId } },
  })
  if (existing) return R.conflict(res, 'Você já enviou uma proposta para este pedido')

  if (parsed.data.value < 10) {
    return R.badRequest(res, 'O valor mínimo para uma proposta é R$ 10,00')
  }

  // Verified Pro: boost gratuito de nível 1 em toda proposta
  const provider = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { is_verified_pro: true },
  })
  const freeBoost = provider?.is_verified_pro
    ? { boost_level: 1, boost_paid_at: new Date(), boost_value: 0 }
    : {}

  const proposal = await prisma.proposal.create({
    data: { order_id: order.id, provider_id: req.userId, ...parsed.data, ...freeBoost },
    include: {
      provider: { select: { id: true, name: true, avatar: true, rating_avg: true, rating_count: true, bio: true, is_verified_pro: true } },
    },
  })

  // Atualiza status do pedido
  if (order.status === 'OPEN') {
    await prisma.order.update({ where: { id: order.id }, data: { status: 'IN_PROPOSAL' } })
  }

  // Notify client about new proposal
  await notify(order.client_id, {
    type: 'PROPOSAL_RECEIVED',
    title: 'Nova proposta recebida!',
    body: `Você recebeu uma nova proposta para "${order.title}".`,
    data: { order_id: order.id },
    channel: 'new_proposal',
  })

  return R.created(res, proposal, 'Proposta enviada com sucesso')
}

export async function listOrderProposals(req: Request, res: Response) {
  const order = await prisma.order.findUnique({ where: { id: req.params.orderId } })
  if (!order) return R.notFound(res, 'Pedido não encontrado')
  if (order.client_id !== req.userId) return R.forbidden(res)

  const verifiedOnly = req.query.verified_only === '1' || req.query.verified_only === 'true'

  const proposals = await prisma.proposal.findMany({
    where: {
      order_id: req.params.orderId,
      ...(verifiedOnly ? { provider: { is_verified_pro: true } } : {}),
    },
    include: {
      provider: {
        select: {
          id: true, name: true, avatar: true, bio: true,
          rating_avg: true, rating_count: true, document_verified: true, is_verified_pro: true,
          provider_skills: {
            where: { category_id: order.category_id },
            select: { years_experience: true, certification: true },
          },
        },
      },
    },
    orderBy: [
      { boost_level: 'desc' },
      { provider: { is_verified_pro: 'desc' } },
      { created_at: 'asc' },
    ],
  })

  return R.ok(res, proposals)
}

// POST /api/proposals/:id/boost — prestador destaca sua proposta
const boostSchema = z.object({
  level: z.number().int().min(1).max(2),
})

const BOOST_PRICES: Record<number, number> = { 1: 5, 2: 15 }

export async function boostProposal(req: Request, res: Response) {
  const parsed = boostSchema.safeParse(req.body)
  if (!parsed.success) return R.badRequest(res, 'Dados inválidos', parsed.error.flatten().fieldErrors)

  const proposal = await prisma.proposal.findUnique({
    where: { id: req.params.id },
    include: { provider: { select: { id: true, provider_balance: true, is_verified_pro: true } } },
  })
  if (!proposal) return R.notFound(res, 'Proposta não encontrada')
  if (proposal.provider_id !== req.userId) return R.forbidden(res)
  if (proposal.status !== 'PENDING') return R.badRequest(res, 'Só é possível destacar propostas pendentes')
  if (proposal.boost_level >= parsed.data.level) {
    return R.badRequest(res, 'Sua proposta já está em nível igual ou superior')
  }

  const isProFreeLevel1 = parsed.data.level === 1 && proposal.provider?.is_verified_pro
  const price = isProFreeLevel1 ? 0 : BOOST_PRICES[parsed.data.level]
  if (!isProFreeLevel1 && (!proposal.provider || (proposal.provider.provider_balance ?? 0) < price)) {
    return R.badRequest(res, `Saldo insuficiente. É necessário R$ ${price.toFixed(2)} para esse nível.`)
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (price > 0) {
      await tx.user.update({
        where: { id: proposal.provider_id },
        data: { provider_balance: { decrement: price } },
      })
    }
    await tx.boostPurchase.create({
      data: {
        provider_id: proposal.provider_id,
        proposal_id: proposal.id,
        level: parsed.data.level,
        value: price,
        payment_ref: isProFreeLevel1 ? 'VERIFIED_PRO_FREE' : 'INTERNAL_BALANCE',
      },
    })
    return tx.proposal.update({
      where: { id: proposal.id },
      data: {
        boost_level: parsed.data.level,
        boost_paid_at: new Date(),
        boost_value: price,
      },
    })
  })
  return R.ok(res, updated, 'Proposta destacada!')
}

export async function acceptProposal(req: Request, res: Response) {
  const proposal = await prisma.proposal.findUnique({
    where: { id: req.params.id },
    include: { order: true },
  })
  if (!proposal) return R.notFound(res, 'Proposta não encontrada')
  if (proposal.order.client_id !== req.userId) return R.forbidden(res)
  if (proposal.status !== 'PENDING') return R.badRequest(res, 'Esta proposta não pode mais ser aceita')

  const PROVIDER_FEE_PCT = 0.10
  const CLIENT_FEE_PCT = 0.10
  const URGENCY_FEE_PCT = 0.25 // taxa total sobre proposta urgente

  const providerFeeValue = Math.round(proposal.value * PROVIDER_FEE_PCT * 100) / 100
  const clientFeeValue = Math.round(proposal.value * CLIENT_FEE_PCT * 100) / 100

  // Pedido urgente: 25% de taxa extra sobre proposta, dividida 50/50 prestador/plataforma
  const isUrgent = !!proposal.order.is_urgent
  const urgencyTotal = isUrgent ? Math.round(proposal.value * URGENCY_FEE_PCT * 100) / 100 : 0
  const urgencyProviderBonus = isUrgent ? Math.round(urgencyTotal * 0.5 * 100) / 100 : 0
  const urgencyPlatformShare = isUrgent ? Math.round((urgencyTotal - urgencyProviderBonus) * 100) / 100 : 0

  const providerAmount = Math.round((proposal.value - providerFeeValue + urgencyProviderBonus) * 100) / 100
  const platformFeeValue = Math.round((providerFeeValue + urgencyPlatformShare) * 100) / 100
  const clientTotal = Math.round((proposal.value + clientFeeValue + urgencyTotal) * 100) / 100

  // Aceita a proposta escolhida, rejeita as demais e cria o agendamento
  await prisma.$transaction([
    prisma.proposal.update({ where: { id: proposal.id }, data: { status: 'ACCEPTED' } }),
    prisma.proposal.updateMany({
      where: { order_id: proposal.order_id, id: { not: proposal.id } },
      data: { status: 'REJECTED' },
    }),
    prisma.order.update({
      where: { id: proposal.order_id },
      data: {
        // Se Stripe está configurado o pedido fica ACCEPTED aguardando pagamento; sem Stripe vai direto para SCHEDULED
        status: env.STRIPE_SECRET_KEY ? 'ACCEPTED' : 'SCHEDULED',
        final_price: proposal.value,
        platform_fee_pct: PROVIDER_FEE_PCT,
        platform_fee_value: platformFeeValue,
        provider_amount: providerAmount,
        client_fee_pct: CLIENT_FEE_PCT,
        client_fee_value: clientFeeValue,
        client_total: clientTotal,
        urgency_fee_value: isUrgent ? urgencyTotal : null,
      },
    }),
    prisma.schedule.create({
      data: {
        order_id: proposal.order_id,
        proposal_id: proposal.id,
        provider_id: proposal.provider_id,
        client_id: req.userId,
        scheduled_at: proposal.order.desired_date ?? new Date(),
      },
    }),
  ])

  // Notify provider that their proposal was accepted
  await notify(proposal.provider_id, {
    type: 'PROPOSAL_ACCEPTED',
    title: 'Sua proposta foi aceita!',
    body: `O cliente aceitou sua proposta para "${proposal.order.title}". ${env.STRIPE_SECRET_KEY ? 'Aguardando confirmação do pagamento.' : 'O agendamento foi confirmado.'}`,
    data: { order_id: proposal.order_id },
    channel: 'proposal_update',
  })

  return R.ok(res, {
    final_price: proposal.value,
    provider_fee_pct: PROVIDER_FEE_PCT,
    provider_fee_value: providerFeeValue,
    provider_amount: providerAmount,
    client_fee_pct: CLIENT_FEE_PCT,
    client_fee_value: clientFeeValue,
    client_total: clientTotal,
    payment_required: !!env.STRIPE_SECRET_KEY,
  }, 'Proposta aceita! Realize o pagamento para confirmar o agendamento.')
}

export async function rejectProposal(req: Request, res: Response) {
  const proposal = await prisma.proposal.findUnique({
    where: { id: req.params.id },
    include: { order: true },
  })
  if (!proposal) return R.notFound(res, 'Proposta não encontrada')
  if (proposal.order.client_id !== req.userId) return R.forbidden(res)
  if (proposal.status !== 'PENDING') return R.badRequest(res, 'Esta proposta não pode ser rejeitada')

  await prisma.proposal.update({ where: { id: proposal.id }, data: { status: 'REJECTED' } })
  return R.ok(res, null, 'Proposta rejeitada')
}

export async function cancelProposal(req: Request, res: Response) {
  const proposal = await prisma.proposal.findUnique({ where: { id: req.params.id } })
  if (!proposal) return R.notFound(res, 'Proposta não encontrada')
  if (proposal.provider_id !== req.userId) return R.forbidden(res)
  if (proposal.status !== 'PENDING') return R.badRequest(res, 'Esta proposta não pode ser cancelada')

  await prisma.proposal.update({ where: { id: proposal.id }, data: { status: 'CANCELLED' } })
  return R.ok(res, null, 'Proposta cancelada')
}

export async function listMyProposals(req: Request, res: Response) {
  const proposals = await prisma.proposal.findMany({
    where: { provider_id: req.userId },
    orderBy: { created_at: 'desc' },
    include: {
      order: {
        include: {
          category: { select: { id: true, name: true, icon: true } },
        },
      },
    },
  })
  return R.ok(res, proposals)
}
