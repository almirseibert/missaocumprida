import { Router } from 'express'
import { authenticate } from '../../middlewares/auth'
import {
  createProposal, listOrderProposals,
  acceptProposal, rejectProposal, cancelProposal, listMyProposals,
} from './proposals.controller'

const router = Router({ mergeParams: true })

router.use(authenticate)

// Montado em /api/orders/:orderId/proposals
router.post('/', createProposal)
router.get('/', listOrderProposals)

export default router

// Rotas avulsas de proposta (montadas em /api/proposals)
export const proposalActionsRouter = Router()
proposalActionsRouter.use(authenticate)
proposalActionsRouter.get('/mine', listMyProposals)
proposalActionsRouter.post('/:id/accept', acceptProposal)
proposalActionsRouter.post('/:id/reject', rejectProposal)
proposalActionsRouter.delete('/:id', cancelProposal)
