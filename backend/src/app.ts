import express from 'express'
import cors from 'cors'
import path from 'path'
import { env } from './config/env'
import { errorHandler } from './middlewares/errorHandler'

// Routers
import authRoutes from './modules/auth/auth.routes'
import usersRoutes from './modules/users/users.routes'
import categoriesRoutes from './modules/categories/categories.routes'
import ordersRoutes from './modules/orders/orders.routes'
import proposalsRoutes, { proposalActionsRouter } from './modules/proposals/proposals.routes'
import schedulesRoutes from './modules/schedules/schedules.routes'
import ratingsRoutes, { rateRouter } from './modules/ratings/ratings.routes'
import messagesRoutes from './modules/messages/messages.routes'
import paymentsRoutes, { webhookRouter } from './modules/payments/payments.routes'
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
import verificationRoutes from './modules/verification/verification.routes'
import recommendationsRoutes from './modules/recommendations/recommendations.routes'
import legalRoutes from './modules/legal/legal.routes'
import supportRoutes from './modules/support/support.routes'

const app = express()

// ---- Webhook Stripe — precisa de raw body ANTES do express.json() ----
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }), webhookRouter)

// ---- Middlewares globais ----
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] }))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// ---- Arquivos estáticos (uploads) ----
app.use('/uploads', express.static(path.resolve(env.UPLOAD_DIR)))

// ---- Health check ----
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', app: 'Missão Cumprida API', version: '1.0.0', time: new Date().toISOString() })
})

// ---- Rotas da API ----
app.use('/api/auth', authRoutes)
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
app.use('/api/verification', verificationRoutes)
app.use('/api/recommendations', recommendationsRoutes)
app.use('/api/legal', legalRoutes)
app.use('/api/support', supportRoutes)

// ---- 404 ----
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Rota não encontrada' })
})

// ---- Tratamento global de erros ----
app.use(errorHandler)

export default app
