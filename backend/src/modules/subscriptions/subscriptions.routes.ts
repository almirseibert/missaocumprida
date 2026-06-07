import { Router } from 'express'
import { authenticate } from '../../middlewares/auth'
import {
  createSubscription, listSubscriptions, getSubscription,
  updateSubscription, cancelSubscription, skipNext,
} from './subscriptions.controller'

const router = Router()

router.use(authenticate)
router.post('/', createSubscription)
router.get('/', listSubscriptions)
router.get('/:id', getSubscription)
router.patch('/:id', updateSubscription)
router.delete('/:id', cancelSubscription)
router.post('/:id/skip-next', skipNext)

export default router
