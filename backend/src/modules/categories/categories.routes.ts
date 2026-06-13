import { Router } from 'express'
import { authenticate, requireRole } from '../../middlewares/auth'
import {
  listGroups, listCategories, getCategoryBySlug,
  getQuestionnaire, estimateCategoryPrice,
} from './categories.controller'
import {
  adminListGroups, adminCreateGroup, adminUpdateGroup, adminDeleteGroup,
  adminListCategories, adminCreateCategory, adminUpdateCategory, adminDeleteCategory,
  adminListFields, adminCreateField, adminUpdateField, adminDeleteField,
} from './categories.admin.controller'

const router = Router()

// ---- Admin (ANTES das rotas públicas com :slug para evitar conflito) ----
router.get('/admin/groups', authenticate, requireRole('ADMIN'), adminListGroups)
router.post('/admin/groups', authenticate, requireRole('ADMIN'), adminCreateGroup)
router.put('/admin/groups/:id', authenticate, requireRole('ADMIN'), adminUpdateGroup)
router.delete('/admin/groups/:id', authenticate, requireRole('ADMIN'), adminDeleteGroup)

router.get('/admin/categories', authenticate, requireRole('ADMIN'), adminListCategories)
router.post('/admin/categories', authenticate, requireRole('ADMIN'), adminCreateCategory)
router.put('/admin/categories/:id', authenticate, requireRole('ADMIN'), adminUpdateCategory)
router.delete('/admin/categories/:id', authenticate, requireRole('ADMIN'), adminDeleteCategory)

router.get('/admin/categories/:categoryId/fields', authenticate, requireRole('ADMIN'), adminListFields)
router.post('/admin/categories/:categoryId/fields', authenticate, requireRole('ADMIN'), adminCreateField)
router.put('/admin/fields/:id', authenticate, requireRole('ADMIN'), adminUpdateField)
router.delete('/admin/fields/:id', authenticate, requireRole('ADMIN'), adminDeleteField)

// ---- Público ----
router.get('/groups', listGroups)
router.get('/', listCategories)
router.get('/:slug', getCategoryBySlug)
router.get('/:slug/questionnaire', getQuestionnaire)
router.post('/:slug/estimate', estimateCategoryPrice)

export default router
