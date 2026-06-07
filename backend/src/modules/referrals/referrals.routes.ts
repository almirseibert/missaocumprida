import { Router } from 'express'
import { authenticate } from '../../middlewares/auth'
import {
  getMyCode, listEvents, listCreditTransactions, lookupCode,
} from './referrals.controller'

const router = Router()

router.get('/lookup/:code', lookupCode) // público
router.get('/my-code', authenticate, getMyCode)
router.get('/events', authenticate, listEvents)
router.get('/credits', authenticate, listCreditTransactions)

export default router
