import { Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../../config/database'
import { env } from '../../config/env'
import * as R from '../../utils/response'
import { stripe } from './stripe'

// ---------------------------------------------------------------------------
// Criar PaymentIntent (chamado internamente pelo proposals.controller ao aceitar)
// Retorna { clientSecret, paymentIntentId }
// ---------------------------------------------------------------------------
export async function createPaymentIntent(orderId: string, clientId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { client: true, schedule: { include: { provider: true } } },
  })
  if (!order || !order.schedule) throw new Error('Pedido ou agendamento não encontrado')

  const amountCents = Math.round((order.client_total ?? order.final_price ?? 0) * 100)
  if (amountCents < 50) throw new Error('Valor mínimo para pagamento é R$ 0,50')

  // Cria ou recupera customer Stripe do cliente
  let stripeCustomerId = order.client.stripe_customer_id
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: order.client.email,
      name: order.client.name,
      metadata: { user_id: order.client.id },
    })
    stripeCustomerId = customer.id
    await prisma.user.update({ where: { id: clientId }, data: { stripe_customer_id: customer.id } })
  }

  const intent = await stripe.paymentIntents.create({
    amount: amountCents,
    currency: 'brl',
    customer: stripeCustomerId,
    metadata: {
      order_id: order.id,
      client_id: clientId,
      provider_id: order.schedule.provider_id,
    },
    description: `Missão Cumprida — Pedido #${order.id.slice(0, 8)}`,
    automatic_payment_methods: { enabled: true },
  })

  // Salva o payment intent no pedido
  await prisma.order.update({
    where: { id: order.id },
    data: { stripe_payment_intent_id: intent.id },
  })

  // Cria registro de pagamento em PENDING
  await prisma.payment.create({
    data: {
      order_id: order.id,
      client_id: clientId,
      provider_id: order.schedule.provider_id,
      stripe_payment_intent: intent.id,
      amount: order.client_total ?? order.final_price ?? 0,
      provider_amount: order.provider_amount ?? 0,
      platform_fee: (order.platform_fee_value ?? 0) + (order.client_fee_value ?? 0),
    },
  })

  return { clientSecret: intent.client_secret, paymentIntentId: intent.id }
}

// ---------------------------------------------------------------------------
// GET /api/payments/order/:orderId — status do pagamento de um pedido
// ---------------------------------------------------------------------------
export async function getOrderPayment(req: Request, res: Response) {
  const payment = await prisma.payment.findUnique({
    where: { order_id: req.params.orderId },
    include: {
      order: { select: { client_id: true, schedule: { select: { provider_id: true } } } },
    },
  })
  if (!payment) return R.notFound(res, 'Pagamento não encontrado')

  const isClient = payment.client_id === req.userId
  const isProvider = payment.provider_id === req.userId
  if (!isClient && !isProvider) return R.forbidden(res)

  return R.ok(res, payment)
}

// ---------------------------------------------------------------------------
// POST /api/payments/webhook — Stripe webhook
// ---------------------------------------------------------------------------
export async function handleWebhook(req: Request, res: Response) {
  const sig = req.headers['stripe-signature'] as string

  let event
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, env.STRIPE_WEBHOOK_SECRET)
  } catch {
    return res.status(400).json({ error: 'Webhook signature inválida' })
  }

  if (event.type === 'payment_intent.succeeded') {
    const intent = event.data.object as { id: string; metadata: { order_id?: string } }
    const orderId = intent.metadata.order_id
    if (orderId) {
      await prisma.$transaction([
        prisma.payment.update({
          where: { stripe_payment_intent: intent.id },
          data: { status: 'PAID', paid_at: new Date() },
        }),
        prisma.order.update({
          where: { id: orderId },
          data: { status: 'SCHEDULED' },
        }),
      ])
    }
  }

  if (event.type === 'payment_intent.payment_failed') {
    const intent = event.data.object as { id: string }
    await prisma.payment.updateMany({
      where: { stripe_payment_intent: intent.id },
      data: { status: 'FAILED' },
    })
  }

  return res.json({ received: true })
}

// ---------------------------------------------------------------------------
// POST /api/payments/simulate — simula pagamento (apenas dev)
// ---------------------------------------------------------------------------
export async function simulatePayment(req: Request, res: Response) {
  if (env.NODE_ENV === 'production') return R.forbidden(res, 'Disponível apenas em development')

  const { order_id } = req.body
  if (!order_id) return R.badRequest(res, 'order_id obrigatório')

  const payment = await prisma.payment.findUnique({ where: { order_id } })
  if (!payment) return R.notFound(res, 'Pagamento não encontrado')
  if (payment.client_id !== req.userId) return R.forbidden(res)
  if (payment.status !== 'PENDING') return R.badRequest(res, 'Pagamento já processado')

  await prisma.$transaction([
    prisma.payment.update({
      where: { order_id },
      data: { status: 'PAID', paid_at: new Date() },
    }),
    prisma.order.update({
      where: { id: order_id },
      data: { status: 'SCHEDULED' },
    }),
  ])

  return R.ok(res, null, 'Pagamento simulado com sucesso')
}

