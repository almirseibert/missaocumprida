import { Request, Response, NextFunction } from 'express'
import { verifyAccessToken } from '../utils/jwt'
import { unauthorized, forbidden } from '../utils/response'

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
