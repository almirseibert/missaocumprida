import { Router } from 'express'
import { authenticate } from '../../middlewares/auth'
import { upload } from '../../middlewares/upload'
import { listMySchedules, getSchedule, checkin, completeByProvider, confirmByClient } from './schedules.controller'

const router = Router()

router.use(authenticate)

router.get('/', listMySchedules)
router.get('/:id', getSchedule)
router.post('/:id/checkin', upload.single('photo'), checkin)
router.post('/:id/complete', upload.single('photo'), completeByProvider)
router.post('/:id/confirm', confirmByClient)

export default router
