import { Request, Response } from 'express'
import crypto from 'crypto'
import { z } from 'zod'
import { prisma } from '../../config/database'
import { env } from '../../config/env'
import { notify } from '../push/push.service'
import * as R from '../../utils/response'

const MONTHLY_VALUE = 29.90

// Fotos de documento/selfie NÃO entram por aqui: o fluxo oficial é o upload
// multipart de /api/users/me/verification, que persiste como FileAsset
// sensível. Aceitar URLs arbitrárias aqui permitiria apontar para hosts
// externos (SSRF/phishing na revisão do admin).
const startSchema = z.object({
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
        submitted_at: new Date().toISOString(),
      } as any,
    },
    select: { id: true, verification_data: true },
  })
  return R.ok(res, updated, 'Dados de verificação recebidos. Aguarde análise.')
}

// POST /api/verification/subscribe — DEPRECIADO.
// A ativação paga do Selo Pro é feita pela loja (Google Play Billing via
// RevenueCat) e concedida pelo webhook `/api/verification/rc-webhook`, OU por
// aprovação manual do admin. Este endpoint NÃO concede mais o selo — antes ele
// concedia de graça (sem cobrar), o que era um bug de receita e de política.
export async function subscribe(req: Request, res: Response) {
  const user = await prisma.user.findUnique({ where: { id: req.userId! }, select: { verification_data: true } })
  if (!user?.verification_data) {
    return R.badRequest(res, 'Envie seus dados de verificação primeiro (POST /api/verification/start)')
  }
  return R.badRequest(
    res,
    'A assinatura Verificado Pro é ativada pela loja do aplicativo (Google Play). Conclua a compra no app.',
  )
}

// POST /api/verification/rc-webhook — webhook da RevenueCat (Google Play Billing).
// Fonte de verdade da assinatura: concede/revoga o selo conforme os eventos.
// Autenticado por segredo compartilhado no header Authorization (config na RC).
const GRANT_EVENTS = new Set([
  'INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION', 'PRODUCT_CHANGE', 'NON_RENEWING_PURCHASE',
])
const REVOKE_EVENTS = new Set(['EXPIRATION'])

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb)
}

async function revokePro(userId: string) {
  await prisma.$transaction([
    prisma.verifiedProSubscription.updateMany({
      where: { user_id: userId, status: 'ACTIVE' },
      data: { status: 'CANCELLED', cancelled_at: new Date() },
    }),
    prisma.user.updateMany({
      where: { id: userId },
      data: { is_verified_pro: false, verified_pro_expires: new Date() },
    }),
  ])
}

export async function handleRevenueCatWebhook(req: Request, res: Response) {
  // Autenticação do webhook (comparação em tempo constante)
  const auth = req.headers['authorization']
  if (!env.REVENUECAT_WEBHOOK_AUTH || typeof auth !== 'string' || !safeEqual(auth, env.REVENUECAT_WEBHOOK_AUTH)) {
    return res.sendStatus(401)
  }

  try {
    const event = (req.body?.event ?? {}) as {
      type?: string
      app_user_id?: string
      expiration_at_ms?: number
      transferred_from?: string[]
      transferred_to?: string[]
    }
    const type = event.type ?? ''

    // "Restaurar compras" em outra conta move a assinatura: o selo sai da conta
    // antiga (a nova recebe um evento próprio de concessão/renovação).
    if (type === 'TRANSFER') {
      for (const fromId of event.transferred_from ?? []) {
        if (!fromId.startsWith('$RCAnonymousID')) await revokePro(fromId)
      }
      return res.sendStatus(200)
    }

    const userId = event.app_user_id
    if (!userId) return res.sendStatus(200) // nada a fazer

    // Ignora usuários anônimos da RC (ex.: "$RCAnonymousID:...")
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
    if (!user) return res.sendStatus(200)

    if (GRANT_EVENTS.has(type)) {
      const periodEnd = event.expiration_at_ms
        ? new Date(event.expiration_at_ms)
        : (() => { const d = new Date(); d.setMonth(d.getMonth() + 1); return d })()

      await prisma.$transaction(async (tx) => {
        const existing = await tx.verifiedProSubscription.findFirst({
          where: { user_id: userId, status: 'ACTIVE' },
        })
        if (existing) {
          await tx.verifiedProSubscription.update({
            where: { id: existing.id },
            data: { current_period_end: periodEnd },
          })
        } else {
          await tx.verifiedProSubscription.create({
            data: { user_id: userId, status: 'ACTIVE', current_period_end: periodEnd, monthly_value: MONTHLY_VALUE },
          })
        }
        const current = await tx.user.findUnique({ where: { id: userId }, select: { verified_pro_since: true, is_verified_pro: true } })
        await tx.user.update({
          where: { id: userId },
          data: {
            is_verified_pro: true,
            // Mantém a data original nas renovações
            verified_pro_since: current?.is_verified_pro && current.verified_pro_since ? current.verified_pro_since : new Date(),
            verified_pro_expires: periodEnd,
          },
        })
      })
      if (type === 'INITIAL_PURCHASE') await notify(userId, {
        type: 'VERIFIED_PRO',
        title: 'Selo Verificado Pro ativo ✓',
        body: 'Sua assinatura foi confirmada. Aproveite os benefícios!',
        data: {},
        channel: 'general',
      }).catch(() => {})
    } else if (REVOKE_EVENTS.has(type)) {
      await revokePro(userId)
    }
    // CANCELLATION (auto-renovação desligada) mantém o selo até EXPIRATION.
  } catch (err) {
    console.error('[RevenueCat Webhook] erro:', err)
  }
  return res.sendStatus(200)
}

// POST /api/verification/cancel — cancela assinatura
export async function cancelSubscription(req: Request, res: Response) {
  const sub = await prisma.verifiedProSubscription.findFirst({
    where: { user_id: req.userId!, status: 'ACTIVE' },
  })
  if (!sub) return R.notFound(res, 'Nenhuma assinatura ativa encontrada')
  // A assinatura é cobrada pela Google Play (RevenueCat). Cancelar só aqui
  // removeria o selo sem parar a cobrança, e a próxima RENEWAL o reativaria.
  // O selo é revogado pelo webhook (EXPIRATION) ao fim do período pago.
  return R.badRequest(
    res,
    'Cancele a assinatura na Google Play (Play Store → Pagamentos e assinaturas → Assinaturas). O selo fica ativo até o fim do período pago.',
  )
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
