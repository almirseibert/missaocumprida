import { Router } from 'express'
import { authenticate, requireRole } from '../../middlewares/auth'
import {
  createTicket, listMyTickets, getMyTicket, replyToTicket,
  adminListTickets, adminUpdateStatus, adminAssign,
} from './support.controller'

const router = Router()
router.use(authenticate)

// Usuários (cliente/prestador) — abrir e acompanhar
router.post('/', createTicket)
router.get('/mine', listMyTickets)
router.get('/:id', getMyTicket)
router.post('/:id/reply', replyToTicket)

// Admin
router.get('/admin/list', requireRole('ADMIN'), adminListTickets)
router.patch('/admin/:id/status', requireRole('ADMIN'), adminUpdateStatus)
router.patch('/admin/:id/assign', requireRole('ADMIN'), adminAssign)

export default router
