import QRCode from 'qrcode'
import { archiveScheduleTx } from '../schedules/scheduleArchive.service'
import { Prisma, ConnectionFee, OrderStatus } from '@prisma/client'
import { prisma } from '../../config/database'
import { env } from '../../config/env'
import { mpPayment, mpPreference } from './mercadopago'
import { getSettings, PlatformSettings } from '../settings/settings.service'
import { notify } from '../push/push.service'
import { accrueReferralVolume } from '../referrals/referrals.service'

/**
 * Taxa de Conexão (Remap 2.0)
 * ------------------------------------------------------------------
 * Ao aceitar uma proposta, cliente e prestador pagam cada um sua taxa
 * (percentual do valor da proposta, com piso antifraude). Só quando os
 * DOIS pagaram o pedido vira SCHEDULED e os contatos são liberados.
 * O pagamento do serviço em si é direto entre as partes — a plataforma
 * nunca custodia o valor do serviço.
 *
 * Fluxo: aceite → 2 fees PENDING → cliente paga (crédito abatido
 * automaticamente + Pix do restante com repasse de gateway) → prestador
 * notificado com prazo → prestador paga (saldo ou Pix) → SCHEDULED.
 * Timeout do prestador → taxa do cliente vira crédito e o pedido reabre.
 */

export class FeeFlowError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100

export function computeFeeBase(value: number, pct: number, min: number): number {
  return Math.max(round2(value * pct), round2(min))
}

/** Visão pública de uma taxa para as telas (inclui o "de X riscado"). */
export function feePublicView(fee: ConnectionFee, proposalValue: number, s: PlatformSettings) {
  const regularAmount = computeFeeBase(proposalValue, fee.regular_pct, s.fee_min)
  return {
    id: fee.id,
    side: fee.side,
    status: fee.status,
    pct_applied: fee.pct_applied,
    regular_pct: fee.regular_pct,
    promo_active: s.fee_promo_active && fee.regular_pct > fee.pct_applied,
    base_amount: fee.base_amount,
    regular_amount: regularAmount, // valor cheio — exibir riscado quando promo_active
    credit_used: fee.credit_used,
    surcharge_amount: fee.surcharge_amount,
    gateway_amount: fee.gateway_amount,
    method: fee.method,
    paid_at: fee.paid_at,
    expires_at: fee.expires_at,
  }
}

/**
 * Campos financeiros + status de um pedido que já nasce aceito (pacote ou
 * agendamento direto). Com as taxas ligadas fica ACCEPTED aguardando as duas
 * taxas, como no aceite de proposta; sem elas, vai direto para SCHEDULED.
 */
export function acceptedOrderFields(s: PlatformSettings, price: number) {
  const providerFee = computeFeeBase(price, s.fee_provider_pct, s.fee_min)
  const clientFee = computeFeeBase(price, s.fee_client_pct, s.fee_min)
  return {
    status: (env.FEES_ENABLED ? 'ACCEPTED' : 'SCHEDULED') as OrderStatus,
    final_price: price,
    platform_fee_pct: s.fee_provider_pct,
    platform_fee_value: providerFee,
    provider_amount: round2(price - providerFee),
    client_fee_pct: s.fee_client_pct,
    client_fee_value: clientFee,
    client_total: round2(price + clientFee),
  }
}

// ---------------------------------------------------------------------------
// Criação no aceite (dentro da transação do acceptProposal)
// ---------------------------------------------------------------------------
export async function createFeesOnAccept(
  tx: Prisma.TransactionClient,
  s: PlatformSettings,
  args: {
    order_id: string
    proposal_id: string
    client_id: string
    provider_id: string
    value: number
  },
) {
  // Benefício do cliente Pro: desconto na taxa de conexão dele
  const client = await tx.user.findUnique({ where: { id: args.client_id }, select: { is_verified_pro: true } })
  const discount = client?.is_verified_pro ? Math.min(Math.max(s.pro_client_fee_discount_pct, 0), 1) : 0
  const clientBase = round2(computeFeeBase(args.value, s.fee_client_pct, s.fee_min) * (1 - discount))
  const clientPct = Math.round(s.fee_client_pct * (1 - discount) * 10000) / 10000
  if (discount > 0) {
    await tx.order.update({
      where: { id: args.order_id },
      data: { client_fee_pct: clientPct, client_fee_value: clientBase, client_total: round2(args.value + clientBase) },
    })
  }
  await tx.connectionFee.createMany({
    data: [
      {
        order_id: args.order_id,
        proposal_id: args.proposal_id,
        user_id: args.client_id,
        side: 'CLIENT',
        pct_applied: clientPct,
        regular_pct: s.fee_regular_pct,
        base_amount: clientBase,
        notes: discount > 0 ? `Desconto Pro de ${Math.round(discount * 100)}%` : undefined,
      },
      {
        order_id: args.order_id,
        proposal_id: args.proposal_id,
        user_id: args.provider_id,
        side: 'PROVIDER',
        pct_applied: s.fee_provider_pct,
        regular_pct: s.fee_regular_pct,
        base_amount: computeFeeBase(args.value, s.fee_provider_pct, s.fee_min),
      },
    ],
  })
}

