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

// Cache curto do estado da conta: sem ele, um usuário banido/suspenso seguiria
// usando a API até o access token expirar (15 min).
const ACTIVE_TTL_MS = 30_000
const activeCache = new Map<string, { active: boolean; role: string; at: number }>()

async function loadAccountState(userId: string) {
  const hit = activeCache.get(userId)
  if (hit && Date.now() - hit.at < ACTIVE_TTL_MS) return hit
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { is_active: true, role: true } })
  const state = { active: !!user?.is_active, role: user?.role ?? '', at: Date.now() }
  if (activeCache.size > 50_000) activeCache.clear()
  activeCache.set(userId, state)
  return state
}

/** Invalida o cache após suspender/banir/excluir/reativar ou mudar o papel. */
export function invalidateAccountState(userId: string) {
  activeCache.delete(userId)
}

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return unauthorized(res, 'Token de acesso não fornecido')
  }

  const token = authHeader.split(' ')[1]
  let payload: { userId: string; role: string }
  try {
    payload = verifyAccessToken(token)
  } catch {
    return unauthorized(res, 'Token inválido ou expirado')
  }
  try {
    const state = await loadAccountState(payload.userId)
    if (!state.active) return unauthorized(res, 'Conta inativa')
    req.userId = payload.userId
    // Papel atual do banco: rebaixamentos de ADMIN valem na hora.
    req.userRole = state.role || payload.role
    next()
  } catch (err) {
    next(err)
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
