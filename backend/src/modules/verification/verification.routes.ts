import { Router } from 'express'
import { authenticate, requireRole } from '../../middlewares/auth'
import {
  startVerification, subscribe, cancelSubscription, getMyStatus,
  adminApprove, adminReject,
} from './verification.controller'

const router = Router()
router.use(authenticate)

router.get('/me', getMyStatus)
router.post('/start', startVerification)
router.post('/subscribe', subscribe)
router.post('/cancel', cancelSubscription)

router.post('/admin/:userId/approve', requireRole('ADMIN'), adminApprove)
router.post('/admin/:userId/reject', requireRole('ADMIN'), adminReject)

export default router
