import { Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../../config/database'
import * as R from '../../utils/response'

const MONTHLY_VALUE = 29.90

const startSchema = z.object({
  document_photo_url: z.string().url().optional(),
  selfie_photo_url: z.string().url().optional(),
  full_name: z.string().min(3).max(200),
  document_number: z.string().min(5).max(30),
  background_check_consent: z.boolean(),
})

// POST /api/verification/start — coleta dados de verificação
export async function startVerification(req: Request, res: Response) {
  const parsed = startSchema.safeParse(req.body)
  if (!parsed.success) return R.badRequest(res, 'Dados inválidos', parsed.error.flatten().fieldErrors)
  if (!parsed.data.background_check_consent) {
    return R.badRequest(res, 'É necessário consentir com a checagem de antecedentes')
  }
  const updated = await prisma.user.update({
    where: { id: req.userId! },
    data: {
      verification_data: {
        full_name: parsed.data.full_name,
        document_number: parsed.data.document_number,
        document_photo_url: parsed.data.document_photo_url ?? null,
        selfie_photo_url: parsed.data.selfie_photo_url ?? null,
        submitted_at: new Date().toISOString(),
      } as any,
    },
    select: { id: true, verification_data: true },
  })
  return R.ok(res, updated, 'Dados de verificação recebidos. Aguarde análise.')
}

// POST /api/verification/subscribe — ativa assinatura mensal
// Em produção, integrar com Stripe Subscription; aqui registramos o intent
const subscribeSchema = z.object({
  stripe_sub_id: z.string().optional(),
  payment_method: z.enum(['PIX', 'CARD']).default('PIX'),
})

export async function subscribe(req: Request, res: Response) {
  const parsed = subscribeSchema.safeParse(req.body)
  if (!parsed.success) return R.badRequest(res, 'Dados inválidos', parsed.error.flatten().fieldErrors)

  // Bloqueia se ainda não enviou dados de verificação
  const user = await prisma.user.findUnique({ where: { id: req.userId! }, select: { verification_data: true } })
  if (!user?.verification_data) {
    return R.badRequest(res, 'Envie seus dados de verificação primeiro (POST /api/verification/start)')
  }

  // Evita duplicar assinatura ativa
  const existing = await prisma.verifiedProSubscription.findFirst({
    where: { user_id: req.userId!, status: 'ACTIVE' },
  })
  if (existing) return R.badRequest(res, 'Você já tem uma assinatura Verificado Pro ativa')

  const periodEnd = new Date()
  periodEnd.setMonth(periodEnd.getMonth() + 1)

  const sub = await prisma.$transaction(async (tx) => {
    const created = await tx.verifiedProSubscription.create({
      data: {
        user_id: req.userId!,
        stripe_sub_id: parsed.data.stripe_sub_id ?? null,
        status: 'ACTIVE',
        current_period_end: periodEnd,
        monthly_value: MONTHLY_VALUE,
      },
    })
    // Pré-ativa o selo — APROVAÇÃO MANUAL pelo admin é o gate final em produção
    await tx.user.update({
      where: { id: req.userId! },
      data: {
        is_verified_pro: true,
        verified_pro_since: new Date(),
        verified_pro_expires: periodEnd,
      },
    })
    return created
  })
  return R.created(res, sub, 'Assinatura Verificado Pro ativada')
}

// POST /api/verification/cancel — cancela assinatura
export async function cancelSubscription(req: Request, res: Response) {
  const sub = await prisma.verifiedProSubscription.findFirst({
    where: { user_id: req.userId!, status: 'ACTIVE' },
  })
  if (!sub) return R.notFound(res, 'Nenhuma assinatura ativa encontrada')
  await prisma.$transaction([
    prisma.verifiedProSubscription.update({
      where: { id: sub.id },
      data: { status: 'CANCELLED', cancelled_at: new Date() },
    }),
    prisma.user.update({
      where: { id: req.userId! },
      data: { is_verified_pro: false, verified_pro_expires: new Date() },
    }),
  ])
  return R.ok(res, null, 'Assinatura cancelada. Selo será removido imediatamente.')
}

// GET /api/verification/me — status do usuário
export async function getMyStatus(req: Request, res: Response) {
  const user = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: {
      id: true,
      is_verified_pro: true,
      verified_pro_since: true,
      verified_pro_expires: true,
      verification_data: true,
    },
  })
  const activeSub = await prisma.verifiedProSubscription.findFirst({
    where: { user_id: req.userId!, status: 'ACTIVE' },
  })
  return R.ok(res, { ...user, active_subscription: activeSub, monthly_value: MONTHLY_VALUE })
}

// POST /api/verification/admin/:userId/approve — admin aprova
export async function adminApprove(req: Request, res: Response) {
  const userId = req.params.userId
  const periodEnd = new Date()
  periodEnd.setMonth(periodEnd.getMonth() + 1)
  await prisma.user.update({
    where: { id: userId },
    data: {
      is_verified_pro: true,
      verified_pro_since: new Date(),
      verified_pro_expires: periodEnd,
    },
  })
  return R.ok(res, null, 'Selo concedido')
}

// POST /api/verification/admin/:userId/reject
const rejectSchema = z.object({ reason: z.string().max(500) })
export async function adminReject(req: Request, res: Response) {
  const parsed = rejectSchema.safeParse(req.body)
  if (!parsed.success) return R.badRequest(res, 'Dados inválidos')
  await prisma.user.update({
    where: { id: req.params.userId },
    data: {
      is_verified_pro: false,
      verification_data: {
        rejected_at: new Date().toISOString(),
        rejection_reason: parsed.data.reason,
      } as any,
    },
  })
  return R.ok(res, null, 'Verificação rejeitada')
}
