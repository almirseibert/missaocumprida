import { Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../../config/database'
import { env } from '../../config/env'
import * as R from '../../utils/response'
import { getSettings } from '../settings/settings.service'
import {
  FeeFlowError,
  startFeeCheckout,
  payProviderFeeWithBalance,
  markFeePaid,
  creditFee,
  feePublicView,
} from './connectionFees.service'

function handleFeeError(res: Response, err: unknown) {
  if (err instanceof FeeFlowError) {
    if (err.status === 403) return R.forbidden(res, err.message)
    if (err.status === 404) return R.notFound(res, err.message)
    return R.badRequest(res, err.message)
  }
  throw err
}

// ---------------------------------------------------------------------------
// POST /api/payments/fees/checkout — gera Pix da taxa (cliente ou prestador)
// ---------------------------------------------------------------------------
const checkoutSchema = z.object({
  order_id: z.string().uuid(),
  method: z.enum(['pix', 'card']).default('pix'),
  use_credit: z.boolean().optional(),
})

export async function checkoutFee(req: Request, res: Response) {
  const parsed = checkoutSchema.safeParse(req.body)
  if (!parsed.success) return R.badRequest(res, 'Dados inválidos', parsed.error.flatten().fieldErrors)
  try {
    const result = await startFeeCheckout({
      userId: req.userId!,
      orderId: parsed.data.order_id,
      method: parsed.data.method,
      useCredit: parsed.data.use_credit,
    })
    return R.ok(res, result)
  } catch (err) {
    return handleFeeError(res, err)
  }
}

// ---------------------------------------------------------------------------
// POST /api/payments/fees/pay-with-balance — prestador paga com saldo interno
// ---------------------------------------------------------------------------
export async function payFeeWithBalance(req: Request, res: Response) {
  const { order_id } = req.body as { order_id?: string }
  if (!order_id) return R.badRequest(res, 'order_id é obrigatório')
  try {
    const result = await payProviderFeeWithBalance({ userId: req.userId!, orderId: order_id })
    return R.ok(res, result, 'paid_with_balance' in result ? 'Taxa paga com saldo!' : undefined)
  } catch (err) {
    return handleFeeError(res, err)
  }
}

// ---------------------------------------------------------------------------
// GET /api/payments/fees/order/:orderId — status das duas taxas (polling)
// ---------------------------------------------------------------------------
export async function getOrderFees(req: Request, res: Response) {
  const order = await prisma.order.findUnique({
    where: { id: req.params.orderId },
    include: {
      connection_fees: true,
      schedule: { select: { id: true, provider_id: true } },
    },
  })
  if (!order) return R.notFound(res, 'Pedido não encontrado')

  const isClient = order.client_id === req.userId
  const isProvider = order.schedule?.provider_id === req.userId
  if (!isClient && !isProvider) return R.forbidden(res)

  const s = await getSettings()
  const value = order.final_price ?? 0
  const clientFee = order.connection_fees.find((f) => f.side === 'CLIENT')
  const providerFee = order.connection_fees.find((f) => f.side === 'PROVIDER')

  return R.ok(res, {
    order_id: order.id,
    order_status: order.status,
    viewer_side: isClient ? 'CLIENT' : 'PROVIDER',
    final_price: order.final_price,
    schedule_id: order.schedule?.id ?? null,
    client_fee: clientFee ? feePublicView(clientFee, value, s) : null,
    provider_fee: providerFee ? feePublicView(providerFee, value, s) : null,
    provider_fee_due_at: order.provider_fee_due_at,
    contacts_unlocked: !!order.provider_fee_paid_at,
  })
}

// ---------------------------------------------------------------------------
// POST /api/payments/fees/simulate — confirma taxa sem gateway (apenas dev)
// ---------------------------------------------------------------------------
export async function simulateFeePayment(req: Request, res: Response) {
  if (env.NODE_ENV === 'production') return R.forbidden(res, 'Disponível apenas em development')

  const { order_id, side } = req.body as { order_id?: string; side?: 'CLIENT' | 'PROVIDER' }
  if (!order_id) return R.badRequest(res, 'order_id é obrigatório')

  const order = await prisma.order.findUnique({
    where: { id: order_id },
    include: { connection_fees: true, schedule: { select: { provider_id: true } } },
  })
  if (!order) return R.notFound(res, 'Pedido não encontrado')

  const targetSide =
    side ?? (order.client_id === req.userId ? 'CLIENT' : 'PROVIDER')
  const fee = order.connection_fees.find((f) => f.side === targetSide)
  if (!fee) return R.notFound(res, 'Taxa não encontrada')
  if (fee.status !== 'PENDING') return R.ok(res, { status: fee.status }, 'Taxa já processada')
  if (targetSide === 'PROVIDER' && !order.client_fee_paid_at) {
    return R.badRequest(res, 'Simule primeiro o pagamento do cliente')
  }

  await markFeePaid(fee.id, { finalStatus: 'PAID', method: fee.method ?? 'pix' })
  return R.ok(res, { simulated: true, side: targetSide }, 'Pagamento da taxa simulado')
}

// ---------------------------------------------------------------------------
// Admin — fila de exceção das taxas
// ---------------------------------------------------------------------------
export async function adminListFees(req: Request, res: Response) {
  const { status } = req.query
  const fees = await prisma.connectionFee.findMany({
    where: status ? { status: status as never } : undefined,
    orderBy: { created_at: 'desc' },
    take: 100,
    include: {
      user: { select: { id: true, name: true, email: true } },
      order: { select: { id: true, title: true, status: true, final_price: true } },
    },
  })
  return R.ok(res, fees)
}

export async function adminCreditFee(req: Request, res: Response) {
  const fee = await prisma.connectionFee.findUnique({ where: { id: req.params.id } })
  if (!fee) return R.notFound(res, 'Taxa não encontrada')
  const ok = await creditFee(fee, 'ADMIN', {
    notes: (req.body?.notes as string) ?? undefined,
    adminId: req.userId,
  })
  if (!ok) return R.badRequest(res, `Taxa não pode ser creditada (status: ${fee.status})`)
  return R.ok(res, null, 'Taxa devolvida como crédito ao usuário')
}

export async function adminRefundFee(req: Request, res: Response) {
  const fee = await prisma.connectionFee.findUnique({ where: { id: req.params.id } })
  if (!fee) return R.notFound(res, 'Taxa não encontrada')

  const updated = await prisma.connectionFee.updateMany({
    where: { id: fee.id, status: { in: ['PAID', 'COVERED', 'CREDITED'] } },
    data: {
      status: 'REFUNDED',
      notes: (req.body?.notes as string) ?? undefined,
      admin_reviewer_id: req.userId,
    },
  })
  if (updated.count === 0) {
    return R.badRequest(res, `Taxa não pode ser estornada (status: ${fee.status})`)
  }
  return R.ok(
    res,
    null,
    'Taxa marcada como estornada. Faça o estorno bancário manualmente no painel do Mercado Pago.',
  )
}
