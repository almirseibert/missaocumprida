import { Router } from 'express'
import { authenticate, requireVerified, requireRole } from '../../middlewares/auth'
import { upload } from '../../middlewares/upload'
import {
  createOrder, listMyOrders, getProviderFeed,
  getOrder, uploadOrderPhotos, preUploadOrderPhotos, cancelOrder,
  updateOrder, deleteOrder,
  adminListOrders, adminGetOrder, adminCancelOrder,
} from './orders.controller'

const router = Router()

router.use(authenticate)

// Admin (antes de '/:id' para evitar conflito de rota)
router.get('/admin/list', requireRole('ADMIN'), adminListOrders)
router.get('/admin/orders/:id', requireRole('ADMIN'), adminGetOrder)
router.patch('/admin/orders/:id/cancel', requireRole('ADMIN'), adminCancelOrder)

router.post('/', requireVerified, createOrder)
// Fotos antes do pedido existir (antes de '/:id' para não colidir)
router.post('/photos', upload.array('photos', 20), preUploadOrderPhotos)
router.get('/', listMyOrders)
router.get('/feed', getProviderFeed)
router.get('/:id', getOrder)
router.post('/:id/photos', upload.array('photos', 20), uploadOrderPhotos)
router.patch('/:id/cancel', cancelOrder)
router.patch('/:id', updateOrder)
router.delete('/:id', deleteOrder)

export default router
