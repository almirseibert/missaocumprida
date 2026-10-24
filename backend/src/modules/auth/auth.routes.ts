import { Router } from 'express'
import { register, login, refresh, logout } from './auth.controller'
import {
  loginAccountLimiter,
  loginIpLimiter,
  registerLimiter,
  refreshLimiter,
} from '../../middlewares/security'

const router = Router()

router.post('/register', registerLimiter, register)
router.post('/login', loginIpLimiter, loginAccountLimiter, login)
router.post('/refresh', refreshLimiter, refresh)
router.post('/logout', logout)

export default router
