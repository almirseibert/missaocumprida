import { Router } from 'express'
import { listGroups, listCategories, getCategoryBySlug, getQuestionnaire } from './categories.controller'

const router = Router()

router.get('/groups', listGroups)
router.get('/', listCategories)
router.get('/:slug', getCategoryBySlug)
router.get('/:slug/questionnaire', getQuestionnaire)

export default router
