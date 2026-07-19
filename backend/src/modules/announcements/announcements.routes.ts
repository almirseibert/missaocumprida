import { Router } from 'express'
import { authenticate, requireRole } from '../../middlewares/auth'
import {
  listActiveAnnouncements,
  adminCreateAnnouncement,
  adminListAnnouncements,
  adminDeleteAnnouncement,
  adminSendAnnouncementPush,
} from './announcements.controller'

const router = Router()

router.get('/active', authenticate, listActiveAnnouncements)

router.get('/admin', authenticate, requireRole('ADMIN'), adminListAnnouncements)
router.post('/admin', authenticate, requireRole('ADMIN'), adminCreateAnnouncement)
router.delete('/admin/:id', authenticate, requireRole('ADMIN'), adminDeleteAnnouncement)
router.post('/admin/:id/send-push', authenticate, requireRole('ADMIN'), adminSendAnnouncementPush)

export default router
