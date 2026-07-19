import { Router } from 'express'
import { authenticate, requireRole } from '../../middlewares/auth'
import {
  createCheckout,
  getOrderPayment,
  handleMpWebhook,
  simulatePayment,
  getMyBalance,
  requestWithdrawal,
  listWithdrawals,
  approveWithdrawal,
  rejectWithdrawal,
  updatePixKey,
  adminListTransactions,
  adminApproveTransaction,
  adminDisputeTransaction,
  adminRefundTransaction,
  adminListWithdrawals,
} from './payments.controller'
import {
  checkoutFee,
  payFeeWithBalance,
  getOrderFees,
  simulateFeePayment,
  adminListFees,
  adminCreditFee,
  adminRefundFee,
} from './connectionFees.controller'

const router = Router()

// Webhook do Mercado Pago — sem autenticação, sem raw body
router.post('/mp-webhook', handleMpWebhook)

// ---- Taxa de Conexão (Remap 2.0) ----
router.post('/fees/checkout', authenticate, checkoutFee)
router.post('/fees/pay-with-balance', authenticate, requireRole('PROVIDER', 'BOTH'), payFeeWithBalance)
router.get('/fees/order/:orderId', authenticate, getOrderFees)
router.post('/fees/simulate', authenticate, simulateFeePayment)
router.get('/admin/fees', authenticate, requireRole('ADMIN'), adminListFees)
router.post('/admin/fees/:id/credit', authenticate, requireRole('ADMIN'), adminCreditFee)
router.post('/admin/fees/:id/refund', authenticate, requireRole('ADMIN'), adminRefundFee)

// Rotas autenticadas — fluxo LEGADO de escrow (deprecated; ver connectionFees)
router.post('/create-checkout', authenticate, createCheckout)
router.get('/order/:orderId', authenticate, getOrderPayment)
router.post('/simulate', authenticate, simulatePayment)

// Carteira do prestador
router.get('/my-balance', authenticate, getMyBalance)
router.post('/withdrawal', authenticate, requireRole('PROVIDER', 'BOTH'), requestWithdrawal)
router.get('/withdrawals', authenticate, listWithdrawals)

// Chave PIX
router.put('/pix-key', authenticate, updatePixKey)

// Admin — saques
router.put('/withdrawals/:id/approve', authenticate, requireRole('ADMIN'), approveWithdrawal)
router.put('/withdrawals/:id/reject', authenticate, requireRole('ADMIN'), rejectWithdrawal)

// Admin — Segurança de Transação (revisão de pagamentos em garantia)
router.get('/admin/withdrawals', authenticate, requireRole('ADMIN'), adminListWithdrawals)
router.get('/admin/transactions', authenticate, requireRole('ADMIN'), adminListTransactions)
router.post('/admin/transactions/:id/approve', authenticate, requireRole('ADMIN'), adminApproveTransaction)
router.post('/admin/transactions/:id/dispute', authenticate, requireRole('ADMIN'), adminDisputeTransaction)
router.post('/admin/transactions/:id/refund', authenticate, requireRole('ADMIN'), adminRefundTransaction)

export default router
