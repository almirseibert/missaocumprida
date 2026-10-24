import { Router } from 'express'
import { authenticate } from '../../middlewares/auth'
import { upload } from '../../middlewares/upload'
import {
  listMySchedules, getSchedule, checkin, completeByProvider, confirmByClient,
  cancelSchedule, reportNoShow,
} from './schedules.controller'

const router = Router()

router.use(authenticate)

router.get('/', listMySchedules)
router.get('/:id', getSchedule)
// Várias fotos por etapa: campo "photos" (novo) e "photo" (app antigo, 1 foto)
const servicePhotos = upload.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'photos', maxCount: 20 },
])
router.post('/:id/checkin', servicePhotos, checkin)
router.post('/:id/complete', servicePhotos, completeByProvider)
router.post('/:id/confirm', confirmByClient)
router.post('/:id/cancel', cancelSchedule)
router.post('/:id/report-no-show', reportNoShow)

export default router
