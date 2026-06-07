import { Request, Response, NextFunction } from 'express'
import { verifyAccessToken } from '../utils/jwt'
import { unauthorized, forbidden } from '../utils/response'
import { prisma } from '../config/database'

declare global {
  namespace Express {
    interface Request {
      userId: string
      userRole: string
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return unauthorized(res, 'Token de acesso não fornecido')
  }

  const token = authHeader.split(' ')[1]
  try {
    const payload = verifyAccessToken(token)
    req.userId = payload.userId
    req.userRole = payload.role
    next()
  } catch {
    return unauthorized(res, 'Token inválido ou expirado')
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!roles.includes(req.userRole)) {
      return forbidden(res, 'Você não tem permissão para esta ação')
    }
    next()
  }
}

// Exige que o usuário tenha aceitado os termos E tenha documentos aprovados.
// ADMINs são liberados sem verificação.
export async function requireVerified(req: Request, res: Response, next: NextFunction) {
  if (req.userRole === 'ADMIN') return next()
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: {
      terms_accepted_at: true,
      document_verification_status: true,
    },
  })
  if (!user) return unauthorized(res, 'Usuário não encontrado')
  if (!user.terms_accepted_at) {
    return forbidden(res, 'Aceite os termos de uso antes de continuar.')
  }
  if (user.document_verification_status !== 'APPROVED') {
    return forbidden(res, 'Sua conta ainda não foi verificada. Envie seus documentos para análise.')
  }
  next()
}
