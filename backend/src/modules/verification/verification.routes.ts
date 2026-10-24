import { Router } from 'express'
import { authenticate, requireRole } from '../../middlewares/auth'
import {
  startVerification, subscribe, cancelSubscription, getMyStatus, syncMyStatus,
  adminApprove, adminReject, handleRevenueCatWebhook,
} from './verification.controller'

// Webhook da RevenueCat — SEM autenticação por JWT (autentica por segredo no
// header Authorization dentro do handler). Montado à parte no app.ts.
export const rcWebhookRouter = Router()
rcWebhookRouter.post('/', handleRevenueCatWebhook)

const router = Router()
router.use(authenticate)

router.get('/me', getMyStatus)
router.post('/sync', syncMyStatus)
router.post('/start', startVerification)
router.post('/subscribe', subscribe)
router.post('/cancel', cancelSubscription)

router.post('/admin/:userId/approve', requireRole('ADMIN'), adminApprove)
router.post('/admin/:userId/reject', requireRole('ADMIN'), adminReject)

export default router
