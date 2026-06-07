import { Router } from 'express'
import { authenticate } from '../../middlewares/auth'
import { afterOrder, recentProviders } from './recommendations.controller'

const router = Router()
router.use(authenticate)
router.get('/after-order/:orderId', afterOrder)
router.get('/recent-providers', recentProviders)

export default router
