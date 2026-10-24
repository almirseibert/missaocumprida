import { Router, Request, Response } from 'express'
import { authenticate } from '../../middlewares/auth'
import { prisma } from '../../config/database'
import * as R from '../../utils/response'
import { TERMS_BODY_MARKDOWN, TERMS_EFFECTIVE_DATE, TERMS_TITLE, TERMS_VERSION } from './terms.text'
import { PRIVACY_BODY_MARKDOWN, PRIVACY_EFFECTIVE_DATE, PRIVACY_TITLE, PRIVACY_VERSION } from './privacy.text'

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

// Texto da política de privacidade — público
router.get('/privacy', (_req: Request, res: Response) => {
  return R.ok(res, {
    version: PRIVACY_VERSION,
    title: PRIVACY_TITLE,
    effective_date: PRIVACY_EFFECTIVE_DATE,
    body: PRIVACY_BODY_MARKDOWN,
  })
})

// Aceitação dos termos — autenticado
router.post('/terms/accept', authenticate, async (req: Request, res: Response) => {
  // req.ip respeita o "trust proxy" (app.ts): o X-Forwarded-For cru pode ser
  // forjado pelo próprio cliente.
  const ip = req.ip || req.socket.remoteAddress || null

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
