import { Router } from 'express'
import { authenticate } from '../../middlewares/auth'
import { upload } from '../../middlewares/upload'
import {
  createOrder, listMyOrders, getProviderFeed,
  getOrder, uploadOrderPhotos, cancelOrder,
} from './orders.controller'

const router = Router()

router.use(authenticate)

router.post('/', createOrder)
router.get('/', listMyOrders)
router.get('/feed', getProviderFeed)
router.get('/:id', getOrder)
router.post('/:id/photos', upload.array('photos', 5), uploadOrderPhotos)
router.patch('/:id/cancel', cancelOrder)

export default router
