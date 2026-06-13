import { Router } from 'express'
import { authenticate, requireRole } from '../../middlewares/auth'
import { listNotifications, markRead, markAllRead, adminBroadcast } from './notifications.controller'

const router = Router()

router.use(authenticate)

// Admin — comunicado/broadcast (antes de '/:id/read' para evitar conflito)
router.post('/admin/broadcast', requireRole('ADMIN'), adminBroadcast)

router.get('/', listNotifications)
router.patch('/read-all', markAllRead)
router.patch('/:id/read', markRead)

export default router