// ---------------------------------------------------------------------------
// Cobrança Pix no Mercado Pago (com simulação em dev/sandbox)
// ---------------------------------------------------------------------------
/** Validade do Pix gerado: QR antigo não deve ser pago depois de muito tempo. */
const PIX_EXPIRATION_MIN = 60

/** Data no formato aceito pelo Mercado Pago (yyyy-MM-ddTHH:mm:ss.SSS-03:00). */
function mpDateBrasilia(d: Date): string {
  return new Date(d.getTime() - 3 * 3600_000).toISOString().replace('Z', '-03:00')
}

function isRealMercadoPago(): boolean {
  return !!env.MP_ACCESS_TOKEN && !env.MP_ACCESS_TOKEN.startsWith('TEST-')
}

async function pixToQrBase64(pixCode: string): Promise<string> {
  return QRCode.toDataURL(pixCode).then((url) => url.replace('data:image/png;base64,', ''))
}

async function createFeePixCharge(args: {
  feeId: string
  amount: number
  description: string
  payer: { name: string; email: string; cpf: string | null }
}) {
  if (!isRealMercadoPago()) {
    // Dev/sandbox: gera um Pix fictício; confirmação via POST /payments/fees/simulate
    const devRef = `fee_dev_${Date.now()}`
    const cents = String(Math.round(args.amount * 100)).padStart(6, '0')
    const pixCode = `00020126580014BR.GOV.BCB.PIX0136${args.feeId}5204000053039865406${cents}5802BR5913Missao Cumprida6007Lajeado62070503***6304ABCD`
    return {
      mp_ref: devRef,
      payload: {
        pix_code: pixCode,
        pix_qr_base64: await pixToQrBase64(pixCode),
        mp_payment_id: devRef,
        dev_mode: true,
      },
    }
  }

  if (!args.payer.cpf) {
    throw new FeeFlowError(400, 'CPF obrigatório para pagamento via PIX. Atualize seu perfil antes de continuar.')
  }

  const nameParts = args.payer.name.trim().split(' ')
  const firstName = nameParts[0]
  const lastName = nameParts.slice(1).join(' ') || firstName
  const docNumber = args.payer.cpf.replace(/\D/g, '')
  const docType = docNumber.length === 14 ? 'CNPJ' : 'CPF'
  const notificationUrl =
    env.NODE_ENV === 'production' ? `${env.API_URL}/api/payments/mp-webhook` : undefined

  const mpResponse = await mpPayment.create({
    body: {
      transaction_amount: round2(args.amount),
      description: args.description.slice(0, 60),
      payment_method_id: 'pix',
      payer: {
        email: args.payer.email,
        first_name: firstName,
        last_name: lastName,
        identification: { type: docType, number: docNumber },
      },
      ...(notificationUrl ? { notification_url: notificationUrl } : {}),
      external_reference: `fee_${args.feeId}`,
      date_of_expiration: mpDateBrasilia(new Date(Date.now() + PIX_EXPIRATION_MIN * 60_000)),
    },
    // Idempotência no MP: o mesmo request repetido (retry de rede) não cria
    // uma segunda cobrança.
    requestOptions: { idempotencyKey: `fee_${args.feeId}_${Math.round(args.amount * 100)}_${Math.floor(Date.now() / 60_000)}` },
  })

  const mpId = String(mpResponse.id)
  const pixData = mpResponse.point_of_interaction?.transaction_data
  const pixCode = pixData?.qr_code ?? null
  const pixQrBase64 = pixData?.qr_code_base64 ?? (pixCode ? await pixToQrBase64(pixCode) : null)

  return {
    mp_ref: `mp_${mpId}`,
    payload: { pix_code: pixCode, pix_qr_base64: pixQrBase64, mp_payment_id: mpId },
  }
}

