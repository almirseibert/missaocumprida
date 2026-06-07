import { Router } from 'express'
import { authenticate } from '../../middlewares/auth'
import {
  createPackage, listPackages, getPackage, listProviderPackages,
  updatePackage, deletePackage, purchasePackage, listMyPackages,
} from './packages.controller'

const router = Router()

router.get('/', listPackages)                      // público
router.get('/mine', authenticate, listMyPackages)  // prestador autenticado
router.get('/:id', getPackage)                     // público
router.post('/', authenticate, createPackage)
router.patch('/:id', authenticate, updatePackage)
router.delete('/:id', authenticate, deletePackage)
router.post('/:id/purchase', authenticate, purchasePackage)

export default router

// Rota auxiliar para listar pacotes de um prestador específico
export const providerPackagesRouter = Router({ mergeParams: true })
providerPackagesRouter.get('/:providerId/packages', listProviderPackages)
