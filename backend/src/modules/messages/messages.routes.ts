import { Router } from 'express'
import { authenticate } from '../../middlewares/auth'
import { listMessages, sendMessage } from './messages.controller'

const router = Router({ mergeParams: true })

router.use(authenticate)

router.get('/', listMessages)
router.post('/', sendMessage)

export default router
