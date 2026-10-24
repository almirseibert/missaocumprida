import { AsyncLocalStorage } from 'async_hooks'
import crypto from 'crypto'
import type { Request, Response, NextFunction } from 'express'

/**
 * Contexto da requisição (quem, de onde, qual aparelho) disponível em
 * qualquer ponto do código sem passar parâmetro — usado pela auditoria.
 */
export type RequestContext = {
  requestId: string
  ip: string | null
  userAgent: string | null
  deviceId: string | null
  appVersion: string | null
  actorId?: string
  actorRole?: string
}

const storage = new AsyncLocalStorage<RequestContext>()

export function getRequestContext(): RequestContext | undefined {
  return storage.getStore()
}

/** Chamado pelo authenticate: a partir daqui as ações têm autor. */
export function setRequestActor(actorId: string, actorRole: string): void {
  const ctx = storage.getStore()
  if (ctx) {
    ctx.actorId = actorId
    ctx.actorRole = actorRole
  }
}

/** Executa fora de uma requisição (cron, webhook) com um contexto próprio. */
export function runWithContext<T>(ctx: Partial<RequestContext>, fn: () => T): T {
  return storage.run(
    {
      requestId: ctx.requestId ?? crypto.randomUUID(),
      ip: ctx.ip ?? null,
      userAgent: ctx.userAgent ?? null,
      deviceId: ctx.deviceId ?? null,
      appVersion: ctx.appVersion ?? null,
      actorId: ctx.actorId,
      actorRole: ctx.actorRole,
    },
    fn,
  )
}

function header(req: Request, name: string, max = 200): string | null {
  const v = req.headers[name]
  const s = Array.isArray(v) ? v[0] : v
  return s ? String(s).slice(0, max) : null
}

export function requestContextMiddleware(req: Request, res: Response, next: NextFunction) {
  const incoming = header(req, 'x-request-id', 64)
  const requestId = incoming && /^[\w-]{8,64}$/.test(incoming) ? incoming : crypto.randomUUID()
  res.setHeader('X-Request-Id', requestId)
  storage.run(
    {
      requestId,
      // req.ip respeita o "trust proxy" (app.ts): o X-Forwarded-For cru é forjável
      ip: req.ip ?? req.socket.remoteAddress ?? null,
      userAgent: header(req, 'user-agent', 300),
      deviceId: header(req, 'x-device-id', 100),
      appVersion: header(req, 'x-app-version', 50),
    },
    () => next(),
  )
}
