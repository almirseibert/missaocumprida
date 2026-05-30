import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../../config/database'
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../../utils/jwt'
import * as R from '../../utils/response'

const registerSchema = z.object({
  name: z.string().min(2, 'Nome deve ter ao menos 2 caracteres'),
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Senha deve ter ao menos 6 caracteres'),
  phone: z.string().optional(),
  role: z.enum(['CLIENT', 'PROVIDER', 'BOTH']).default('CLIENT'),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export async function register(req: Request, res: Response) {
  const parsed = registerSchema.safeParse(req.body)
  if (!parsed.success) {
    return R.badRequest(res, 'Dados inválidos', parsed.error.flatten().fieldErrors)
  }

  const { name, email, password, phone, role } = parsed.data

  const exists = await prisma.user.findUnique({ where: { email } })
  if (exists) return R.conflict(res, 'E-mail já cadastrado')

  const hashed = await bcrypt.hash(password, 10)
  const user = await prisma.user.create({
    data: { name, email, password: hashed, phone, role },
    select: { id: true, name: true, email: true, role: true, created_at: true },
  })

  const accessToken = generateAccessToken({ userId: user.id, role: user.role })
  const refreshToken = generateRefreshToken({ userId: user.id, role: user.role })

  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      user_id: user.id,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  })

  return R.created(res, { user, accessToken, refreshToken }, 'Cadastro realizado com sucesso')
}

export async function login(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) {
    return R.badRequest(res, 'Dados inválidos')
  }

  const { email, password } = parsed.data

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user || !user.is_active) return R.unauthorized(res, 'E-mail ou senha incorretos')

  const valid = await bcrypt.compare(password, user.password)
  if (!valid) return R.unauthorized(res, 'E-mail ou senha incorretos')

  const accessToken = generateAccessToken({ userId: user.id, role: user.role })
  const refreshToken = generateRefreshToken({ userId: user.id, role: user.role })

  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      user_id: user.id,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  })

  const { password: _, ...userSafe } = user
  return R.ok(res, { user: userSafe, accessToken, refreshToken }, 'Login realizado com sucesso')
}

export async function refresh(req: Request, res: Response) {
  const { refreshToken } = req.body
  if (!refreshToken) return R.badRequest(res, 'Refresh token não fornecido')

  const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } })
  if (!stored || stored.expires_at < new Date()) {
    return R.unauthorized(res, 'Refresh token inválido ou expirado')
  }

  try {
    const payload = verifyRefreshToken(refreshToken)
    const newAccessToken = generateAccessToken({ userId: payload.userId, role: payload.role })
    const newRefreshToken = generateRefreshToken({ userId: payload.userId, role: payload.role })

    await prisma.refreshToken.delete({ where: { token: refreshToken } })
    await prisma.refreshToken.create({
      data: {
        token: newRefreshToken,
        user_id: payload.userId,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })

    return R.ok(res, { accessToken: newAccessToken, refreshToken: newRefreshToken })
  } catch {
    return R.unauthorized(res, 'Refresh token inválido')
  }
}

export async function logout(req: Request, res: Response) {
  const { refreshToken } = req.body
  if (refreshToken) {
    await prisma.refreshToken.deleteMany({ where: { token: refreshToken } })
  }
  return R.ok(res, null, 'Logout realizado com sucesso')
}