// ---------------------------------------------------------------------------
// Cobrança com cartão via Checkout Pro (preference → init_point no navegador).
// O webhook de payment confirma via external_reference (fee_<id>), igual ao Pix.
// ---------------------------------------------------------------------------
async function createFeeCardCharge(args: {
  feeId: string
  orderId: string
  amount: number
  description: string
  payer: { name: string; email: string }
}) {
  if (!isRealMercadoPago()) {
    // Dev/sandbox: sem checkout externo; confirmação via POST /payments/fees/simulate
    const devRef = `fee_dev_card_${Date.now()}`
    return {
      mp_ref: devRef,
      payload: { init_point: null as string | null, mp_payment_id: devRef, dev_mode: true },
    }
  }

  const notificationUrl =
    env.NODE_ENV === 'production' ? `${env.API_URL}/api/payments/mp-webhook` : undefined
  // Página pública: quem paga pelo app volta ao app pelo deep link sem
  // precisar de sessão no site.
  const backUrl = `${env.FRONTEND_URL}/retorno-pagamento?pedido=${args.orderId}`

  const pref = await mpPreference.create({
    body: {
      items: [
        {
          id: args.feeId,
          title: args.description.slice(0, 60),
          quantity: 1,
          unit_price: round2(args.amount),
          currency_id: 'BRL',
        },
      ],
      payer: { name: args.payer.name, email: args.payer.email },
      external_reference: `fee_${args.feeId}`,
      // Força cartão: o Pix tem fluxo próprio (QR na tela) e o boleto não faz
      // sentido para liberar contato na hora.
      payment_methods: {
        excluded_payment_types: [{ id: 'ticket' }, { id: 'bank_transfer' }, { id: 'atm' }],
      },
      back_urls: { success: backUrl, pending: backUrl, failure: backUrl },
      auto_return: 'approved',
      statement_descriptor: 'MISSAOCUMPRIDA',
      ...(notificationUrl ? { notification_url: notificationUrl } : {}),
    },
  })

  const initPoint = pref.init_point ?? pref.sandbox_init_point ?? null
  if (!initPoint) throw new FeeFlowError(502, 'Não foi possível iniciar o checkout com cartão')

  return {
    mp_ref: `mp_pref_${pref.id}`,
    payload: { init_point: initPoint as string | null, mp_payment_id: String(pref.id) },
  }
}

/**
 * Consulta o Pix gravado na taxa: se ainda estiver pendente (e for do mesmo
 * valor), devolve os dados do QR; se já foi aprovado (webhook atrasado),
 * confirma a taxa e devolve 'PAID'. Caso contrário, null (gerar um novo).
 */
async function reusePendingPix(
  feeId: string,
  mpRef: string | null,
  amount: number,
): Promise<{ pix_code: string; pix_qr_base64: string | null; mp_payment_id: string } | 'PAID' | null> {
  if (!isRealMercadoPago() || !mpRef?.startsWith('mp_') || mpRef.startsWith('mp_pref_')) return null
  try {
    const mpId = mpRef.slice('mp_'.length)
    const pay = await mpPayment.get({ id: mpId })
    if (pay.status === 'approved') {
      await markFeePaid(feeId, { finalStatus: 'PAID', mpRef })
      return 'PAID'
    }
    if (pay.status !== 'pending' || round2(Number(pay.transaction_amount ?? 0)) !== round2(amount)) return null
    if (pay.date_of_expiration && new Date(pay.date_of_expiration).getTime() < Date.now() + 2 * 60_000) return null
    const data = pay.point_of_interaction?.transaction_data
    if (!data?.qr_code) return null
    return {
      pix_code: data.qr_code,
      pix_qr_base64: data.qr_code_base64 ?? (await pixToQrBase64(data.qr_code)),
      mp_payment_id: mpId,
    }
  } catch (err) {
    console.warn('[taxa-conexao] não foi possível reutilizar o Pix pendente:', (err as Error).message)
    return null
  }
}

