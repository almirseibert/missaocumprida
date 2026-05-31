import { Router } from 'express'
import { authenticate } from '../../middlewares/auth'
import { listNotifications, markRead, markAllRead } from './notifications.controller'

const router = Router()

router.use(authenticate)

router.get('/', listNotifications)
router.patch('/read-all', markAllRead)
router.patch('/:id/read', markRead)

export default router
