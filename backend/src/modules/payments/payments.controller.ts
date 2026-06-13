import { Request, Response } from 'express'
import { z } from 'zod'
import QRCode from 'qrcode'
import { prisma } from '../../config/database'
import { env } from '../../config/env'
import * as R from '../../utils/response'
import { stripe } from './stripe'
import { mpPayment } from './mercadopago'
import { consumeCredit } from '../referrals/referrals.service'
import { releasePayment } from './payments.service'
import { notify } from '../push/push.service'

async function pixToQrBase64(pixCode: string): Promise<string> {
  return QRCode.toDataURL(pixCode).then(url => url.replace('data:image/png;base64,', ''))
}

// Taxa de processamento por método de pagamento
const GATEWAY_FEE: Record<string, number> = {
  card: 0.04, // 4% — cobre a taxa Stripe para cartão de crédito
  pix:  0.01, // 1% — cobre a taxa Stripe para PIX
}

const MIN_AMOUNT = 10 // R$ 10,00 mínimo

// ---------------------------------------------------------------------------
// POST /api/payments/create-checkout — cria PaymentIntent com taxa de gateway
// Chamado pelo frontend quando o usuário seleciona o método de pagamento
// ---------------------------------------------------------------------------
export async function createCheckout(req: Request, res: Response) {
  const { order_id, method, use_credit } = req.body as { order_id?: string; method?: string; use_credit?: boolean }
  if (!order_id || !method) return R.badRequest(res, 'order_id e method são obrigatórios')
  if (!['card', 'pix'].includes(method)) return R.badRequest(res, 'method deve ser "card" ou "pix"')

  const order = await prisma.order.findUnique({
    where: { id: order_id },
    include: { client: { select: { id: true, name: true, email: true, cpf: true, stripe_customer_id: true } }, schedule: { include: { provider: true } } },
  })
  if (!order) return R.notFound(res, 'Pedido não encontrado')
  if (order.client_id !== req.userId) return R.forbidden(res)
  if (order.status !== 'ACCEPTED') {
    console.log(`[checkout] Pedido ${order_id} tem status "${order.status}" — esperado ACCEPTED`)
    return R.badRequest(res, `Este pedido não aguarda pagamento (status atual: ${order.status})`)
  }
  if (!order.schedule) return R.badRequest(res, 'Agendamento não encontrado para este pedido')

  // Se já existe pagamento PAGO ou LIBERADO, devolve status
  const existing = await prisma.payment.findUnique({ where: { order_id } })
  if (existing) {
    if (['PAID', 'RELEASED'].includes(existing.status)) {
      return R.ok(res, { already_paid: true, status: existing.status })
    }
    // Mesmo método e PaymentIntent ativo: reusa
    if (existing.payment_method === method && existing.stripe_payment_intent) {
      try {
        const intent = await stripe.paymentIntents.retrieve(existing.stripe_payment_intent)
        if (['requires_payment_method', 'requires_confirmation', 'requires_action'].includes(intent.status)) {
          return R.ok(res, {
            client_secret: intent.client_secret,
            amount: existing.amount,
            base_amount: existing.amount - existing.gateway_fee,
            gateway_fee_pct: existing.gateway_fee_pct,
            gateway_fee: existing.gateway_fee,
            payment_method: method,
          })
        }
      } catch {}
    }
    // Cancela PaymentIntent antigo e deleta o registro para recriar
    if (existing.stripe_payment_intent) {
      try { await stripe.paymentIntents.cancel(existing.stripe_payment_intent) } catch {}
    }
    await prisma.payment.delete({ where: { order_id } })
  }

  // Calcula valor total com taxa de gateway
  let baseAmount = order.client_total ?? order.final_price ?? 0

  // Aplica crédito (indicação) se solicitado e ainda não aplicado
  let creditApplied = order.credit_applied ?? 0
  if (use_credit && creditApplied === 0 && baseAmount > 0) {
    const used = await consumeCredit(req.userId!, baseAmount, { reason: 'ORDER_DISCOUNT', ref_id: order.id })
    if (used > 0) {
      creditApplied = used
      baseAmount = Math.max(0, Math.round((baseAmount - used) * 100) / 100)
      await prisma.order.update({ where: { id: order.id }, data: { credit_applied: used } })
    }
  }

  const feePct = GATEWAY_FEE[method]
  const gatewayFee = Math.round(baseAmount * feePct * 100) / 100
  const totalAmount = Math.round((baseAmount + gatewayFee) * 100) / 100

  if (totalAmount < MIN_AMOUNT) {
    return R.badRequest(res, `Valor mínimo para pagamento é R$ ${MIN_AMOUNT.toFixed(2)}`)
  }
  const amountCents = Math.round(totalAmount * 100)

  // Cria ou recupera customer no Stripe (usado apenas para cartão)
  let stripeCustomerId = order.client.stripe_customer_id
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: order.client.email,
      name: order.client.name,
      metadata: { user_id: order.client.id },
    })
    stripeCustomerId = customer.id
    await prisma.user.update({ where: { id: req.userId }, data: { stripe_customer_id: customer.id } })
  }

  // Fluxo PIX: Mercado Pago
  if (method === 'pix') {
    // CPF obrigatório para PIX no Brasil
    if (!order.client.cpf) {
      return R.badRequest(res, 'CPF obrigatório para pagamento via PIX. Atualize seu perfil antes de continuar.')
    }

    try {
      const notificationUrl = env.NODE_ENV === 'production'
        ? `${env.API_URL}/api/payments/mp-webhook`
        : undefined

      const nameParts = order.client.name.trim().split(' ')
      const firstName = nameParts[0]
      const lastName = nameParts.slice(1).join(' ') || firstName

      // Remove caracteres não numéricos do CPF/CNPJ
      const docNumber = order.client.cpf.replace(/\D/g, '')
      const docType = docNumber.length === 14 ? 'CNPJ' : 'CPF'

      const mpBody = {
        transaction_amount: Math.round(totalAmount * 100) / 100,
        description: order.title.slice(0, 60),
        payment_method_id: 'pix',
        payer: {
          email: order.client.email,
          first_name: firstName,
          last_name: lastName,
          identification: {
            type: docType,
            number: docNumber,
          },
        },
        ...(notificationUrl ? { notification_url: notificationUrl } : {}),
        external_reference: order.id,
      }

      // Simula PIX apenas quando o token é de sandbox (TEST-...)
      const isMpSandbox = env.MP_ACCESS_TOKEN.startsWith('TEST-')
      if (isMpSandbox) {
        console.log('[PIX MP] Modo DEV — simulando PIX (não chama MP)')
        const devPixCode = `00020126580014BR.GOV.BCB.PIX0136${order.id}5204000053039865406${String(Math.round(totalAmount * 100)).padStart(6, '0')}5802BR5913Missao Cumprida6007Lajeado62070503***6304ABCD`
        const devQr = await pixToQrBase64(devPixCode)
        const devMpId = `mp_dev_${Date.now()}`
        await prisma.payment.create({
          data: {
            order_id: order.id,
            client_id: req.userId,
            provider_id: order.schedule.provider_id,
            stripe_payment_intent: devMpId,
            amount: totalAmount,
            provider_amount: order.provider_amount ?? 0,
            platform_fee: (order.platform_fee_value ?? 0) + (order.client_fee_value ?? 0),
            gateway_fee_pct: feePct,
            gateway_fee: gatewayFee,
            payment_method: 'pix',
          },
        })
        return R.ok(res, {
          pix_code: devPixCode,
          pix_qr_base64: devQr,
          mp_payment_id: devMpId,
          amount: totalAmount,
          base_amount: baseAmount,
          gateway_fee_pct: feePct,
          gateway_fee: gatewayFee,
          payment_method: 'pix',
          dev_mode: true,
        })
      }

      console.log('[PIX MP] Enviando para MP:', JSON.stringify(mpBody, null, 2))
      const mpResponse = await mpPayment.create({ body: mpBody })

      const pixData = mpResponse.point_of_interaction?.transaction_data
      const mpId = String(mpResponse.id)
      const pixCode = pixData?.qr_code ?? null
      const pixQrBase64 = pixData?.qr_code_base64
        ?? (pixCode ? await pixToQrBase64(pixCode) : null)

      await prisma.payment.create({
        data: {
          order_id: order.id,
          client_id: req.userId,
          provider_id: order.schedule.provider_id,
          stripe_payment_intent: `mp_${mpId}`,
          amount: totalAmount,
          provider_amount: order.provider_amount ?? 0,
          platform_fee: (order.platform_fee_value ?? 0) + (order.client_fee_value ?? 0),
          gateway_fee_pct: feePct,
          gateway_fee: gatewayFee,
          payment_method: 'pix',
        },
      })

      return R.ok(res, {
        pix_code: pixCode,
        pix_qr_base64: pixQrBase64,
        mp_payment_id: mpId,
        amount: totalAmount,
        base_amount: baseAmount,
        gateway_fee_pct: feePct,
        gateway_fee: gatewayFee,
        payment_method: 'pix',
      })
    } catch (err: unknown) {
      const mpErr = err as { message?: string; cause?: unknown; status?: number; error?: string }
      console.error('[PIX MP] Erro completo:', {
        message: mpErr.message,
        status: mpErr.status,
        error: mpErr.error,
        cause: mpErr.cause,
        raw: String(err),
      })
      const msg = mpErr.message ?? 'Erro ao gerar PIX'
      return R.badRequest(res, msg)
    }
  }

  // Cria PaymentIntent no Stripe (cartão)
  const intent = await stripe.paymentIntents.create({
    amount: amountCents,
    currency: 'brl',
    customer: stripeCustomerId,
    payment_method_types: [method],
    metadata: {
      order_id: order.id,
      client_id: req.userId,
      provider_id: order.schedule.provider_id,
    },
    description: `Missão Cumprida — ${order.title.slice(0, 50)}`,
  })

  await prisma.order.update({
    where: { id: order.id },
    data: { stripe_payment_intent_id: intent.id },
  })

  await prisma.payment.create({
    data: {
      order_id: order.id,
      client_id: req.userId,
      provider_id: order.schedule.provider_id,
      stripe_payment_intent: intent.id,
      amount: totalAmount,
      provider_amount: order.provider_amount ?? 0,
      platform_fee: (order.platform_fee_value ?? 0) + (order.client_fee_value ?? 0),
      gateway_fee_pct: feePct,
      gateway_fee: gatewayFee,
      payment_method: method,
    },
  })

  return R.ok(res, {
    client_secret: intent.client_secret,
    amount: totalAmount,
    base_amount: baseAmount,
    gateway_fee_pct: feePct,
    gateway_fee: gatewayFee,
    payment_method: method,
  })
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
// POST /api/payments/mp-webhook — Mercado Pago webhook (PIX)
// ---------------------------------------------------------------------------
export async function handleMpWebhook(req: Request, res: Response) {
  try {
    const { type, data } = req.body as { type?: string; data?: { id?: string } }

    // MP envia type 'payment' quando o status muda
    if (type === 'payment' && data?.id) {
      const mpId = String(data.id)

      // Consulta o pagamento atualizado diretamente na API do MP
      const mpPay = await mpPayment.get({ id: mpId })

      if (mpPay.status === 'approved') {
        const orderId = mpPay.external_reference as string | undefined

        if (orderId) {
          await prisma.$transaction([
            prisma.payment.update({
              where: { stripe_payment_intent: `mp_${mpId}` },
              data: { status: 'PAID', paid_at: new Date() },
            }),
            prisma.order.update({
              where: { id: orderId },
              data: { status: 'SCHEDULED' },
            }),
          ])
        }
      }
    }
  } catch (err) {
    console.error('[MP Webhook] Erro:', err)
  }

  // MP exige resposta 200 imediata
  return res.sendStatus(200)
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
// POST /api/payments/confirm-intent — confirma pagamento via PaymentIntent (fallback do webhook)
// Chamado pelo frontend após redirect_status=succeeded
// ---------------------------------------------------------------------------
export async function confirmIntent(req: Request, res: Response) {
  const { payment_intent_id } = req.body
  if (!payment_intent_id) return R.badRequest(res, 'payment_intent_id obrigatório')

  const payment = await prisma.payment.findUnique({
    where: { stripe_payment_intent: payment_intent_id },
  })
  if (!payment) return R.notFound(res, 'Pagamento não encontrado')
  if (payment.client_id !== req.userId) return R.forbidden(res)

  if (payment.status === 'PAID' || payment.status === 'RELEASED') {
    return R.ok(res, { status: payment.status }, 'Pagamento já confirmado')
  }

  const intent = await stripe.paymentIntents.retrieve(payment_intent_id)
  if (intent.status !== 'succeeded') {
    return R.badRequest(res, `Pagamento ainda não confirmado pelo Stripe (status: ${intent.status})`)
  }

  await prisma.$transaction([
    prisma.payment.update({
      where: { stripe_payment_intent: payment_intent_id },
      data: { status: 'PAID', paid_at: new Date() },
    }),
    prisma.order.update({
      where: { id: payment.order_id },
      data: { status: 'SCHEDULED' },
    }),
  ])

  return R.ok(res, { status: 'PAID' }, 'Pagamento confirmado com sucesso')
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

  // Segurança de Transação: valores ainda em garantia (não sacáveis)
  const held = await prisma.payment.aggregate({
    where: { provider_id: req.userId, status: { in: ['HELD', 'DISPUTED'] } },
    _sum: { provider_amount: true },
  })
  const heldPayments = await prisma.payment.findMany({
    where: { provider_id: req.userId, status: { in: ['HELD', 'DISPUTED'] } },
    select: {
      id: true, provider_amount: true, status: true, confirmed_at: true,
      hold_until: true, admin_approved_at: true,
      order: { select: { id: true, title: true } },
    },
    orderBy: { hold_until: 'asc' },
  })

  const withdrawals = await prisma.providerWithdrawal.findMany({
    where: { provider_id: req.userId },
    orderBy: { created_at: 'desc' },
    take: 10,
  })

  return R.ok(res, {
    available_balance: user.provider_balance,
    held_balance: held._sum.provider_amount ?? 0,
    held_transactions: heldPayments,
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
// PUT /api/payments/pix-key — prestador cadastra chave PIX
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

// ===========================================================================
// SEGURANÇA DE TRANSAÇÃO — painel admin de revisão de pagamentos em garantia
// ===========================================================================

// Dados completos de uma transação para o admin analisar (fotos, GPS, valores).
const adminTxInclude = {
  order: {
    select: {
      id: true, title: true, description: true, photos: true,
      city: true, neighborhood: true, address: true,
      final_price: true, client_total: true,
      category: { select: { name: true, icon: true } },
      schedule: {
        select: {
          id: true, scheduled_at: true,
          checkin_at: true, checkin_photo_url: true, checkin_address: true,
          checkin_lat: true, checkin_lng: true,
          done_at: true, complete_photo_url: true, complete_address: true,
          complete_lat: true, complete_lng: true, duration_minutes: true,
        },
      },
    },
  },
  client: { select: { id: true, name: true, email: true, phone: true } },
  provider: { select: { id: true, name: true, email: true, phone: true, pix_key: true, pix_key_type: true } },
} as const

// ---------------------------------------------------------------------------
// GET /api/payments/admin/transactions?status=HELD — lista para análise
// ---------------------------------------------------------------------------
export async function adminListTransactions(req: Request, res: Response) {
  const status = String(req.query.status ?? 'HELD').toUpperCase()
  const allowed = ['HELD', 'DISPUTED', 'RELEASED', 'REFUNDED', 'PAID']
  if (!allowed.includes(status)) return R.badRequest(res, `status inválido. Use: ${allowed.join(', ')}`)

  const payments = await prisma.payment.findMany({
    where: { status: status as never },
    include: adminTxInclude,
    orderBy: { confirmed_at: 'asc' },
  })

  const now = Date.now()
  const data = payments.map((p) => ({
    ...p,
    // Elegível para liberar = aprovado pelo admin E janela de garantia encerrada
    release_eligible: !!p.admin_approved_at && !!p.hold_until && p.hold_until.getTime() <= now,
    days_remaining: p.hold_until
      ? Math.max(0, Math.ceil((p.hold_until.getTime() - now) / (24 * 60 * 60 * 1000)))
      : null,
  }))
  return R.ok(res, data)
}

const reviewSchema = z.object({ notes: z.string().max(1000).optional() })

// ---------------------------------------------------------------------------
// POST /api/payments/admin/transactions/:id/approve — aprova a liberação
// Libera na hora se a janela de 7 dias já passou; senão, agenda (o cron libera).
// ---------------------------------------------------------------------------
export async function adminApproveTransaction(req: Request, res: Response) {
  const parsed = reviewSchema.safeParse(req.body)
  if (!parsed.success) return R.badRequest(res, 'Dados inválidos', parsed.error.flatten().fieldErrors)

  const payment = await prisma.payment.findUnique({ where: { id: req.params.id } })
  if (!payment) return R.notFound(res, 'Transação não encontrada')
  if (!['HELD', 'DISPUTED'].includes(payment.status)) {
    return R.badRequest(res, `Transação não está em garantia (status atual: ${payment.status})`)
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: 'HELD', // sai de DISPUTED de volta para HELD ao aprovar
      admin_approved_at: new Date(),
      admin_reviewer_id: req.userId,
      review_notes: parsed.data.notes ?? payment.review_notes,
    },
  })

  const now = new Date()
  // Se a janela já terminou (ou, por segurança, se hold_until estiver ausente),
  // libera na hora. Caso contrário, o cron libera ao fim do prazo.
  const windowPassed = !payment.hold_until || payment.hold_until.getTime() <= now.getTime()

  if (windowPassed) {
    await releasePayment({
      id: payment.id,
      order_id: payment.order_id,
      provider_id: payment.provider_id,
      client_id: payment.client_id,
      provider_amount: payment.provider_amount,
    })
    return R.ok(res, { released: true }, 'Transação aprovada e pagamento liberado ao prestador.')
  }

  return R.ok(
    res,
    { released: false, hold_until: payment.hold_until },
    'Transação aprovada. O pagamento será liberado automaticamente ao fim da janela de garantia.',
  )
}

// ---------------------------------------------------------------------------
// POST /api/payments/admin/transactions/:id/dispute — segura por análise
// ---------------------------------------------------------------------------
export async function adminDisputeTransaction(req: Request, res: Response) {
  const parsed = reviewSchema.safeParse(req.body)
  if (!parsed.success) return R.badRequest(res, 'Dados inválidos', parsed.error.flatten().fieldErrors)

  const payment = await prisma.payment.findUnique({ where: { id: req.params.id } })
  if (!payment) return R.notFound(res, 'Transação não encontrada')
  if (!['HELD', 'DISPUTED'].includes(payment.status)) {
    return R.badRequest(res, `Só é possível disputar transações em garantia (status atual: ${payment.status})`)
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: 'DISPUTED',
      admin_approved_at: null, // remove aprovação: não pode ser liberada pelo cron
      admin_reviewer_id: req.userId,
      review_notes: parsed.data.notes ?? payment.review_notes,
    },
  })

  await notify(payment.provider_id, {
    type: 'GENERAL',
    title: 'Pagamento em análise',
    body: 'Um pagamento do seu serviço está em análise pela equipe. Em breve daremos um retorno.',
    data: { payment_id: payment.id, order_id: payment.order_id },
    channel: 'schedule_update',
  }).catch(() => {})

  return R.ok(res, null, 'Transação marcada como em disputa/análise.')
}

