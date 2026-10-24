import express from 'express'
// Express 4 não captura erros de handlers async: sem isto, qualquer exceção
// num controller vira rejeição não tratada e derruba o processo (Node 15+).
import 'express-async-errors'
import path from 'path'
import { env } from './config/env'
import { errorHandler } from './middlewares/errorHandler'
import { blockLegacySensitiveUploads } from './middlewares/legacyUploads'
import { corsMiddleware, helmetMiddleware, apiLimiter, apiIpLimiter } from './middlewares/security'
import { requestContextMiddleware } from './utils/requestContext'
import compression from 'compression'

// Routers
import authRoutes from './modules/auth/auth.routes'
import usersRoutes from './modules/users/users.routes'
import categoriesRoutes from './modules/categories/categories.routes'
import ordersRoutes from './modules/orders/orders.routes'
import proposalsRoutes, { proposalActionsRouter } from './modules/proposals/proposals.routes'
import schedulesRoutes from './modules/schedules/schedules.routes'
import ratingsRoutes, { rateRouter } from './modules/ratings/ratings.routes'
import messagesRoutes from './modules/messages/messages.routes'
import paymentsRoutes from './modules/payments/payments.routes'
import notificationsRoutes from './modules/notifications/notifications.routes'
import pushRoutes from './modules/push/push.routes'
import referralsRoutes from './modules/referrals/referrals.routes'
import { sharePrivateRouter, sharePublicRouter } from './modules/public-share/public-share.routes'
import analyticsRoutes from './modules/analytics/analytics.routes'
import packagesRoutes, { providerPackagesRouter } from './modules/packages/packages.routes'
import {
  myAvailabilityRouter, providerAvailabilityRouter, directBookRouter,
} from './modules/availability/availability.routes'
import subscriptionsRoutes from './modules/subscriptions/subscriptions.routes'
import verificationRoutes, { rcWebhookRouter } from './modules/verification/verification.routes'
import recommendationsRoutes from './modules/recommendations/recommendations.routes'
import legalRoutes from './modules/legal/legal.routes'
import supportRoutes from './modules/support/support.routes'
import filesRoutes from './modules/files/files.routes'
import settingsRoutes from './modules/settings/settings.routes'
import geoRoutes from './modules/geo/geo.routes'
import announcementsRoutes from './modules/announcements/announcements.routes'
import auditAdminRoutes from './modules/audit/audit.routes'

const app = express()

// Atrás de proxy (EasyPanel/Traefik, Nginx...). Confia só no número de saltos
// configurado (padrão 1): `true` aceitaria qualquer X-Forwarded-For enviado
// pelo cliente e permitiria burlar o rate limit trocando o IP no cabeçalho.
app.set('trust proxy', env.TRUST_PROXY_HOPS)

// ---- Middlewares globais ----
// Contexto da requisição (id, IP, aparelho, autor) para a auditoria
app.use(requestContextMiddleware)
app.use(helmetMiddleware)
// gzip/br das respostas JSON (imagens já vêm comprimidas e ficam de fora)
app.use(compression({ threshold: 1024 }))
app.use(corsMiddleware)
app.use(apiIpLimiter)
app.use(apiLimiter)
app.use(express.json({ limit: '200kb' }))
app.use(express.urlencoded({ extended: true, limit: '200kb' }))

// ---- Imagens armazenadas no banco ----
app.use('/api/files', filesRoutes)

// ---- Arquivos estáticos legados (uploads em disco — compatibilidade) ----
// Imagens novas vão para o banco (/api/files/:id). Mantido para servir
// arquivos antigos que ainda existam em disco.
// Documentos KYC antigos podem estar em disco: nunca servi-los publicamente.
app.use('/uploads', blockLegacySensitiveUploads, express.static(path.resolve(env.UPLOAD_DIR)))

// ---- Health check ----
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', app: 'Missão Cumprida API', version: '1.0.0', time: new Date().toISOString() })
})

// ---- Rotas da API ----
app.use('/api/auth', authRoutes) // limites por rota em auth.routes.ts
app.use('/api/users', usersRoutes)
app.use('/api/users', ratingsRoutes)                              // GET /api/users/:userId/ratings
app.use('/api/categories', categoriesRoutes)
app.use('/api/orders', ordersRoutes)
app.use('/api/orders/:orderId/proposals', (req, res, next) => {
  // Repassa orderId para os controllers
  req.params.orderId = req.params.orderId
  next()
}, proposalsRoutes)
app.use('/api/proposals', proposalActionsRouter)
app.use('/api/schedules', schedulesRoutes)
app.use('/api/schedules', rateRouter)                             // POST /api/schedules/:scheduleId/rate
app.use('/api/schedules/:scheduleId/messages', messagesRoutes)    // GET/POST /api/schedules/:scheduleId/messages
app.use('/api/payments', paymentsRoutes)
app.use('/api/notifications', notificationsRoutes)
app.use('/api/push', pushRoutes)
app.use('/api/referrals', referralsRoutes)
app.use('/api/orders', sharePrivateRouter)        // POST/DELETE /api/orders/:id/share
app.use('/api/public', sharePublicRouter)         // GET /api/public/orders/:slug
app.use('/api/analytics', analyticsRoutes)
app.use('/api/packages', packagesRoutes)
app.use('/api/users', providerPackagesRouter)       // GET /api/users/:providerId/packages
app.use('/api/users/me/availability', myAvailabilityRouter)
app.use('/api/users', providerAvailabilityRouter)   // GET /api/users/:providerId/availability
app.use('/api/orders', directBookRouter)            // POST /api/orders/direct-book
app.use('/api/subscriptions', subscriptionsRoutes)
app.use('/api/verification/rc-webhook', rcWebhookRouter) // webhook RevenueCat (sem JWT)
app.use('/api/verification', verificationRoutes)
app.use('/api/recommendations', recommendationsRoutes)
app.use('/api/legal', legalRoutes)
app.use('/api/support', supportRoutes)
app.use('/api/config', settingsRoutes) // GET /public (apps) + GET/PUT (admin)
app.use('/api/geo', geoRoutes)         // CEP, endereço ↔ coordenadas
app.use('/api/announcements', announcementsRoutes) // avisos do admin (pop-up/banner + push)
app.use('/api/admin', auditAdminRoutes)          // rastreabilidade: linha do tempo, extrato, webhooks

// ---- 404 ----
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Rota não encontrada' })
})

// ---- Tratamento global de erros ----
app.use(errorHandler)

export default app
