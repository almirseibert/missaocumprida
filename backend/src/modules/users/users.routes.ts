import { Router } from 'express'
import { authenticate } from '../../middlewares/auth'
import { upload } from '../../middlewares/upload'
import {
  getMe, getPublicProfile, updateMe, uploadAvatar, changePassword,
  addSkill, listSkills, removeSkill,
} from './users.controller'

const router = Router()

router.get('/me', authenticate, getMe)
router.put('/me', authenticate, updateMe)
router.post('/me/avatar', authenticate, upload.single('avatar'), uploadAvatar)
router.put('/me/password', authenticate, changePassword)
router.post('/me/skills', authenticate, addSkill)
router.get('/me/skills', authenticate, listSkills)
router.delete('/me/skills/:id', authenticate, removeSkill)
router.get('/:id', getPublicProfile)

export default router
