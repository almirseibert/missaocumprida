import { Router } from 'express'
import { authenticate } from '../../middlewares/auth'
import { registerToken, unregisterToken, updatePreferences, sendTest } from './push.controller'

const router = Router()
router.use(authenticate)

router.post('/register', registerToken)
router.delete('/token/:token', unregisterToken)
router.put('/preferences', updatePreferences)
router.post('/test', sendTest)

export default router
