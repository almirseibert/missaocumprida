import { Router } from 'express'
import { authenticate, requireRole } from '../../middlewares/auth'
import { upload } from '../../middlewares/upload'
import { sensitiveActionLimiter } from '../../middlewares/security'
import {
  getMe, getPublicProfile, updateMe, uploadAvatar, changePassword, deleteMe,
  addSkill, listSkills, removeSkill,
  submitVerification, getVerificationStatus, reviewVerification,
  adminListVerifications, updateOnboarding,
  adminListUsers, adminGetUser, adminSuspendUser, adminReactivateUser, adminBanUser,
  adminLookupCpf, adminReleaseCpf,
  requestCancellationAndDeletion, undoDeletionRequest,
} from './users.controller'

const router = Router()

// Público — página web de cancelamento de assinatura + exclusão (LGPD/CDC)
router.post('/cancel-subscription-and-delete', sensitiveActionLimiter, requestCancellationAndDeletion)
router.post('/undo-deletion', sensitiveActionLimiter, undoDeletionRequest)

router.get('/me', authenticate, getMe)
router.put('/me', authenticate, updateMe)
router.delete('/me', authenticate, sensitiveActionLimiter, deleteMe)
router.post('/me/avatar', authenticate, upload.single('avatar'), uploadAvatar)
router.put('/me/password', authenticate, sensitiveActionLimiter, changePassword)
router.post('/me/skills', authenticate, addSkill)
router.get('/me/skills', authenticate, listSkills)
router.delete('/me/skills/:id', authenticate, removeSkill)
router.post(
  '/me/verification',
  authenticate,
  upload.fields([
    { name: 'document', maxCount: 1 },
    { name: 'selfie', maxCount: 1 },
  ]),
  submitVerification,
)
router.get('/me/verification', authenticate, getVerificationStatus)
router.put('/me/onboarding', authenticate, updateOnboarding)
router.get('/admin/verifications', authenticate, requireRole('ADMIN'), adminListVerifications)
router.get('/admin/list', authenticate, requireRole('ADMIN'), adminListUsers)
router.get('/admin/users/:id', authenticate, requireRole('ADMIN'), adminGetUser)
router.patch('/admin/users/:id/suspend', authenticate, requireRole('ADMIN'), adminSuspendUser)
router.patch('/admin/users/:id/reactivate', authenticate, requireRole('ADMIN'), adminReactivateUser)
router.post('/admin/users/:id/ban', authenticate, requireRole('ADMIN'), adminBanUser)
router.get('/admin/cpf', authenticate, requireRole('ADMIN'), adminLookupCpf)
router.post('/admin/cpf/release', authenticate, requireRole('ADMIN'), adminReleaseCpf)
router.put('/:id/verification/review', authenticate, requireRole('ADMIN'), reviewVerification)
router.get('/:id', getPublicProfile)

export default router
