import { Router } from 'express'
import { authenticate } from '../../middlewares/auth'
import { enableShare, disableShare, getPublicOrder } from './public-share.controller'

// Rotas autenticadas (montadas em /api/orders)
export const sharePrivateRouter = Router({ mergeParams: true })
sharePrivateRouter.post('/:id/share', authenticate, enableShare)
sharePrivateRouter.delete('/:id/share', authenticate, disableShare)

// Rotas públicas (sem auth) — montadas em /api/public
export const sharePublicRouter = Router()
sharePublicRouter.get('/orders/:slug', getPublicOrder)
