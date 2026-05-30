import { Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../../config/database'
import { env } from '../../config/env'
import * as R from '../../utils/response'
import { createPaymentIntent } from '../payments/payments.controller'

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

  const proposal = await prisma.proposal.create({
    data: { order_id: order.id, provider_id: req.userId, ...parsed.data },
    include: {
      provider: { select: { id: true, name: true, avatar: true, rating_avg: true, rating_count: true, bio: true } },
    },
  })

  // Atualiza status do pedido
  if (order.status === 'OPEN') {
    await prisma.order.update({ where: { id: order.id }, data: { status: 'IN_PROPOSAL' } })
  }

  return R.created(res, proposal, 'Proposta enviada com sucesso')
}

export async function listOrderProposals(req: Request, res: Response) {
  const order = await prisma.order.findUnique({ where: { id: req.params.orderId } })
  if (!order) return R.notFound(res, 'Pedido não encontrado')
  if (order.client_id !== req.userId) return R.forbidden(res)

  const proposals = await prisma.proposal.findMany({
    where: { order_id: req.params.orderId },
    include: {
      provider: {
        select: {
          id: true, name: true, avatar: true, bio: true,
          rating_avg: true, rating_count: true, document_verified: true,
          provider_skills: {
            where: { category_id: order.category_id },
            select: { years_experience: true, certification: true },
          },
        },
      },
    },
    orderBy: { created_at: 'asc' },
  })

  return R.ok(res, proposals)
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

  const providerFeeValue = Math.round(proposal.value * PROVIDER_FEE_PCT * 100) / 100
  const providerAmount = Math.round((proposal.value - providerFeeValue) * 100) / 100
  const clientFeeValue = Math.round(proposal.value * CLIENT_FEE_PCT * 100) / 100
  const clientTotal = Math.round((proposal.value + clientFeeValue) * 100) / 100

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
        platform_fee_value: providerFeeValue,
        provider_amount: providerAmount,
        client_fee_pct: CLIENT_FEE_PCT,
        client_fee_value: clientFeeValue,
        client_total: clientTotal,
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

  // Cria PaymentIntent no Stripe (se configurado)
  let paymentData: { clientSecret: string | null; paymentIntentId: string } | null = null
  if (env.STRIPE_SECRET_KEY) {
    try {
      paymentData = await createPaymentIntent(proposal.order_id, req.userId)
    } catch (err) {
      // Não bloqueia o aceite se o Stripe falhar; registra o erro
      console.error('[Stripe] Falha ao criar PaymentIntent:', err)
    }
  }

  return R.ok(res, {
    final_price: proposal.value,
    provider_fee_pct: PROVIDER_FEE_PCT,
    provider_fee_value: providerFeeValue,
    provider_amount: providerAmount,
    client_fee_pct: CLIENT_FEE_PCT,
    client_fee_value: clientFeeValue,
    client_total: clientTotal,
    payment_required: !!env.STRIPE_SECRET_KEY,
    client_secret: paymentData?.clientSecret ?? null,
    payment_intent_id: paymentData?.paymentIntentId ?? null,
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
