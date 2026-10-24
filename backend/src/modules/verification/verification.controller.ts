import { Request, Response } from 'express'
import crypto from 'crypto'
import { z } from 'zod'
import { prisma } from '../../config/database'
import { env } from '../../config/env'
import { notify } from '../push/push.service'
import * as R from '../../utils/response'
import { isValidCpf, normalizeCpf, maskCpf } from '../../utils/cpf'
import {
  RcEvent,
  applyRevenueCatEvent,
  getProStatus,
  grantPro,
  revokePro,
  syncFromRevenueCat,
} from './pro.service'

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
  // O documento informado aqui tem de ser o CPF do próprio cadastro (1 conta por CPF)
  const me = await prisma.user.findUnique({ where: { id: req.userId! }, select: { cpf: true } })
  if (!isValidCpf(me?.cpf)) {
    return R.badRequest(res, 'Cadastre seu CPF no perfil e envie seus documentos antes de pedir o selo.')
  }
  if (normalizeCpf(parsed.data.document_number) !== normalizeCpf(me!.cpf)) {
    return R.badRequest(res, 'O CPF informado não confere com o CPF do seu cadastro.')
  }
  const updated = await prisma.user.update({
    where: { id: req.userId! },
    data: {
      verification_data: {
        full_name: parsed.data.full_name,
        // nunca guardar o número completo em JSON solto
        document_number: maskCpf(parsed.data.document_number),
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
// Cada evento fica em webhook_events: reenvio do mesmo id não reprocessa.
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb)
}

export async function handleRevenueCatWebhook(req: Request, res: Response) {
  // Autenticação do webhook (comparação em tempo constante)
  const auth = req.headers['authorization']
  if (!env.REVENUECAT_WEBHOOK_AUTH || typeof auth !== 'string' || !safeEqual(auth, env.REVENUECAT_WEBHOOK_AUTH)) {
    return res.sendStatus(401)
  }

  const event = (req.body?.event ?? {}) as RcEvent
  const externalId = event.id || `${event.type ?? 'UNKNOWN'}:${event.app_user_id ?? ''}:${event.event_timestamp_ms ?? Date.now()}`

  let record
  try {
    const existing = await prisma.webhookEvent.findUnique({
      where: { provider_external_id: { provider: 'REVENUECAT', external_id: externalId } },
    })
    if (existing && (existing.status === 'PROCESSED' || existing.status === 'IGNORED')) {
      return res.sendStatus(200) // já tratado — reenvio da RevenueCat
    }
    record = existing
      ? await prisma.webhookEvent.update({ where: { id: existing.id }, data: { attempts: { increment: 1 } } })
      : await prisma.webhookEvent.create({
          data: {
            provider: 'REVENUECAT',
            external_id: externalId,
            event_type: event.type ?? null,
            user_id: event.app_user_id ?? null,
            payload: JSON.parse(JSON.stringify(req.body ?? {})),
          },
        })
  } catch (err) {
    console.error('[RevenueCat Webhook] erro ao registrar evento:', err)
    return res.sendStatus(500)
  }

  try {
    const result = await applyRevenueCatEvent(event)
    await prisma.webhookEvent.update({
      where: { id: record.id },
      data: { status: result.status, error: result.note ?? null, user_id: result.userId ?? record.user_id, processed_at: new Date() },
    })
    return res.sendStatus(200)
  } catch (err) {
    // 500 faz a RevenueCat reenviar o evento (o processamento é idempotente).
    console.error('[RevenueCat Webhook] erro:', err)
    await prisma.webhookEvent
      .update({ where: { id: record.id }, data: { status: 'FAILED', error: String((err as Error)?.message ?? err).slice(0, 500) } })
      .catch(() => {})
    return res.sendStatus(500)
  }
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

// GET /api/verification/me — status da assinatura Pro (app e site)
export async function getMyStatus(req: Request, res: Response) {
  return R.ok(res, await getProStatus(req.userId!))
}

// POST /api/verification/sync — confere a assinatura direto na RevenueCat
// (chamado pelo app depois de comprar/restaurar). Não confia no aparelho.
export async function syncMyStatus(req: Request, res: Response) {
  try {
    const result = await syncFromRevenueCat(req.userId!)
    const status = await getProStatus(req.userId!)
    return R.ok(res, { ...status, synced: result.synced })
  } catch (err) {
    console.error('[verification/sync] erro:', err)
    return R.ok(res, { ...(await getProStatus(req.userId!)), synced: false }, 'Não foi possível confirmar com a loja agora')
  }
}

// POST /api/verification/admin/:userId/approve — admin concede o selo
// body: { months?: 1..24, reason }
const approveSchema = z.object({
  months: z.number().int().min(1).max(24).optional().default(1),
  reason: z.string().min(5).max(500),
})
export async function adminApprove(req: Request, res: Response) {
  const parsed = approveSchema.safeParse(req.body ?? {})
  if (!parsed.success) return R.badRequest(res, 'Informe o motivo da concessão (mín. 5 caracteres)')
  const userId = req.params.userId
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
  if (!target) return R.notFound(res, 'Usuário não encontrado')
  const periodEnd = new Date()
  periodEnd.setMonth(periodEnd.getMonth() + parsed.data.months)
  await grantPro({
    userId,
    periodEnd,
    source: 'ADMIN',
    willRenew: false,
    eventType: 'ADMIN_GRANT',
    grantedBy: req.userId,
    grantReason: parsed.data.reason,
  })
  return R.ok(res, { expires_at: periodEnd }, 'Selo concedido')
}

// POST /api/verification/admin/:userId/reject
const rejectSchema = z.object({ reason: z.string().max(500) })
export async function adminReject(req: Request, res: Response) {
  const parsed = rejectSchema.safeParse(req.body)
  if (!parsed.success) return R.badRequest(res, 'Dados inválidos')
  // Retira só a concessão do admin; assinatura paga na loja continua valendo
  await revokePro(req.params.userId, { source: 'ADMIN', eventType: 'ADMIN_REVOKE' })
  await prisma.user.update({
    where: { id: req.params.userId },
    data: {
      verification_data: {
        rejected_at: new Date().toISOString(),
        rejection_reason: parsed.data.reason,
      } as any,
    },
  })
  return R.ok(res, null, 'Verificação rejeitada')
}
