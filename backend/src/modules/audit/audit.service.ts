// ============================================================
// Auditoria: registra quem fez o quê, quando e de onde.
// Usado pelo painel admin para responder reclamações e decidir estornos.
// - recordEvent(input, tx): dentro de uma transação, junto com a mudança.
// - audit(input): fora de transação; nunca derruba a operação principal.
// Dados pessoais são mascarados; senhas, tokens e imagens nunca entram.
// ============================================================
import { Prisma } from '@prisma/client'
import { prisma } from '../../config/database'
import { getRequestContext } from '../../utils/requestContext'

type Tx = Prisma.TransactionClient | typeof prisma

export type AuditInput = {
  type: string
  userId?: string | null
  counterpartId?: string | null
  orderId?: string | null
  entityType?: string | null
  entityId?: string | null
  amount?: number | null
  before?: unknown
  after?: unknown
  metadata?: unknown
  reason?: string | null
  /** Sobrepõe o autor do contexto (ex.: SYSTEM em cron, WEBHOOK). */
  actorId?: string | null
  actorRole?: string | null
}

const DROP_KEYS = new Set([
  'password', 'token', 'refreshToken', 'accessToken', 'refresh_token', 'data',
  'document_photo_url', 'selfie_photo_url', 'pix_qr_base64', 'pix_code',
])

function maskDigits(v: string, keepStart = 3, keepEnd = 2): string {
  const d = v.replace(/\D/g, '')
  if (d.length <= keepStart + keepEnd) return '***'
  return `${d.slice(0, keepStart)}***${d.slice(-keepEnd)}`
}

/** Mascara CPF, telefone e chave Pix; remove senha/token/imagem. */
export function redact(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined || depth > 4) return value ?? null
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redact(v, depth + 1))
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (DROP_KEYS.has(k)) continue
      if (typeof v === 'string' && (k === 'cpf' || k === 'document_number')) out[k] = maskDigits(v)
      else if (typeof v === 'string' && /phone|telefone/i.test(k)) out[k] = maskDigits(v, 4, 2)
      else if (typeof v === 'string' && k === 'pix_key') out[k] = v.length > 6 ? `${v.slice(0, 3)}***${v.slice(-2)}` : '***'
      else out[k] = redact(v, depth + 1)
    }
    return out
  }
  if (typeof value === 'string' && value.length > 2000) return `${value.slice(0, 2000)}…`
  return value
}

function toJson(v: unknown): Prisma.InputJsonValue | undefined {
  if (v === undefined || v === null) return undefined
  return JSON.parse(JSON.stringify(redact(v))) as Prisma.InputJsonValue
}

export async function recordEvent(input: AuditInput, tx: Tx = prisma): Promise<void> {
  const ctx = getRequestContext()
  await tx.auditEvent.create({
    data: {
      type: input.type,
      actor_id: input.actorId !== undefined ? input.actorId : ctx?.actorId ?? null,
      actor_role: input.actorRole !== undefined ? input.actorRole : ctx?.actorRole ?? (ctx?.actorId ? null : 'SYSTEM'),
      user_id: input.userId ?? null,
      counterpart_id: input.counterpartId ?? null,
      order_id: input.orderId ?? null,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      amount: input.amount ?? null,
      before: toJson(input.before),
      after: toJson(input.after),
      metadata: toJson(input.metadata),
      reason: input.reason ? input.reason.slice(0, 1000) : null,
      request_id: ctx?.requestId ?? null,
      ip: ctx?.ip ?? null,
      user_agent: ctx?.userAgent ?? null,
      device_id: ctx?.deviceId ?? null,
      app_version: ctx?.appVersion ?? null,
    },
  })
}

/** Registra sem bloquear: falha de auditoria vira log, não erro para o usuário. */
export function audit(input: AuditInput): void {
  recordEvent(input).catch((err) => console.error('[audit] falha ao registrar', input.type, err?.message ?? err))
}

/** Registro de acesso (login, refresh, logout) — Marco Civil art. 15. */
export function logAccess(event: string, userId: string | null, email?: string | null): void {
  const ctx = getRequestContext()
  prisma.accessLog
    .create({
      data: {
        event,
        user_id: userId,
        email: userId ? null : (email ?? null)?.slice(0, 200) ?? null,
        ip: ctx?.ip ?? null,
        user_agent: ctx?.userAgent ?? null,
        device_id: ctx?.deviceId ?? null,
        app_version: ctx?.appVersion ?? null,
      },
    })
    .catch((err) => console.error('[audit] access log', err?.message ?? err))
}
