import cors from 'cors'
import helmet from 'helmet'
import rateLimit, { ipKeyGenerator } from 'express-rate-limit'
import { env } from '../config/env'

// Origens autorizadas a chamar a API pelo navegador. Apps nativos (mobile) e
// chamadas servidor-a-servidor não enviam Origin e são liberados.
const allowedOrigins = [
  env.FRONTEND_URL,
  'http://localhost:3000',
  'http://localhost:3001',
].filter(Boolean)

export const corsMiddleware = cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true) // mobile/native/curl/healthcheck
    if (allowedOrigins.includes(origin)) return cb(null, true)
    return cb(new Error('Origin não permitida pelo CORS'))
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'X-Device-Id', 'X-App-Version'],
  exposedHeaders: ['X-Request-Id'],
})

// Headers de segurança. CSP desligado (API não serve HTML) e CORP em
// cross-origin para o front (outro domínio) poder exibir as imagens de /api/files.
export const helmetMiddleware = helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
})

const TOO_MANY_REQUESTS = { success: false, message: 'Muitas requisições. Tente novamente em instantes.' }

// Limite geral por sessão: requisições autenticadas contam por token (cada
// aparelho tem o seu), as anônimas por IP. Assim milhares de celulares atrás
// do mesmo IP da operadora (CGNAT) não dividem a mesma cota.
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const auth = req.headers.authorization
    if (typeof auth === 'string' && auth.startsWith('Bearer ') && auth.length > 40) {
      return `tok:${auth.slice(-43)}` // assinatura do JWT identifica a sessão
    }
    return `ip:${ipKeyGenerator(req.ip ?? '')}`
  },
  message: TOO_MANY_REQUESTS,
})

// Teto por IP, bem alto — só barra abuso evidente (tokens falsos rotativos).
export const apiIpLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5000,
  standardHeaders: false,
  legacyHeaders: false,
  message: TOO_MANY_REQUESTS,
})

const TOO_MANY_ATTEMPTS = { success: false, message: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' }

// Login — brute force é contra UMA conta: limite apertado por IP+e-mail.
// Operadoras móveis põem milhares de aparelhos atrás do mesmo IP (CGNAT), por
// isso o teto só por IP é bem mais alto.
export const loginAccountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : ''
    return `${ipKeyGenerator(req.ip ?? '')}:${email}`
  },
  message: TOO_MANY_ATTEMPTS,
})

export const loginIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: TOO_MANY_ATTEMPTS,
})

// Ações sensíveis que pedem senha (excluir conta, trocar senha, página pública
// de cancelamento): mesmo critério do login — por IP + e-mail/usuário.
export const sensitiveActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const who =
      (req as { userId?: string }).userId ||
      (typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '')
    return `${ipKeyGenerator(req.ip ?? '')}:${who}`
  },
  message: TOO_MANY_ATTEMPTS,
})

export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: TOO_MANY_ATTEMPTS,
})

// Refresh do token acontece sozinho a cada ~15 min em cada aparelho — com o
// limite antigo (30/15 min por IP, compartilhado com o login) usuários atrás
// do mesmo IP da operadora eram deslogados.
export const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: TOO_MANY_ATTEMPTS,
})
