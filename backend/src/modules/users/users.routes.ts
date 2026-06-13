import { Router } from 'express'
import { authenticate, requireRole } from '../../middlewares/auth'
import { upload } from '../../middlewares/upload'
import {
  getMe, getPublicProfile, updateMe, uploadAvatar, changePassword,
  addSkill, listSkills, removeSkill,
  submitVerification, getVerificationStatus, reviewVerification,
  adminListVerifications, updateOnboarding,
  adminListUsers, adminGetUser, adminSuspendUser, adminReactivateUser,
} from './users.controller'

const router = Router()

router.get('/me', authenticate, getMe)
router.put('/me', authenticate, updateMe)
router.post('/me/avatar', authenticate, upload.single('avatar'), uploadAvatar)
router.put('/me/password', authenticate, changePassword)
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
router.put('/:id/verification/review', authenticate, requireRole('ADMIN'), reviewVerification)
router.get('/:id', getPublicProfile)

export default router
