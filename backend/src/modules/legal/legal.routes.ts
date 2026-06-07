import { Router, Request, Response } from 'express'
import { authenticate } from '../../middlewares/auth'
import { prisma } from '../../config/database'
import * as R from '../../utils/response'
import { TERMS_BODY_MARKDOWN, TERMS_EFFECTIVE_DATE, TERMS_TITLE, TERMS_VERSION } from './terms.text'

const router = Router()

// Texto dos termos — público
router.get('/terms', (_req: Request, res: Response) => {
  return R.ok(res, {
    version: TERMS_VERSION,
    title: TERMS_TITLE,
    effective_date: TERMS_EFFECTIVE_DATE,
    body: TERMS_BODY_MARKDOWN,
  })
})

// Aceitação dos termos — autenticado
router.post('/terms/accept', authenticate, async (req: Request, res: Response) => {
  const ip =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    null

  const user = await prisma.user.update({
    where: { id: req.userId },
    data: {
      terms_accepted_at: new Date(),
      terms_version: TERMS_VERSION,
      terms_accepted_ip: ip,
    },
    select: {
      id: true,
      terms_accepted_at: true,
      terms_version: true,
    },
  })

  return R.ok(res, user, 'Termos aceitos com sucesso')
})

export default router
