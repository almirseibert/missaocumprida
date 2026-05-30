import { Router } from 'express'
import { authenticate, requireRole } from '../../middlewares/auth'
import {
  getOrderPayment,
  handleWebhook,
  simulatePayment,
  getMyBalance,
  requestWithdrawal,
  listWithdrawals,
  approveWithdrawal,
  rejectWithdrawal,
  updatePixKey,
} from './payments.controller'

const router = Router()

// Webhook do Stripe — raw body (montado separadamente no app.ts)
export const webhookRouter = Router()
webhookRouter.post('/', handleWebhook)

// Rotas autenticadas
router.get('/order/:orderId', authenticate, getOrderPayment)
router.post('/simulate', authenticate, simulatePayment)

// Carteira do prestador
router.get('/my-balance', authenticate, getMyBalance)
router.post('/withdrawal', authenticate, requireRole('PROVIDER', 'BOTH'), requestWithdrawal)
router.get('/withdrawals', authenticate, listWithdrawals)

// Chave PIX
router.put('/pix-key', authenticate, updatePixKey)

// Admin
router.put('/withdrawals/:id/approve', authenticate, requireRole('ADMIN'), approveWithdrawal)
router.put('/withdrawals/:id/reject', authenticate, requireRole('ADMIN'), rejectWithdrawal)

export default router
