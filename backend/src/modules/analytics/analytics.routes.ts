import { Router } from 'express'
import { authenticate, requireRole } from '../../middlewares/auth'
import {
  providerOverview, providerEarningsTimeseries,
  providerCategoriesPerformance, providerRecent,
} from './analytics.controller'

const router = Router()

router.use(authenticate)
router.use(requireRole('PROVIDER', 'BOTH', 'ADMIN'))

router.get('/provider/overview', providerOverview)
router.get('/provider/earnings-timeseries', providerEarningsTimeseries)
router.get('/provider/categories', providerCategoriesPerformance)
router.get('/provider/recent', providerRecent)

export default router