// ---------------------------------------------------------------------------
// Checkout da taxa (Pix) — cliente ou prestador
// ---------------------------------------------------------------------------
async function loadOrderForFee(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      client: { select: { id: true, name: true, email: true, cpf: true } },
      schedule: {
        select: {
          id: true,
          provider_id: true,
          provider: { select: { id: true, name: true, email: true, cpf: true } },
        },
      },
      connection_fees: true,
    },
  })
  if (!order) throw new FeeFlowError(404, 'Pedido não encontrado')
  return order
}

export async function startFeeCheckout(args: {
  userId: string
  orderId: string
  method: 'pix' | 'card'
  useCredit?: boolean
}) {
  const s = await getSettings()
  const order = await loadOrderForFee(args.orderId)

  const isClient = order.client_id === args.userId
  const isProvider = order.schedule?.provider_id === args.userId
  if (!isClient && !isProvider) throw new FeeFlowError(403, 'Sem acesso a este pedido')

  if (order.status !== 'ACCEPTED') {
    if (order.status === 'SCHEDULED') return { already_paid: true, status: 'SCHEDULED' }
    throw new FeeFlowError(400, `Este pedido não aguarda pagamento de taxa (status: ${order.status})`)
  }

  const side = isClient ? 'CLIENT' : 'PROVIDER'
  const fee = order.connection_fees.find((f) => f.side === side)
  if (!fee) throw new FeeFlowError(404, 'Taxa de conexão não encontrada para este pedido')
  if (fee.status === 'PAID' || fee.status === 'COVERED') {
    return { already_paid: true, status: fee.status }
  }
  if (fee.status !== 'PENDING') {
    throw new FeeFlowError(400, `Esta taxa não está mais pendente (status: ${fee.status})`)
  }

  if (side === 'PROVIDER') {
    if (!order.client_fee_paid_at) {
      throw new FeeFlowError(400, 'Aguarde o cliente pagar a taxa dele primeiro')
    }
    if (fee.expires_at && fee.expires_at.getTime() < Date.now()) {
      throw new FeeFlowError(400, 'O prazo para pagar esta taxa expirou')
    }
  }

  // Crédito da plataforma (cliente) é abatido automaticamente. A linha da
  // taxa fica travada (FOR UPDATE) durante o abatimento: checkouts simultâneos
  // esperam e enxergam o crédito já aplicado, em vez de cobrar o valor cheio.
  let creditUsed = fee.credit_used
  if (side === 'CLIENT' && (args.useCredit ?? true)) {
    creditUsed = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM connection_fees WHERE id = ${fee.id} FOR UPDATE`
      const current = await tx.connectionFee.findUnique({ where: { id: fee.id }, select: { credit_used: true } })
      if ((current?.credit_used ?? 0) > 0) return current!.credit_used
      const user = await tx.user.findUnique({ where: { id: args.userId }, select: { credit_balance: true } })
      const used = round2(Math.min(user?.credit_balance ?? 0, fee.base_amount))
      if (used <= 0) return 0
      const debited = await tx.user.updateMany({
        where: { id: args.userId, credit_balance: { gte: used } },
        data: { credit_balance: { decrement: used } },
      })
      if (debited.count === 0) return 0
      await tx.creditTransaction.create({
        data: { user_id: args.userId, amount: -used, reason: 'FEE_PAYMENT', ref_id: fee.id },
      })
      await tx.connectionFee.update({ where: { id: fee.id }, data: { credit_used: used } })
      return used
    })
  }

  const remaining = round2(fee.base_amount - creditUsed)
  if (remaining <= 0) {
    await markFeePaid(fee.id, { finalStatus: 'COVERED', method: 'credit' })
    return {
      covered_by_credit: true,
      status: 'COVERED',
      base_amount: fee.base_amount,
      credit_used: creditUsed,
      total: 0,
    }
  }

  // Repasse do meio de pagamento sobre a parte que vai ao gateway
  const surchargePct = args.method === 'card' ? s.gateway_surcharge_card : s.gateway_surcharge_pix
  const surcharge = round2(remaining * surchargePct)
  const gatewayTotal = round2(remaining + surcharge)

  // Pix já gerado e ainda pendente para o mesmo valor: devolve o mesmo QR em
  // vez de criar outra cobrança (antes, cada toque gerava um Pix novo e o
  // usuário podia pagar duas vezes).
  if (args.method === 'pix') {
    const reused = await reusePendingPix(fee.id, fee.mp_payment_id, gatewayTotal)
    if (reused === 'PAID') return { already_paid: true, status: 'PAID' }
    if (reused) {
      return {
        ...reused,
        side,
        method: args.method,
        base_amount: fee.base_amount,
        credit_used: creditUsed,
        surcharge_pct: surchargePct,
        surcharge_amount: surcharge,
        amount: gatewayTotal,
        promo_active: s.fee_promo_active && fee.regular_pct > fee.pct_applied,
        regular_amount: computeFeeBase(order.final_price ?? 0, fee.regular_pct, s.fee_min),
      }
    }
  }

  const payer = side === 'CLIENT' ? order.client : order.schedule!.provider
  const description = `Taxa de conexão — ${(order.title ?? 'serviço').slice(0, 40)}`
  const charge =
    args.method === 'card'
      ? await createFeeCardCharge({
          feeId: fee.id,
          orderId: order.id,
          amount: gatewayTotal,
          description,
          payer,
        })
      : await createFeePixCharge({
          feeId: fee.id,
          amount: gatewayTotal,
          description,
          payer,
        })

  await prisma.connectionFee.update({
    where: { id: fee.id },
    data: {
      method: args.method,
      surcharge_amount: surcharge,
      gateway_amount: gatewayTotal,
      mp_payment_id: charge.mp_ref,
    },
  })

  return {
    ...charge.payload,
    side,
    method: args.method,
    base_amount: fee.base_amount,
    credit_used: creditUsed,
    surcharge_pct: surchargePct,
    surcharge_amount: surcharge,
    amount: gatewayTotal,
    promo_active: s.fee_promo_active && fee.regular_pct > fee.pct_applied,
    regular_amount: computeFeeBase(order.final_price ?? 0, fee.regular_pct, s.fee_min),
  }
}

// ---------------------------------------------------------------------------
// Prestador paga a taxa com o saldo interno (padrão do boost)
// ---------------------------------------------------------------------------
export async function payProviderFeeWithBalance(args: { userId: string; orderId: string }) {
  const order = await loadOrderForFee(args.orderId)
  if (order.schedule?.provider_id !== args.userId) throw new FeeFlowError(403, 'Sem acesso a este pedido')
  if (order.status !== 'ACCEPTED') {
    if (order.status === 'SCHEDULED') return { already_paid: true, status: 'SCHEDULED' }
    throw new FeeFlowError(400, `Este pedido não aguarda pagamento de taxa (status: ${order.status})`)
  }

  const fee = order.connection_fees.find((f) => f.side === 'PROVIDER')
  if (!fee) throw new FeeFlowError(404, 'Taxa de conexão não encontrada')
  if (fee.status === 'PAID' || fee.status === 'COVERED') return { already_paid: true, status: fee.status }
  if (fee.status !== 'PENDING') throw new FeeFlowError(400, `Esta taxa não está mais pendente (status: ${fee.status})`)
  if (!order.client_fee_paid_at) throw new FeeFlowError(400, 'Aguarde o cliente pagar a taxa dele primeiro')
  if (fee.expires_at && fee.expires_at.getTime() < Date.now()) {
    throw new FeeFlowError(400, 'O prazo para pagar esta taxa expirou')
  }

  // Débito atômico: só desconta se houver saldo suficiente (sem surcharge —
  // pagamento com saldo não passa pelo gateway)
  const debited = await prisma.user.updateMany({
    where: { id: args.userId, provider_balance: { gte: fee.base_amount } },
    data: { provider_balance: { decrement: fee.base_amount } },
  })
  if (debited.count === 0) {
    throw new FeeFlowError(400, `Saldo insuficiente. A taxa é R$ ${fee.base_amount.toFixed(2)} — pague com Pix ou adicione saldo.`)
  }

  await prisma.connectionFee.update({
    where: { id: fee.id },
    data: { credit_used: fee.base_amount },
  })
  const ok = await markFeePaid(fee.id, { finalStatus: 'COVERED', method: 'balance' })
  if (!ok) {
    // corrida rara: outra via marcou a taxa primeiro — devolve o débito
    await prisma.user.update({
      where: { id: args.userId },
      data: { provider_balance: { increment: fee.base_amount } },
    })
    return { already_paid: true, status: 'PAID' }
  }

  return { paid_with_balance: true, status: 'COVERED', amount: fee.base_amount }
}

// ---------------------------------------------------------------------------
// Confirmação de pagamento (webhook MP / simulate) — idempotente
// ---------------------------------------------------------------------------
export async function markFeePaid(
  feeId: string,
  opts: { finalStatus: 'PAID' | 'COVERED'; method?: string; mpRef?: string },
): Promise<boolean> {
  const updated = await prisma.connectionFee.updateMany({
    where: { id: feeId, status: 'PENDING' },
    data: {
      status: opts.finalStatus,
      paid_at: new Date(),
      ...(opts.method ? { method: opts.method } : {}),
      ...(opts.mpRef ? { mp_payment_id: opts.mpRef } : {}),
    },
  })
  if (updated.count === 0) return false

  const fee = await prisma.connectionFee.findUnique({ where: { id: feeId } })
  if (!fee) return true
  if (fee.side === 'CLIENT') await handleClientFeePaid(fee)
  else await handleProviderFeePaid(fee)
  return true
}

async function handleClientFeePaid(fee: ConnectionFee) {
  const s = await getSettings()
  const dueAt = new Date(Date.now() + s.provider_fee_timeout_hours * 3600_000)

  await prisma.$transaction([
    prisma.order.update({
      where: { id: fee.order_id },
      data: { client_fee_paid_at: new Date(), provider_fee_due_at: dueAt },
    }),
    prisma.connectionFee.updateMany({
      where: { proposal_id: fee.proposal_id, side: 'PROVIDER', status: 'PENDING' },
      data: { expires_at: dueAt },
    }),
  ])

  const providerFee = await prisma.connectionFee.findUnique({
    where: { proposal_id_side: { proposal_id: fee.proposal_id, side: 'PROVIDER' } },
  })
  if (providerFee) {
    await notify(providerFee.user_id, {
      type: 'FEE_REQUIRED',
      title: 'Cliente confirmou! Pague sua taxa de conexão',
      body: `O cliente já pagou a taxa dele. Pague a sua (R$ ${providerFee.base_amount.toFixed(2)}) em até ${s.provider_fee_timeout_hours}h para liberar o contato e garantir o serviço.`,
      data: { order_id: fee.order_id },
      channel: 'payment',
    })
  }
}

async function handleProviderFeePaid(fee: ConnectionFee) {
  await prisma.order.update({
    where: { id: fee.order_id },
    data: { status: 'SCHEDULED', provider_fee_paid_at: new Date() },
  })

  const order = await prisma.order.findUnique({
    where: { id: fee.order_id },
    select: { id: true, title: true, client_id: true, final_price: true },
  })
  if (!order) return

  await notify(order.client_id, {
    type: 'CONTACT_UNLOCKED',
    title: 'Contato liberado! 🎉',
    body: `O profissional confirmou "${order.title}". Telefone, endereço e chat já estão disponíveis. O pagamento do serviço é combinado diretamente com ele.`,
    data: { order_id: order.id },
    channel: 'schedule_update',
  })
  await notify(fee.user_id, {
    type: 'CONTACT_UNLOCKED',
    title: 'Serviço confirmado! 🎉',
    body: `Taxa paga. Os dados do cliente de "${order.title}" foram liberados — combine os detalhes pelo chat.`,
    data: { order_id: order.id },
    channel: 'schedule_update',
  })

  // GMV do programa de indicação (antes disparava na liberação do escrow)
  await accrueReferralVolume(order.client_id, order.id, order.final_price ?? 0).catch(() => {})
}

/**
 * Localiza a taxa a partir do external_reference do webhook (fee_<id>).
 * Se a taxa já não estava pendente (paga por outro Pix, expirada, pedido
 * cancelado) e ESTE pagamento não é o que a quitou, o dinheiro entrou sem
 * serviço: devolve o valor como crédito/saldo uma única vez.
 */
export async function onFeePaidByExternalRef(externalRef: string, mpRef?: string, paidAmount = 0): Promise<boolean> {
  const feeId = externalRef.slice('fee_'.length)
  const paid = await markFeePaid(feeId, { finalStatus: 'PAID', mpRef })
  if (paid || !mpRef) return paid

  const fee = await prisma.connectionFee.findUnique({ where: { id: feeId } })
  if (!fee || fee.mp_payment_id === mpRef) return false // reentrega do mesmo webhook
  await creditOrphanPayment(fee, mpRef, paidAmount)
  return false
}

async function creditOrphanPayment(fee: ConnectionFee, mpRef: string, amount: number) {
  const value = round2(amount)
  if (value <= 0) return
  try {
    const credited = await prisma.$transaction(async (tx) => {
      // Idempotência: um crédito por pagamento do MP
      const already = await tx.creditTransaction.findFirst({
        where: { reason: 'MP_ORPHAN_PAYMENT', ref_id: mpRef },
        select: { id: true },
      })
      if (already) return false
      await tx.creditTransaction.create({
        data: { user_id: fee.user_id, amount: value, reason: 'MP_ORPHAN_PAYMENT', ref_id: mpRef },
      })
      await tx.user.update({
        where: { id: fee.user_id },
        data: fee.side === 'CLIENT'
          ? { credit_balance: { increment: value } }
          : { provider_balance: { increment: value } },
      })
      return true
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    if (!credited) return
    console.warn(`[taxa-conexao] pagamento ${mpRef} chegou com a taxa ${fee.id} em ${fee.status} — R$ ${value.toFixed(2)} creditados`)
    await notify(fee.user_id, {
      type: 'FEE_CREDITED',
      title: 'Pagamento devolvido como crédito 💚',
      body: `Recebemos um pagamento de R$ ${value.toFixed(2)} que não era mais necessário. O valor voltou como ${fee.side === 'CLIENT' ? 'crédito' : 'saldo'} na sua conta.`,
      data: { order_id: fee.order_id },
      channel: 'payment',
    }).catch(() => {})
  } catch (err) {
    console.error(`[taxa-conexao] falha ao creditar pagamento órfão ${mpRef}:`, err)
  }
}

/**
 * Estorno ou chargeback no Mercado Pago de um pagamento que quitou a taxa:
 * marca a taxa como REFUNDED (fila de exceção do admin decide o restante).
 */
export async function onFeeReversedByExternalRef(externalRef: string, mpRef: string, mpStatus: string) {
  const feeId = externalRef.slice('fee_'.length)
  const updated = await prisma.connectionFee.updateMany({
    where: { id: feeId, mp_payment_id: mpRef, status: { in: ['PAID', 'COVERED'] } },
    data: { status: 'REFUNDED', notes: `Mercado Pago: ${mpStatus} em ${new Date().toISOString()}` },
  })
  if (updated.count > 0) {
    console.warn(`[taxa-conexao] taxa ${feeId} ${mpStatus} no Mercado Pago (${mpRef}) — revisar no painel admin`)
  }
}

// ---------------------------------------------------------------------------
// Créditos (no-show / timeout / cancelamento) — devolve TUDO que foi gasto
// (crédito/saldo usado + valor pago no gateway) como crédito na plataforma.
// ---------------------------------------------------------------------------
export async function creditFee(
  fee: ConnectionFee,
  reason: string,
  opts: { notes?: string; adminId?: string } = {},
): Promise<boolean> {
  const refundable = round2(fee.credit_used + fee.gateway_amount)
  const updated = await prisma.connectionFee.updateMany({
    where: { id: fee.id, status: { in: ['PAID', 'COVERED'] } },
    data: {
      status: 'CREDITED',
      credited_at: new Date(),
      credit_reason: reason,
      notes: opts.notes,
      admin_reviewer_id: opts.adminId,
    },
  })
  if (updated.count === 0) return false

  if (refundable > 0) {
    if (fee.side === 'CLIENT') {
      await prisma.$transaction([
        prisma.user.update({
          where: { id: fee.user_id },
          data: { credit_balance: { increment: refundable } },
        }),
        prisma.creditTransaction.create({
          data: {
            user_id: fee.user_id,
            amount: refundable,
            reason: `FEE_CREDIT_${reason}`,
            ref_id: fee.id,
          },
        }),
      ])
    } else {
      await prisma.user.update({
        where: { id: fee.user_id },
        data: { provider_balance: { increment: refundable } },
      })
    }
  }

  await notify(fee.user_id, {
    type: 'FEE_CREDITED',
    title: 'Taxa devolvida como crédito 💚',
    body: `R$ ${refundable.toFixed(2)} voltaram como crédito na plataforma e serão abatidos automaticamente na próxima taxa.`,
    data: { order_id: fee.order_id },
    channel: 'payment',
  })
  return true
}

/** Cancela taxas ainda não pagas de uma proposta (cancelamento pré-pagamento). */
export async function cancelPendingFeesForProposal(proposalId: string): Promise<void> {
  await prisma.connectionFee.updateMany({
    where: { proposal_id: proposalId, status: 'PENDING' },
    data: { status: 'CANCELLED' },
  })
}

/**
 * Reabre um pedido cuja conexão quebrou (timeout ou cancelamento do prestador):
 * cancela a proposta aceita, restaura as demais para PENDING, remove o
 * Schedule e devolve o pedido para a fila.
 */
export async function reopenOrderFromBrokenMatch(
  orderId: string,
  acceptedProposalId: string,
  reason = 'BROKEN_MATCH',
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const schedule = await tx.schedule.findUnique({ where: { order_id: orderId } })
    if (schedule) {
      // Guarda agendamento + chat + avaliações antes de apagar (prova para o suporte)
      await archiveScheduleTx(tx, schedule.id, reason)
      await tx.message.deleteMany({ where: { schedule_id: schedule.id } })
      await tx.rating.deleteMany({ where: { schedule_id: schedule.id } })
      await tx.schedule.delete({ where: { id: schedule.id } })
    }
    await tx.proposal.update({
      where: { id: acceptedProposalId },
      data: { status: 'CANCELLED' },
    })
    const restored = await tx.proposal.updateMany({
      where: { order_id: orderId, status: 'REJECTED' },
      data: { status: 'PENDING' },
    })
    await tx.order.update({
      where: { id: orderId },
      data: {
        status: restored.count > 0 ? 'IN_PROPOSAL' : 'OPEN',
        client_fee_paid_at: null,
        provider_fee_paid_at: null,
        provider_fee_due_at: null,
        final_price: null,
      },
    })
  })
}

// ---------------------------------------------------------------------------
// Cron: expira taxas de prestador vencidas e recredita o cliente
// ---------------------------------------------------------------------------
export async function expireOverdueProviderFees(): Promise<{ expired: number }> {
  const now = new Date()
  const overdue = await prisma.order.findMany({
    where: {
      status: 'ACCEPTED',
      client_fee_paid_at: { not: null },
      provider_fee_paid_at: null,
      provider_fee_due_at: { lt: now },
    },
    include: { connection_fees: true },
  })

  let expired = 0
  for (const order of overdue) {
    try {
      const providerFee = order.connection_fees.find((f) => f.side === 'PROVIDER')
      const clientFee = order.connection_fees.find((f) => f.side === 'CLIENT')
      if (!providerFee) continue

      const marked = await prisma.connectionFee.updateMany({
        where: { id: providerFee.id, status: 'PENDING' },
        data: { status: 'EXPIRED' },
      })
      if (marked.count === 0) continue

      await prisma.user.update({
        where: { id: providerFee.user_id },
        data: { no_show_count: { increment: 1 } },
      })

      await reopenOrderFromBrokenMatch(order.id, providerFee.proposal_id, 'PROVIDER_FEE_TIMEOUT')

      if (clientFee) await creditFee(clientFee, 'PROVIDER_TIMEOUT')

      await notify(order.client_id, {
        type: 'FEE_CREDITED',
        title: 'O profissional não confirmou 😕',
        body: `O prestador não pagou a taxa dele no prazo. Sua taxa voltou como crédito — escolha outra proposta para "${order.title}".`,
        data: { order_id: order.id },
        channel: 'payment',
      })
      await notify(providerFee.user_id, {
        type: 'GENERAL',
        title: 'Você perdeu um serviço',
        body: `O prazo para pagar a taxa de conexão de "${order.title}" expirou e o pedido voltou para a fila.`,
        data: { order_id: order.id },
        channel: 'payment',
      })

      expired++
    } catch (err) {
      console.error(`[taxa-conexao] falha ao expirar pedido ${order.id}:`, err)
    }
  }
  return { expired }
}