// ---------------------------------------------------------------------------
// POST /api/payments/admin/transactions/:id/refund — marca reembolso
// O estorno financeiro é feito manualmente no painel do Mercado Pago/Stripe;
// aqui apenas registramos o status para o prestador não receber.
// ---------------------------------------------------------------------------
export async function adminRefundTransaction(req: Request, res: Response) {
  const parsed = reviewSchema.safeParse(req.body)
  if (!parsed.success) return R.badRequest(res, 'Dados inválidos', parsed.error.flatten().fieldErrors)

  const payment = await prisma.payment.findUnique({ where: { id: req.params.id } })
  if (!payment) return R.notFound(res, 'Transação não encontrada')
  if (payment.status === 'REFUNDED') return R.badRequest(res, 'Transação já reembolsada')
  if (payment.status === 'RELEASED') {
    return R.badRequest(res, 'Pagamento já liberado ao prestador; reembolso exige estorno de saldo manual.')
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: 'REFUNDED',
      admin_approved_at: null,
      admin_reviewer_id: req.userId,
      review_notes: parsed.data.notes ?? payment.review_notes,
    },
  })

  await notify(payment.client_id, {
    type: 'GENERAL',
    title: 'Reembolso em processamento',
    body: 'Seu reembolso foi aprovado e está sendo processado. O valor retornará pela mesma forma de pagamento.',
    data: { payment_id: payment.id, order_id: payment.order_id },
    channel: 'payment',
  }).catch(() => {})

  return R.ok(res, null, 'Transação marcada como reembolsada. Faça o estorno no painel do gateway (Mercado Pago/Stripe).')
}

// ---------------------------------------------------------------------------
// GET /api/payments/admin/withdrawals?status=REQUESTED — saques (todos)
// ---------------------------------------------------------------------------
export async function adminListWithdrawals(req: Request, res: Response) {
  const status = req.query.status ? String(req.query.status).toUpperCase() : undefined
  const allowed = ['REQUESTED', 'PROCESSING', 'PAID', 'REJECTED']
  if (status && !allowed.includes(status)) {
    return R.badRequest(res, `status inválido. Use: ${allowed.join(', ')}`)
  }

  const withdrawals = await prisma.providerWithdrawal.findMany({
    where: status ? { status: status as never } : undefined,
    include: {
      provider: { select: { id: true, name: true, email: true, phone: true } },
    },
    orderBy: { created_at: 'desc' },
    take: 200,
  })
  return R.ok(res, withdrawals)
}
