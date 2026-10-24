import { Request, Response } from 'express'
import crypto from 'crypto'
import { z } from 'zod'
import QRCode from 'qrcode'
import { prisma } from '../../config/database'
import { env } from '../../config/env'
import * as R from '../../utils/response'
import { mpPayment } from './mercadopago'
import { consumeCredit } from '../referrals/referrals.service'
import { releasePayment } from './payments.service'
import { onFeePaidByExternalRef, onFeeReversedByExternalRef } from './connectionFees.service'
import { creditProviderBalance, debitProviderBalance } from '../audit/ledger.service'
import { audit } from '../audit/audit.service'
import { notify } from '../push/push.service'

async function pixToQrBase64(pixCode: string): Promise<string> {
  return QRCode.toDataURL(pixCode).then(url => url.replace('data:image/png;base64,', ''))
}

// Taxa de processamento por método de pagamento (repasse do gateway)
const GATEWAY_FEE: Record<string, number> = {
  card: 0.04, // 4% — cartão de crédito
  pix:  0.01, // 1% — PIX
}

const MIN_AMOUNT = 10 // R$ 10,00 mínimo

// ---------------------------------------------------------------------------
// POST /api/payments/create-checkout — cria PaymentIntent com taxa de gateway
// Chamado pelo frontend quando o usuário seleciona o método de pagamento
// ---------------------------------------------------------------------------
export async function createCheckout(req: Request, res: Response) {
  const { order_id, method, use_credit } = req.body as { order_id?: string; method?: string; use_credit?: boolean }
  if (!order_id || !method) return R.badRequest(res, 'order_id e method são obrigatórios')
  // Stripe foi aposentado (Remap 2.0): o trilho legado aceita apenas PIX (MP)
  if (method !== 'pix') return R.badRequest(res, 'Pagamento com cartão foi descontinuado — use PIX')

  const order = await prisma.order.findUnique({
    where: { id: order_id },
    include: { client: { select: { id: true, name: true, email: true, cpf: true } }, schedule: { include: { provider: true } } },
  })
  if (!order) return R.notFound(res, 'Pedido não encontrado')
  if (order.client_id !== req.userId) return R.forbidden(res)
  if (order.status !== 'ACCEPTED') {
    console.log(`[checkout] Pedido ${order_id} tem status "${order.status}" — esperado ACCEPTED`)
    return R.badRequest(res, `Este pedido não aguarda pagamento (status atual: ${order.status})`)
  }
  if (!order.schedule) return R.badRequest(res, 'Agendamento não encontrado para este pedido')

  // Pedidos novos usam Taxa de Conexão — este checkout é só do escrow legado
  const hasConnectionFees = await prisma.connectionFee.count({ where: { order_id } })
  if (hasConnectionFees > 0) {
    return R.badRequest(res, 'Este pedido usa a Taxa de Conexão — utilize /api/payments/fees/checkout')
  }

  // Se já existe pagamento PAGO ou LIBERADO, devolve status
  const existing = await prisma.payment.findUnique({ where: { order_id } })
  if (existing) {
    if (['PAID', 'RELEASED'].includes(existing.status)) {
      return R.ok(res, { already_paid: true, status: existing.status })
    }
    // Deleta o registro pendente para recriar um novo PIX
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

  // Fluxo PIX: Mercado Pago
  {
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
      console.error('[PIX MP] Erro ao gerar PIX:', { message: mpErr.message, status: mpErr.status, error: mpErr.error })
      return R.badRequest(res, 'Não foi possível gerar o PIX agora. Tente novamente em instantes.')
    }
  }
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

// Valida a assinatura HMAC do webhook do Mercado Pago (header x-signature).
// Template assinado: `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`
// Em produção o segredo é obrigatório: sem ele o webhook é recusado (fail-closed),
// pois um webhook aceito sem assinatura permitiria confirmar taxas sem pagar.
function verifyMpSignature(req: Request): boolean {
  const secret = env.MP_WEBHOOK_SECRET
  if (!secret) {
    if (env.NODE_ENV === 'production') {
      console.error('[MP Webhook] MP_WEBHOOK_SECRET não configurado — webhook RECUSADO (fail-closed)')
      return false
    }
    return true // apenas em dev: sem segredo configurado, aceita para facilitar testes
  }

  const xSignature = req.headers['x-signature']
  const xRequestId = req.headers['x-request-id']
  if (typeof xSignature !== 'string') return false

  // x-signature = "ts=1699...,v1=abcdef..."
  const parts = Object.fromEntries(
    xSignature.split(',').map((kv) => kv.split('=').map((s) => s.trim()) as [string, string]),
  )
  const ts = parts['ts']
  const v1 = parts['v1']
  if (!ts || !v1) return false

  // id vem do query param data.id (MP recomenda lowercase se alfanumérico)
  const rawId =
    (typeof req.query['data.id'] === 'string' && (req.query['data.id'] as string)) ||
    (req.body?.data?.id != null ? String(req.body.data.id) : '')
  const dataId = rawId.toLowerCase()

  const manifest = `id:${dataId};request-id:${xRequestId ?? ''};ts:${ts};`
  const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex')

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1))
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// POST /api/payments/mp-webhook — Mercado Pago webhook (PIX)
// ---------------------------------------------------------------------------
export async function handleMpWebhook(req: Request, res: Response) {
  let failed = false
  try {
    if (!verifyMpSignature(req)) {
      console.warn('[MP Webhook] Assinatura inválida — ignorado')
      return res.sendStatus(401)
    }

    const { type, data, action } = req.body as { type?: string; data?: { id?: string }; action?: string }

    // MP envia type 'payment' quando o status muda
    if (type === 'payment' && data?.id) {
      await processMpPayment(String(data.id), { type, data, action: action ?? null })
    }
  } catch (err) {
    failed = true
    console.error('[MP Webhook] Erro:', err)
  }

  // Erro de processamento → 500 para o Mercado Pago reenviar a notificação
  // (o processamento é idempotente). Sucesso → 200.
  return res.sendStatus(failed ? 500 : 200)
}

