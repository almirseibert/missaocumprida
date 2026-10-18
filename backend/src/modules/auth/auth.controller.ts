import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../../config/database'
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../../utils/jwt'
import * as R from '../../utils/response'
import { applyReferralOnRegister, ensureReferralCode } from '../referrals/referrals.service'

const registerSchema = z.object({
  name: z.string().min(2, 'Nome deve ter ao menos 2 caracteres'),
  email: z.string().trim().toLowerCase().pipe(z.string().email('E-mail inválido')),
  password: z.string().min(8, 'Senha deve ter ao menos 8 caracteres').max(128),
  phone: z.string().optional(),
  role: z.enum(['CLIENT', 'PROVIDER', 'BOTH']).default('CLIENT'),
  // Trata string vazia como ausente — clientes enviavam "" e a validação
  // (min. 3) fazia o cadastro sem código de amigo falhar com "Dados inválidos".
  referral_code: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().trim().min(3).max(20).optional(),
  ),
})

const loginSchema = z.object({
  email: z.string().trim().pipe(z.string().email()),
  password: z.string().min(1).max(128),
})

// Hash fixo usado quando o e-mail não existe: mantém o tempo de resposta igual
// ao de uma senha errada e evita enumeração de contas por tempo.
const DUMMY_HASH = bcrypt.hashSync('missao-cumprida-dummy-password', 10)

/** Busca por e-mail sem diferenciar maiúsculas (contas antigas podem ter caixa mista). */
export function findUserByEmail(email: string) {
  return prisma.user.findFirst({ where: { email: { equals: email.trim(), mode: 'insensitive' } } })
}

export async function register(req: Request, res: Response) {
  const parsed = registerSchema.safeParse(req.body)
  if (!parsed.success) {
    return R.badRequest(res, 'Dados inválidos', parsed.error.flatten().fieldErrors)
  }

  const { name, email, password, phone, role, referral_code } = parsed.data

  const exists = await findUserByEmail(email)
  if (exists) return R.conflict(res, 'E-mail já cadastrado')

  const hashed = await bcrypt.hash(password, 10)
  const user = await prisma.user.create({
    data: { name, email, password: hashed, phone, role },
    select: { id: true, name: true, email: true, role: true, created_at: true },
  })

  // Gera código de indicação próprio
  await ensureReferralCode(user.id).catch(() => {})

  // Aplica indicação se houver código válido
  let referralBonus: { applied: boolean; reason?: string } | undefined
  if (referral_code) {
    referralBonus = await applyReferralOnRegister(user.id, referral_code, req.ip).catch(() => undefined)
  }

  const accessToken = generateAccessToken({ userId: user.id, role: user.role })
  const refreshToken = generateRefreshToken({ userId: user.id, role: user.role })

  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      user_id: user.id,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  })

  return R.created(res, { user, accessToken, refreshToken, referral_bonus: referralBonus }, 'Cadastro realizado com sucesso')
}

export async function login(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) {
    return R.badRequest(res, 'Dados inválidos')
  }

  const { email, password } = parsed.data

  const user = await findUserByEmail(email)
  const valid = await bcrypt.compare(password, user?.password ?? DUMMY_HASH)
  if (!user || !valid) return R.unauthorized(res, 'E-mail ou senha incorretos')

  if (!user.is_active) {
    return R.forbidden(
      res,
      user.banned_at
        ? 'Conta banida por violação dos Termos de Uso. Entre em contato com o suporte.'
        : 'Conta suspensa. Entre em contato com o suporte.',
    )
  }

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

  if (typeof refreshToken !== 'string') return R.badRequest(res, 'Refresh token inválido')

  const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } })
  if (!stored || stored.expires_at < new Date()) {
    return R.unauthorized(res, 'Refresh token inválido ou expirado')
  }

  try {
    const payload = verifyRefreshToken(refreshToken)

    // Conta suspensa/banida/excluída não renova sessão, e o papel vem do banco
    // (não do token antigo) para refletir mudanças de role.
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, role: true, is_active: true },
    })
    if (!user || !user.is_active || user.id !== stored.user_id) {
      await prisma.refreshToken.deleteMany({ where: { token: refreshToken } })
      return R.unauthorized(res, 'Sessão encerrada')
    }

    // Rotação atômica: só um uso por refresh token (requisições concorrentes
    // com o mesmo token não geram duas sessões).
    const consumed = await prisma.refreshToken.deleteMany({ where: { token: refreshToken } })
    if (consumed.count === 0) return R.unauthorized(res, 'Refresh token já utilizado')

    const newAccessToken = generateAccessToken({ userId: user.id, role: user.role })
    const newRefreshToken = generateRefreshToken({ userId: user.id, role: user.role })

    await prisma.refreshToken.create({
      data: {
        token: newRefreshToken,
        user_id: user.id,
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
  if (typeof refreshToken === 'string' && refreshToken) {
    await prisma.refreshToken.deleteMany({ where: { token: refreshToken } })
  }
  return R.ok(res, null, 'Logout realizado com sucesso')
}
