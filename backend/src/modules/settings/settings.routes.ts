import { Router } from 'express'
import { authenticate, requireRole } from '../../middlewares/auth'
import { getPublicConfig, adminGetSettings, adminUpdateSettings } from './settings.controller'

const router = Router()

// Público — apps leem no boot para exibir taxas/promo vigentes
router.get('/public', getPublicConfig)

// Admin — edição em runtime (sem redeploy)
router.get('/', authenticate, requireRole('ADMIN'), adminGetSettings)
router.put('/', authenticate, requireRole('ADMIN'), adminUpdateSettings)

export default router
