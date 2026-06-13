import { Router } from 'express'
import { authenticate, requireVerified, requireRole } from '../../middlewares/auth'
import { upload } from '../../middlewares/upload'
import {
  createOrder, listMyOrders, getProviderFeed,
  getOrder, uploadOrderPhotos, cancelOrder,
  adminListOrders, adminGetOrder, adminCancelOrder,
} from './orders.controller'

const router = Router()

router.use(authenticate)

// Admin (antes de '/:id' para evitar conflito de rota)
router.get('/admin/list', requireRole('ADMIN'), adminListOrders)
router.get('/admin/orders/:id', requireRole('ADMIN'), adminGetOrder)
router.patch('/admin/orders/:id/cancel', requireRole('ADMIN'), adminCancelOrder)

router.post('/', requireVerified, createOrder)
router.get('/', listMyOrders)
router.get('/feed', getProviderFeed)
router.get('/:id', getOrder)
router.post('/:id/photos', upload.array('photos', 5), uploadOrderPhotos)
router.patch('/:id/cancel', cancelOrder)

export default router
