import { Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../../config/database'
import { env } from '../../config/env'
import * as R from '../../utils/response'
import { notify } from '../push/push.service'
import { getSettings } from '../settings/settings.service'
import { computeFeeBase, createFeesOnAccept } from '../payments/connectionFees.service'
import { sanitizeContactInfo } from '../../utils/contactSanitizer'

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

  // Piso antifraude (Remap 2.0): impede proposta artificialmente baixa no app
  // com o preço real combinado por fora (a taxa de conexão é % da proposta).
  const s = await getSettings()
  const category = await prisma.category.findUnique({
    where: { id: order.category_id },
    select: { base_price_min: true },
  })
  const minValue = Math.max(10, Math.round((category?.base_price_min ?? 0) * s.proposal_min_ratio * 100) / 100)
  if (parsed.data.value < minValue) {
    return R.badRequest(res, `O valor mínimo de proposta para esta categoria é R$ ${minValue.toFixed(2)}`)
  }

  // Antibypass: remove telefone/e-mail/@ da mensagem — o contato só é
  // liberado depois que as taxas de conexão forem pagas.
  if (parsed.data.message) {
    parsed.data.message = sanitizeContactInfo(parsed.data.message)
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

  let updated
  try {
    updated = await prisma.$transaction(async (tx) => {
    if (price > 0) {
      // Débito condicional: dois boosts simultâneos não deixam o saldo negativo
      const debited = await tx.user.updateMany({
        where: { id: proposal.provider_id, provider_balance: { gte: price } },
        data: { provider_balance: { decrement: price } },
      })
      if (debited.count === 0) throw new Error('INSUFFICIENT_BALANCE')
    }
    // Só sobe de nível se ainda estiver abaixo (evita cobrar duas vezes)
    const bumped = await tx.proposal.updateMany({
      where: { id: proposal.id, status: 'PENDING', boost_level: { lt: parsed.data.level } },
      data: {
        boost_level: parsed.data.level,
        boost_paid_at: new Date(),
        boost_value: price,
      },
    })
    if (bumped.count === 0) throw new Error('ALREADY_BOOSTED')
    await tx.boostPurchase.create({
      data: {
        provider_id: proposal.provider_id,
        proposal_id: proposal.id,
        level: parsed.data.level,
        value: price,
        payment_ref: isProFreeLevel1 ? 'VERIFIED_PRO_FREE' : 'INTERNAL_BALANCE',
      },
    })
    return tx.proposal.findUnique({ where: { id: proposal.id } })
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'INSUFFICIENT_BALANCE') {
      return R.badRequest(res, `Saldo insuficiente. É necessário R$ ${price.toFixed(2)} para esse nível.`)
    }
    if (err instanceof Error && err.message === 'ALREADY_BOOSTED') {
      return R.badRequest(res, 'Sua proposta já está em nível igual ou superior')
    }
    throw err
  }
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

  // Taxa de Conexão (Remap 2.0): percentuais vigentes vêm das configurações
  // da plataforma (editáveis pelo admin). O valor fica congelado na fee.
  const s = await getSettings()
  const feesEnabled = env.FEES_ENABLED
  const clientFeeValue = computeFeeBase(proposal.value, s.fee_client_pct, s.fee_min)
  const providerFeeValue = computeFeeBase(proposal.value, s.fee_provider_pct, s.fee_min)
  const round2 = (n: number) => Math.round(n * 100) / 100

  // Aceita a proposta escolhida, rejeita as demais, cria agendamento e taxas.
  // Guard de corrida: o update do pedido é condicionado ao status atual — dois
  // aceites simultâneos fazem o segundo falhar de forma limpa.
  try {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.order.updateMany({
        where: { id: proposal.order_id, status: { in: ['OPEN', 'IN_PROPOSAL'] } },
        data: {
          status: feesEnabled ? 'ACCEPTED' : 'SCHEDULED',
          final_price: proposal.value,
          // Campos informativos (telas exibem o breakdown a partir das fees)
          platform_fee_pct: s.fee_provider_pct,
          platform_fee_value: providerFeeValue,
          provider_amount: round2(proposal.value - providerFeeValue),
          client_fee_pct: s.fee_client_pct,
          client_fee_value: clientFeeValue,
          client_total: round2(proposal.value + clientFeeValue),
        },
      })
      if (updated.count === 0) throw new Error('ORDER_NOT_ACCEPTING')

      await tx.proposal.update({ where: { id: proposal.id }, data: { status: 'ACCEPTED' } })
      await tx.proposal.updateMany({
        where: { order_id: proposal.order_id, id: { not: proposal.id }, status: 'PENDING' },
        data: { status: 'REJECTED' },
      })
      await tx.schedule.create({
        data: {
          order_id: proposal.order_id,
          proposal_id: proposal.id,
          provider_id: proposal.provider_id,
          client_id: req.userId!,
          scheduled_at: proposal.order.desired_date ?? new Date(),
        },
      })
      if (feesEnabled) {
        await createFeesOnAccept(tx, s, {
          order_id: proposal.order_id,
          proposal_id: proposal.id,
          client_id: req.userId!,
          provider_id: proposal.provider_id,
          value: proposal.value,
        })
      }
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'ORDER_NOT_ACCEPTING') {
      return R.conflict(res, 'Este pedido já teve uma proposta aceita')
    }
    throw err
  }

  // Notifica o prestador do aceite (a taxa dele só é cobrada após o cliente pagar)
  await notify(proposal.provider_id, {
    type: 'PROPOSAL_ACCEPTED',
    title: 'Sua proposta foi aceita!',
    body: feesEnabled
      ? `O cliente aceitou sua proposta para "${proposal.order.title}". Assim que ele pagar a taxa de conexão, você paga a sua e o contato é liberado.`
      : `O cliente aceitou sua proposta para "${proposal.order.title}". O agendamento foi confirmado.`,
    data: { order_id: proposal.order_id },
    channel: 'proposal_update',
  })

  const promoActive = s.fee_promo_active && s.fee_regular_pct > s.fee_client_pct
  return R.ok(res, {
    final_price: proposal.value,
    payment_required: feesEnabled,
    connection_fee: {
      promo_active: promoActive,
      regular_pct: s.fee_regular_pct,
      client: {
        pct: s.fee_client_pct,
        amount: clientFeeValue,
        regular_amount: computeFeeBase(proposal.value, s.fee_regular_pct, s.fee_min),
      },
      provider: {
        pct: s.fee_provider_pct,
        amount: providerFeeValue,
      },
    },
  }, feesEnabled
    ? 'Proposta aceita! Pague a taxa de conexão para liberar o contato do profissional.'
    : 'Proposta aceita! O agendamento foi confirmado.')
}

// PATCH /api/proposals/:id — prestador ajusta valor/mensagem da proposta
// pendente (ex.: depois que o cliente editou o pedido).
const updateProposalSchema = z.object({
  value: z.number().positive().optional(),
  message: z.string().max(1000).optional(),
})

export async function updateProposal(req: Request, res: Response) {
  const parsed = updateProposalSchema.safeParse(req.body)
  if (!parsed.success) return R.badRequest(res, 'Dados inválidos', parsed.error.flatten().fieldErrors)
  const proposal = await prisma.proposal.findUnique({
    where: { id: req.params.id },
    include: { order: { select: { id: true, status: true, category_id: true, client_id: true, title: true } } },
  })
  if (!proposal) return R.notFound(res, 'Proposta não encontrada')
  if (proposal.provider_id !== req.userId) return R.forbidden(res)
  if (proposal.status !== 'PENDING' || !['OPEN', 'IN_PROPOSAL'].includes(proposal.order.status)) {
    return R.badRequest(res, 'Esta proposta não pode mais ser alterada')
  }

  const data: { value?: number; message?: string } = {}
  if (parsed.data.value !== undefined) {
    const s = await getSettings()
    const category = await prisma.category.findUnique({
      where: { id: proposal.order.category_id },
      select: { base_price_min: true },
    })
    const minValue = Math.max(10, Math.round((category?.base_price_min ?? 0) * s.proposal_min_ratio * 100) / 100)
    if (parsed.data.value < minValue) {
      return R.badRequest(res, `O valor mínimo de proposta para esta categoria é R$ ${minValue.toFixed(2)}`)
    }
    data.value = parsed.data.value
  }
  if (parsed.data.message !== undefined) data.message = sanitizeContactInfo(parsed.data.message)

  const updated = await prisma.proposal.update({ where: { id: proposal.id }, data })
  await notify(proposal.order.client_id, {
    type: 'PROPOSAL_RECEIVED',
    title: 'Proposta atualizada',
    body: `Um prestador atualizou a proposta para "${proposal.order.title}".`,
    data: { order_id: proposal.order.id },
    channel: 'new_proposal',
  }).catch(() => {})
  return R.ok(res, updated, 'Proposta atualizada')
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
  // Só campos não sensíveis do pedido: endereço exato, coordenadas e dados do
  // cliente ficam para o detalhe (GET /orders/:id), que aplica a liberação
  // por taxa de conexão. Antes a lista vazava o endereço antes do pagamento.
  const proposals = await prisma.proposal.findMany({
    where: { provider_id: req.userId },
    orderBy: { created_at: 'desc' },
    take: 200,
    include: {
      order: {
        select: {
          id: true, title: true, status: true, city: true, neighborhood: true, state: true,
          desired_date: true, estimated_price_min: true, estimated_price_max: true,
          final_price: true, is_urgent: true, created_at: true, photos: true,
          category: { select: { id: true, name: true, icon: true } },
        },
      },
    },
  })
  return R.ok(res, proposals)
}
