import { Request } from 'express'
import { env } from '../config/env'

/**
 * Monta a base pública da API a partir do host real da requisição.
 *
 * Em produção (EasyPanel/Traefik, Nginx, etc.) o app fica atrás de um proxy
 * que injeta `x-forwarded-proto` e `x-forwarded-host`. Usar esses cabeçalhos
 * — em vez de uma env fixa — garante que as URLs geradas usem o domínio HTTPS
 * correto e nunca mais caiam em `http://localhost:3333`.
 *
 * Requer `app.set('trust proxy', true)` para que `req.protocol` respeite o
 * proxy quando os cabeçalhos forwarded não estiverem presentes.
 */
export function publicBaseUrl(req: Request): string {
  const fwdProto = (req.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0]?.trim()
  const fwdHost = (req.headers['x-forwarded-host'] as string | undefined)?.split(',')[0]?.trim()

  const proto = fwdProto || req.protocol || 'https'
  const host = fwdHost || req.get('host')

  if (host) return `${proto}://${host}`

  // Fallback final: env configurada (ou default de dev)
  return env.API_URL
}

/** URL pública de um arquivo armazenado no banco (tabela file_assets). */
export function fileAssetUrl(req: Request, id: string): string {
  return `${publicBaseUrl(req)}/api/files/${id}`
}
