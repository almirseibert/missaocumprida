import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
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
  allowedHeaders: ['Content-Type', 'Authorization'],
})

// Headers de segurança. CSP desligado (API não serve HTML) e CORP em
// cross-origin para o front (outro domínio) poder exibir as imagens de /api/files.
export const helmetMiddleware = helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
})

// Limite geral por IP (generoso) — protege contra abuso/scraping.
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Muitas requisições. Tente novamente em instantes.' },
})

// Limite estrito para autenticação — barra brute force em login/refresh/registro.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' },
})
