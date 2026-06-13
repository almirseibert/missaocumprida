import { Router } from 'express'
import { getFile } from './files.controller'

const router = Router()

router.get('/:id', getFile)

export default router
