import { Router } from 'express'
import { authenticate } from '../../middlewares/auth'
import { listMySchedules, getSchedule, checkin, completeByProvider, confirmByClient } from './schedules.controller'

const router = Router()

router.use(authenticate)

router.get('/', listMySchedules)
router.get('/:id', getSchedule)
router.post('/:id/checkin', checkin)
router.post('/:id/complete', completeByProvider)
router.post('/:id/confirm', confirmByClient)

export default router
