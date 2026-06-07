import { Router } from 'express'
import { authenticate } from '../../middlewares/auth'
import {
  putMyRules, getMyRules, postException, deleteException,
  getProviderSlots, directBook,
} from './availability.controller'

// Rotas sob /api/users/me/availability
export const myAvailabilityRouter = Router()
myAvailabilityRouter.get('/', authenticate, getMyRules)
myAvailabilityRouter.put('/', authenticate, putMyRules)
myAvailabilityRouter.post('/exception', authenticate, postException)
myAvailabilityRouter.delete('/exception/:id', authenticate, deleteException)

// Rotas públicas sob /api/users/:providerId/availability
export const providerAvailabilityRouter = Router({ mergeParams: true })
providerAvailabilityRouter.get('/:providerId/availability', getProviderSlots)

// Rota de booking direto sob /api/orders/direct-book
export const directBookRouter = Router()
directBookRouter.post('/direct-book', authenticate, directBook)
