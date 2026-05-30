import { Router } from 'express'
import { authenticate } from '../../middlewares/auth'
import { rateSchedule, getUserRatings } from './ratings.controller'

const router = Router()

// POST /api/schedules/:scheduleId/rate  (montado no schedules router via app.ts)
export const rateRouter = Router()
rateRouter.use(authenticate)
rateRouter.post('/:scheduleId/rate', rateSchedule)

// GET /api/users/:userId/ratings
router.get('/:userId/ratings', getUserRatings)

export default router