/**
 * Processa um pagamento do Mercado Pago (webhook ou "reprocessar" do admin).
 * Consulta o status atual na API do MP e grava o evento em webhook_events
 * (prova + idempotência: um registro por pagamento e status). Os passos
 * seguintes são idempotentes — reprocessar nunca credita duas vezes.
 */
export async function processMpPayment(
  mpId: string,
  notification: unknown,
  opts: { force?: boolean } = {},
): Promise<'PROCESSED' | 'IGNORED' | 'DUPLICATE'> {
  const mpPay = await mpPayment.get({ id: mpId })

  const externalId = `payment:${mpId}:${mpPay.status}`
  const seen = await prisma.webhookEvent.findUnique({
    where: { provider_external_id: { provider: 'MERCADOPAGO', external_id: externalId } },
  })
  if (!opts.force && seen && (seen.status === 'PROCESSED' || seen.status === 'IGNORED')) return 'DUPLICATE'
  const ref = (mpPay.external_reference as string | undefined) ?? undefined
  const record = seen
    ? await prisma.webhookEvent.update({ where: { id: seen.id }, data: { attempts: { increment: 1 } } })
    : await prisma.webhookEvent.create({
        data: {
          provider: 'MERCADOPAGO',
          external_id: externalId,
          event_type: `payment.${mpPay.status}`,
          payload: {
            notification,
            payment: {
              id: mpId,
              status: mpPay.status,
              status_detail: mpPay.status_detail,
              external_reference: ref ?? null,
              transaction_amount: mpPay.transaction_amount,
              payment_method_id: mpPay.payment_method_id,
              date_approved: mpPay.date_approved,
            },
          } as never,
        },
      })

  try {
    if (mpPay.status === 'approved') {
      if (ref?.startsWith('fee_')) {
        // Taxa de Conexão (Remap 2.0)
        await onFeePaidByExternalRef(ref, `mp_${mpId}`, Number(mpPay.transaction_amount ?? 0))
      } else if (ref) {
        // Fluxo legado de escrow (deprecated). Só avança estados — uma
        // reentrega do webhook não pode voltar um pedido DONE para SCHEDULED.
        await prisma.$transaction(async (tx) => {
          const moved = await tx.payment.updateMany({
            where: { stripe_payment_intent: `mp_${mpId}`, status: 'PENDING' },
            data: { status: 'PAID', paid_at: new Date() },
          })
          if (moved.count > 0) {
            await tx.order.updateMany({
              where: { id: ref, status: 'ACCEPTED' },
              data: { status: 'SCHEDULED' },
            })
          }
        })
      }
    } else if (mpPay.status === 'refunded' || mpPay.status === 'charged_back') {
      if (ref?.startsWith('fee_')) {
        await onFeeReversedByExternalRef(ref, `mp_${mpId}`, mpPay.status)
      } else {
        console.warn(`[MP Webhook] pagamento legado ${mpId} ${mpPay.status} — revisar manualmente`)
      }
    }
    const status = ['approved', 'refunded', 'charged_back'].includes(String(mpPay.status)) ? 'PROCESSED' : 'IGNORED'
    await prisma.webhookEvent.update({
      where: { id: record.id },
      data: { status, error: null, processed_at: new Date() },
    })
    return status
  } catch (err) {
    await prisma.webhookEvent
      .update({ where: { id: record.id }, data: { status: 'FAILED', error: String((err as Error)?.message ?? err).slice(0, 500) } })
      .catch(() => {})
    throw err
  }
}

