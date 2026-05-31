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

// ---- 404 ----
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Rota não encontrada' })
})

// ---- Tratamento global de erros ----
app.use(errorHandler)

export default app