// ---------------------------------------------------------------------------
// GET /api/payments/my-balance — saldo disponível do prestador
// ---------------------------------------------------------------------------
export async function getMyBalance(req: Request, res: Response) {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { provider_balance: true, pix_key: true, pix_key_type: true },
  })
  if (!user) return R.notFound(res, 'Usuário não encontrado')

  const pending = await prisma.payment.aggregate({
    where: { provider_id: req.userId, status: 'RELEASED' },
    _sum: { provider_amount: true },
  })

  const withdrawals = await prisma.providerWithdrawal.findMany({
    where: { provider_id: req.userId },
    orderBy: { created_at: 'desc' },
    take: 10,
  })

  return R.ok(res, {
    available_balance: user.provider_balance,
    pix_key: user.pix_key,
    pix_key_type: user.pix_key_type,
    total_released: pending._sum.provider_amount ?? 0,
    recent_withdrawals: withdrawals,
  })
}

const withdrawalSchema = z.object({
  amount: z.number().positive('Valor deve ser positivo'),
  pix_key: z.string().min(5, 'Chave PIX inválida'),
  pix_key_type: z.enum(['CPF', 'CNPJ', 'EMAIL', 'PHONE', 'RANDOM']),
})

// ---------------------------------------------------------------------------
// POST /api/payments/withdrawal — prestador solicita saque PIX
// ---------------------------------------------------------------------------
export async function requestWithdrawal(req: Request, res: Response) {
  const parsed = withdrawalSchema.safeParse(req.body)
  if (!parsed.success) return R.badRequest(res, 'Dados inválidos', parsed.error.flatten().fieldErrors)

  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { provider_balance: true },
  })
  if (!user) return R.notFound(res, 'Usuário não encontrado')

  const { amount, pix_key, pix_key_type } = parsed.data
  if (amount > user.provider_balance) {
    return R.badRequest(res, `Saldo insuficiente. Disponível: R$ ${user.provider_balance.toFixed(2)}`)
  }

  // Bloqueia o saldo imediatamente
  const [withdrawal] = await prisma.$transaction([
    prisma.providerWithdrawal.create({
      data: { provider_id: req.userId, amount, pix_key, pix_key_type },
    }),
    prisma.user.update({
      where: { id: req.userId },
      data: { provider_balance: { decrement: amount } },
    }),
  ])

  return R.created(res, withdrawal, 'Solicitação de saque enviada. Processaremos em até 2 dias úteis.')
}

// ---------------------------------------------------------------------------
// GET /api/payments/withdrawals — listar meus saques
// ---------------------------------------------------------------------------
export async function listWithdrawals(req: Request, res: Response) {
  const withdrawals = await prisma.providerWithdrawal.findMany({
    where: { provider_id: req.userId },
    orderBy: { created_at: 'desc' },
  })
  return R.ok(res, withdrawals)
}

// ---------------------------------------------------------------------------
// PUT /api/payments/withdrawals/:id/approve — admin aprova saque
// ---------------------------------------------------------------------------
export async function approveWithdrawal(req: Request, res: Response) {
  const { notes } = req.body
  const withdrawal = await prisma.providerWithdrawal.findUnique({ where: { id: req.params.id } })
  if (!withdrawal) return R.notFound(res, 'Saque não encontrado')
  if (withdrawal.status !== 'REQUESTED') return R.badRequest(res, 'Saque já processado')

  const updated = await prisma.providerWithdrawal.update({
    where: { id: withdrawal.id },
    data: { status: 'PAID', processed_at: new Date(), notes: notes ?? null },
  })
  return R.ok(res, updated, 'Saque aprovado e pago')
}

// ---------------------------------------------------------------------------
// PUT /api/payments/withdrawals/:id/reject — admin rejeita saque
// ---------------------------------------------------------------------------
export async function rejectWithdrawal(req: Request, res: Response) {
  const { notes } = req.body
  const withdrawal = await prisma.providerWithdrawal.findUnique({ where: { id: req.params.id } })
  if (!withdrawal) return R.notFound(res, 'Saque não encontrado')
  if (withdrawal.status !== 'REQUESTED') return R.badRequest(res, 'Saque já processado')

  // Devolve saldo ao prestador
  await prisma.$transaction([
    prisma.providerWithdrawal.update({
      where: { id: withdrawal.id },
      data: { status: 'REJECTED', processed_at: new Date(), notes: notes ?? null },
    }),
    prisma.user.update({
      where: { id: withdrawal.provider_id },
      data: { provider_balance: { increment: withdrawal.amount } },
    }),
  ])
  return R.ok(res, null, 'Saque rejeitado e saldo devolvido ao prestador')
}

// ---------------------------------------------------------------------------
// PUT /api/users/me/pix — prestador cadastra chave PIX
// ---------------------------------------------------------------------------
const pixSchema = z.object({
  pix_key: z.string().min(5),
  pix_key_type: z.enum(['CPF', 'CNPJ', 'EMAIL', 'PHONE', 'RANDOM']),
})

export async function updatePixKey(req: Request, res: Response) {
  const parsed = pixSchema.safeParse(req.body)
  if (!parsed.success) return R.badRequest(res, 'Dados inválidos', parsed.error.flatten().fieldErrors)

  const user = await prisma.user.update({
    where: { id: req.userId },
    data: { pix_key: parsed.data.pix_key, pix_key_type: parsed.data.pix_key_type },
    select: { id: true, pix_key: true, pix_key_type: true },
  })
  return R.ok(res, user, 'Chave PIX atualizada')
}