// ---------------------------------------------------------------------------
// POST /api/payments/simulate — simula pagamento (apenas dev)
// ---------------------------------------------------------------------------
export async function simulatePayment(req: Request, res: Response) {
  if (!env.PAYMENT_SIMULATION_ENABLED) return R.forbidden(res, 'Simulação de pagamento desativada')

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

const MIN_WITHDRAWAL = 10

const withdrawalSchema = z.object({
  amount: z.number().min(MIN_WITHDRAWAL, `Valor mínimo para saque: R$ ${MIN_WITHDRAWAL.toFixed(2)}`).max(100_000),
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

  const { pix_key, pix_key_type } = parsed.data
  const amount = Math.round(parsed.data.amount * 100) / 100
  if (amount > user.provider_balance) {
    return R.badRequest(res, `Saldo insuficiente. Disponível: R$ ${user.provider_balance.toFixed(2)}`)
  }

  // Débito condicional dentro da transação: dois pedidos de saque simultâneos
  // não conseguem sacar mais do que o saldo (antes era check-then-decrement).
  let withdrawal
  try {
    withdrawal = await prisma.$transaction(async (tx) => {
      const created = await tx.providerWithdrawal.create({
        data: { provider_id: req.userId, amount, pix_key, pix_key_type },
      })
      const debited = await debitProviderBalance(tx, {
        userId: req.userId, amount, reason: 'WITHDRAWAL', refType: 'ProviderWithdrawal', refId: created.id,
        note: 'Saque solicitado',
      })
      if (!debited) throw new Error('INSUFFICIENT_BALANCE')
      return created
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'INSUFFICIENT_BALANCE') {
      return R.badRequest(res, 'Saldo insuficiente')
    }
    throw err
  }

  audit({ type: 'WITHDRAWAL_REQUESTED', userId: req.userId, entityType: 'ProviderWithdrawal', entityId: withdrawal.id, amount, metadata: { pix_key_type } })
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

  // Transição condicional: dois admins não processam o mesmo saque duas vezes
  const changed = await prisma.providerWithdrawal.updateMany({
    where: { id: withdrawal.id, status: 'REQUESTED' },
    data: { status: 'PAID', processed_at: new Date(), notes: typeof notes === 'string' ? notes : null },
  })
  if (changed.count === 0) return R.badRequest(res, 'Saque já processado')
  const updated = await prisma.providerWithdrawal.findUnique({ where: { id: withdrawal.id } })
  audit({ type: 'WITHDRAWAL_PAID', userId: withdrawal.provider_id, entityType: 'ProviderWithdrawal', entityId: withdrawal.id, amount: withdrawal.amount, reason: typeof notes === 'string' ? notes : null })
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

  // Só devolve o saldo se ESTA chamada fez a transição (evita estorno em dobro)
  const refunded = await prisma.$transaction(async (tx) => {
    const changed = await tx.providerWithdrawal.updateMany({
      where: { id: withdrawal.id, status: 'REQUESTED' },
      data: { status: 'REJECTED', processed_at: new Date(), notes: typeof notes === 'string' ? notes : null },
    })
    if (changed.count === 0) return false
    await creditProviderBalance(tx, {
      userId: withdrawal.provider_id, amount: withdrawal.amount, reason: 'WITHDRAWAL_REJECTED',
      refType: 'ProviderWithdrawal', refId: withdrawal.id,
      note: typeof notes === 'string' && notes ? `Saque rejeitado: ${notes}` : 'Saque rejeitado — saldo devolvido',
    })
    return true
  })
  if (!refunded) return R.badRequest(res, 'Saque já processado')
  audit({ type: 'WITHDRAWAL_REJECTED', userId: withdrawal.provider_id, entityType: 'ProviderWithdrawal', entityId: withdrawal.id, amount: withdrawal.amount, reason: typeof notes === 'string' ? notes : null })
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
  audit({ type: 'PIX_KEY_CHANGED', userId: req.userId, entityType: 'User', entityId: req.userId, after: { pix_key: parsed.data.pix_key, pix_key_type: parsed.data.pix_key_type } })
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
