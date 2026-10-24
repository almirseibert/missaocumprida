import { Router } from 'express'
import { authenticate, requireRole } from '../../middlewares/auth'
import {
  listAuditEvents, listAuditTypes, searchAudit,
  userTimeline, userAccessLogs, userLedger, userDossier, adjustBalance,
  orderDetails, orderTimeline, orderChat, orderDossier,
  refundCreditedFee,
  listWebhooks, getWebhook, replayWebhook,
  reconciliation,
} from './audit.admin.controller'

// Rastreabilidade do painel admin — montado em /api/admin
const router = Router()
router.use(authenticate, requireRole('ADMIN'))

router.get('/audit', listAuditEvents)
router.get('/audit/types', listAuditTypes)
router.get('/audit/search', searchAudit)

router.get('/users/:id/timeline', userTimeline)
router.get('/users/:id/access-logs', userAccessLogs)
router.get('/users/:id/ledger', userLedger)
router.get('/users/:id/dossier.csv', userDossier)
router.post('/users/:id/balance-adjust', adjustBalance)

router.get('/orders/:id', orderDetails)
router.get('/orders/:id/timeline', orderTimeline)
router.get('/orders/:id/chat', orderChat)
router.get('/orders/:id/dossier.csv', orderDossier)

router.post('/fees/:id/refund-credited', refundCreditedFee)

router.get('/webhooks', listWebhooks)
router.get('/webhooks/:id', getWebhook)
router.post('/webhooks/:id/replay', replayWebhook)

router.get('/reconciliation', reconciliation)

export default router
