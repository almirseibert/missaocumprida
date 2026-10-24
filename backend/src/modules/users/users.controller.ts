import { Request, Response } from 'express'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '../../config/database'
import * as R from '../../utils/response'
import { persistUpload } from '../files/files.service'
import { banUser } from './moderation.service'
import { anonymizeUser, DELETION_GRACE_DAYS } from './deletion.service'
import { findUserByEmail } from '../auth/auth.controller'
import { invalidateAccountState } from '../../middlewares/auth'
import { isValidCpf, normalizeCpf } from '../../utils/cpf'
import {
  CpfInUseError,
  claimCpf,
  releaseOwnCpf,
  releaseCpfByAdmin,
  lookupCpf,
} from './cpfRegistry.service'

export async function getMe(req: Request, res: Response) {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: {
      id: true, name: true, email: true, phone: true, cpf: true, role: true,
      avatar: true, bio: true, document_verified: true,
      rating_avg: true, rating_count: true, latitude: true, longitude: true,
      is_active: true, created_at: true,
      rg: true, birth_date: true, mother_name: true,
      address_zip: true, address_street: true, address_number: true,
      address_complement: true, address_neighborhood: true,
      address_city: true, address_state: true,
      emergency_contact_name: true, emergency_contact_phone: true,
      pix_key: true, pix_key_type: true, provider_balance: true, hourly_rate: true,
      no_show_count: true, suspended_until: true,
      terms_accepted_at: true, terms_version: true,
      onboarding_state: true, notification_preferences: true,
      document_photo_url: true, selfie_photo_url: true,
      document_submitted_at: true, document_verification_status: true,
      document_rejection_reason: true, document_reviewed_at: true,
      // Selo Pro e saldo de crédito — sem eles o app sempre mostrava "não assinante"
      is_verified_pro: true, verified_pro_since: true, verified_pro_expires: true,
      credit_balance: true,
      provider_skills: {
        include: { category: { select: { id: true, name: true, icon: true } } },
      },
    },
  })
  if (!user) return R.notFound(res, 'Usuário não encontrado')
  return R.ok(res, user)
}

// DELETE /api/users/me — exclusão de conta (LGPD + exigência Google Play).
// Reautentica por senha, bloqueia se houver dinheiro/serviço em andamento e,
// então, anonimiza os dados pessoais + apaga documentos KYC. Preserva os
// registros financeiros/pedidos (anonimizados) por obrigação legal/fiscal.
const deleteMeSchema = z.object({
  password: z.string().min(1, 'Informe sua senha para confirmar a exclusão'),
})

export async function deleteMe(req: Request, res: Response) {
  const parsed = deleteMeSchema.safeParse(req.body)
  if (!parsed.success) return R.badRequest(res, 'Dados inválidos', parsed.error.flatten().fieldErrors)

  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { id: true, password: true, provider_balance: true, is_active: true },
  })
  if (!user) return R.notFound(res, 'Usuário não encontrado')
  if (!user.is_active) return R.badRequest(res, 'Conta já está inativa')

  const valid = await bcrypt.compare(parsed.data.password, user.password)
  if (!valid) return R.unauthorized(res, 'Senha incorreta')

  // Bloqueios: não excluir com dinheiro a receber ou transações/serviços em curso.
  if ((user.provider_balance ?? 0) > 0) {
    return R.conflict(res, 'Você tem saldo a sacar. Faça o saque antes de excluir a conta.')
  }
  const pendingPayments = await prisma.payment.count({
    where: {
      status: { in: ['PAID', 'HELD', 'DISPUTED'] },
      OR: [{ client_id: user.id }, { provider_id: user.id }],
    },
  })
  if (pendingPayments > 0) {
    return R.conflict(res, 'Há pagamentos em andamento (em garantia ou em análise). Conclua-os antes de excluir a conta.')
  }
  const activeSchedules = await prisma.schedule.count({
    where: {
      status: { in: ['CONFIRMED', 'IN_PROGRESS'] },
      OR: [{ client_id: user.id }, { provider_id: user.id }],
    },
  })
  if (activeSchedules > 0) {
    return R.conflict(res, 'Há serviços agendados/em andamento. Conclua ou cancele antes de excluir a conta.')
  }

  await anonymizeUser(user.id)
  invalidateAccountState(user.id)

  return R.ok(res, null, 'Conta excluída. Seus dados pessoais foram anonimizados.')
}

// ---------------------------------------------------------------------------
// Cancelamento de assinatura + exclusão com prazo de arrependimento (público)
// Usado pela página web /cancelar-assinatura: cancela o Selo Pro e agenda a
// exclusão dos dados. O usuário tem DELETION_GRACE_DAYS para desfazer.
// ---------------------------------------------------------------------------
const publicCredentialsSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Informe sua senha'),
})

export async function requestCancellationAndDeletion(req: Request, res: Response) {
  const parsed = publicCredentialsSchema.safeParse(req.body)
  if (!parsed.success) return R.badRequest(res, 'Dados inválidos', parsed.error.flatten().fieldErrors)

  const user = await findUserByEmail(parsed.data.email)
  if (!user || !user.is_active) return R.unauthorized(res, 'E-mail ou senha incorretos')
  const valid = await bcrypt.compare(parsed.data.password, user.password)
  if (!valid) return R.unauthorized(res, 'E-mail ou senha incorretos')

  const deletionDate = new Date(Date.now() + DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000)

  await prisma.$transaction([
    // Cancela o Selo Pro local (o Play Billing deve ser cancelado na Google
    // Play; a RevenueCat sincroniza pelo webhook e não renova mais)
    prisma.verifiedProSubscription.updateMany({
      where: { user_id: user.id, status: 'ACTIVE' },
      data: { status: 'CANCELLED', cancelled_at: new Date() },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { is_verified_pro: false, deletion_requested_at: new Date() },
    }),
  ])

  return R.ok(res, { deletion_scheduled_for: deletionDate.toISOString(), grace_days: DELETION_GRACE_DAYS },
    `Assinatura cancelada e exclusão agendada. Você tem ${DELETION_GRACE_DAYS} dias para se arrepender — basta voltar a esta página e desfazer. Se assinou pelo Google Play, cancele também a renovação na Play Store.`)
}

export async function undoDeletionRequest(req: Request, res: Response) {
  const parsed = publicCredentialsSchema.safeParse(req.body)
  if (!parsed.success) return R.badRequest(res, 'Dados inválidos', parsed.error.flatten().fieldErrors)

  const user = await findUserByEmail(parsed.data.email)
  if (!user || !user.is_active) return R.unauthorized(res, 'E-mail ou senha incorretos')
  const valid = await bcrypt.compare(parsed.data.password, user.password)
  if (!valid) return R.unauthorized(res, 'E-mail ou senha incorretos')

  if (!user.deletion_requested_at) {
    return R.badRequest(res, 'Não há exclusão agendada para esta conta')
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { deletion_requested_at: null },
  })
  return R.ok(res, null, 'Exclusão cancelada — sua conta continua ativa. A assinatura, se desejar, precisa ser reativada no app.')
}

export async function getPublicProfile(req: Request, res: Response) {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id, is_active: true },
    select: {
      id: true, name: true, role: true, avatar: true, bio: true,
      document_verified: true, rating_avg: true, rating_count: true, created_at: true,
      provider_skills: {
        where: { is_active: true },
        include: { category: { select: { id: true, name: true, icon: true, group: { select: { name: true } } } } },
      },
      ratings_received: {
        take: 10,
        orderBy: { created_at: 'desc' },
        select: {
          score: true, comment: true, reviewer_role: true, created_at: true,
          reviewer: { select: { name: true, avatar: true } },
        },
      },
    },
  })
  if (!user) return R.notFound(res, 'Usuário não encontrado')
  return R.ok(res, user)
}

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().optional(),
  cpf: z.string().min(11).max(18).optional(), // validado (dígitos verificadores) em updateMe
  rg: z.string().min(5).max(20).optional(),
  birth_date: z.string().datetime().optional().nullable(),
  mother_name: z.string().min(2).max(120).optional(),
  bio: z.string().max(500).optional(),
  role: z.enum(['CLIENT', 'PROVIDER', 'BOTH']).optional(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  address_zip: z.string().min(8).max(10).optional(),
  address_street: z.string().min(2).max(200).optional(),
  address_number: z.string().max(20).optional(),
  address_complement: z.string().max(120).optional(),
  address_neighborhood: z.string().max(120).optional(),
  address_city: z.string().max(120).optional(),
  address_state: z.string().min(2).max(2).optional(),
  emergency_contact_name: z.string().min(2).max(120).optional(),
  emergency_contact_phone: z.string().min(8).max(20).optional(),
})

export async function updateMe(req: Request, res: Response) {
  const parsed = updateSchema.safeParse(req.body)
  if (!parsed.success) return R.badRequest(res, 'Dados inválidos', parsed.error.flatten().fieldErrors)

  // CPF: só dígitos, dígitos verificadores válidos (CNPJ não identifica a pessoa)
  if (parsed.data.cpf !== undefined) {
    if (!isValidCpf(parsed.data.cpf)) return R.badRequest(res, 'CPF inválido. Confira os números digitados.')
    parsed.data.cpf = normalizeCpf(parsed.data.cpf)
  }

  const current = await prisma.user.findUnique({
    where: { id: req.userId },
    select: {
      document_verification_status: true, cpf: true, rg: true, birth_date: true, mother_name: true,
      latitude: true, longitude: true,
    },
  })
  if (!current) return R.notFound(res, 'Usuário não encontrado')

  // Depois que os documentos foram aprovados, os dados de identidade não
  // podem mudar pelo app (senão uma conta verificada assumiria outro CPF).
  // Campo vazio (ou CPF inválido gravado antes da validação) pode ser preenchido.
  const IDENTITY_FIELDS = ['cpf', 'rg', 'birth_date', 'mother_name'] as const
  if (current.document_verification_status === 'APPROVED' || current.document_verification_status === 'PENDING') {
    const changed = IDENTITY_FIELDS.some((f) => {
      const next = parsed.data[f]
      if (next === undefined) return false
      const prev = current[f]
      if (prev === null || prev === undefined || prev === '') return false
      if (f === 'cpf' && !isValidCpf(prev)) return false
      if (f === 'birth_date') return (prev as Date).toISOString().slice(0, 10) !== (next ? String(next).slice(0, 10) : null)
      if (f === 'cpf') return normalizeCpf(prev) !== next
      return prev !== next
    })
    if (changed) {
      return R.badRequest(res, 'Seus documentos já foram enviados/aprovados. Para alterar CPF, RG, nascimento ou nome da mãe, fale com o suporte.')
    }
  }

  const data: Record<string, unknown> = { ...parsed.data }
  if (parsed.data.birth_date) data.birth_date = new Date(parsed.data.birth_date)
  if (
    (parsed.data.latitude !== undefined && parsed.data.latitude !== current.latitude) ||
    (parsed.data.longitude !== undefined && parsed.data.longitude !== current.longitude)
  ) {
    data.location_updated_at = new Date()
  }

  const cpfChanged = parsed.data.cpf !== undefined && parsed.data.cpf !== normalizeCpf(current.cpf)
  let user
  try {
    user = await prisma.$transaction(async (tx) => {
      if (cpfChanged) {
        // 1 conta por CPF: falha se o CPF é (ou foi) de outra conta, mesmo excluída/banida
        await claimCpf(tx, req.userId, parsed.data.cpf!)
        if (current.cpf && isValidCpf(current.cpf)) await releaseOwnCpf(tx, req.userId, current.cpf)
      }
      return tx.user.update({
        where: { id: req.userId },
        data,
        select: {
          id: true, name: true, email: true, phone: true, cpf: true, rg: true,
          birth_date: true, mother_name: true, role: true, avatar: true, bio: true,
          latitude: true, longitude: true,
          address_zip: true, address_street: true, address_number: true,
          address_complement: true, address_neighborhood: true,
          address_city: true, address_state: true,
          emergency_contact_name: true, emergency_contact_phone: true,
        },
      })
    })
  } catch (err) {
    if (err instanceof CpfInUseError) return R.conflict(res, err.message)
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return R.conflict(res, new CpfInUseError().message)
    }
    throw err
  }
  if (parsed.data.role) invalidateAccountState(req.userId)
  return R.ok(res, user, 'Perfil atualizado com sucesso')
}

export async function uploadAvatar(req: Request, res: Response) {
  if (!req.file) return R.badRequest(res, 'Nenhuma imagem enviada')
  const url = await persistUpload(req, req.file)
  await prisma.user.update({ where: { id: req.userId }, data: { avatar: url } })
  return R.ok(res, { avatar: url }, 'Foto de perfil atualizada')
}

// ---- Verificação de identidade (documento + selfie) ----

// Campos obrigatórios para considerar o cadastro "completo" e habilitar verificação
const REQUIRED_PROFILE_FIELDS = [
  'cpf', 'rg', 'birth_date', 'mother_name',
  'address_zip', 'address_street', 'address_number',
  'address_neighborhood', 'address_city', 'address_state',
  'emergency_contact_name', 'emergency_contact_phone',
] as const

type RequiredField = typeof REQUIRED_PROFILE_FIELDS[number]

const FIELD_LABELS: Record<RequiredField, string> = {
  cpf: 'CPF',
  rg: 'RG',
  birth_date: 'Data de nascimento',
  mother_name: 'Nome da mãe',
  address_zip: 'CEP',
  address_street: 'Logradouro',
  address_number: 'Número',
  address_neighborhood: 'Bairro',
  address_city: 'Cidade',
  address_state: 'UF',
  emergency_contact_name: 'Nome do contato de emergência',
  emergency_contact_phone: 'Telefone do contato de emergência',
}

function missingProfileFields(user: Record<string, unknown>): RequiredField[] {
  return REQUIRED_PROFILE_FIELDS.filter((f) => {
    const v = user[f]
    if (v === null || v === undefined) return true
    if (typeof v === 'string' && v.trim() === '') return true
    return false
  })
}

// POST /api/users/me/verification — envia documento e selfie em uma chamada
export async function submitVerification(req: Request, res: Response) {
  const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined
  const docFile = files?.document?.[0]
  const selfieFile = files?.selfie?.[0]

  if (!docFile || !selfieFile) {
    return R.badRequest(res, 'Envie a foto do documento E a selfie para análise.')
  }

  // Exige cadastro completo antes de aceitar documentos para análise
  const current = await prisma.user.findUnique({
    where: { id: req.userId },
    select: {
      cpf: true, rg: true, birth_date: true, mother_name: true,
      address_zip: true, address_street: true, address_number: true,
      address_neighborhood: true, address_city: true, address_state: true,
      emergency_contact_name: true, emergency_contact_phone: true,
    },
  })
  if (!current) return R.notFound(res, 'Usuário não encontrado')

  const missing = missingProfileFields(current as Record<string, unknown>)
  if (missing.length > 0) {
    return R.badRequest(
      res,
      `Complete seu cadastro antes de enviar documentos. Campos faltando: ${missing.map((f) => FIELD_LABELS[f]).join(', ')}.`,
      { missing_fields: missing },
    )
  }
  // 1 conta por CPF: a verificação só segue com CPF válido e exclusivo desta conta
  if (!isValidCpf(current.cpf)) {
    return R.badRequest(res, 'CPF inválido. Corrija o CPF no seu cadastro antes de enviar os documentos.', { missing_fields: ['cpf'] })
  }
  try {
    await claimCpf(prisma, req.userId, current.cpf!)
  } catch (err) {
    if (err instanceof CpfInUseError) return R.conflict(res, err.message)
    throw err
  }

  const data: Record<string, unknown> = {
    document_submitted_at: new Date(),
    document_verification_status: 'PENDING',
    document_rejection_reason: null,
  }
  data.document_photo_url = await persistUpload(req, docFile, { sensitive: true, ownerId: req.userId })
  data.selfie_photo_url = await persistUpload(req, selfieFile, { sensitive: true, ownerId: req.userId })

  const user = await prisma.user.update({
    where: { id: req.userId },
    data,
    select: {
      document_photo_url: true,
      selfie_photo_url: true,
      document_submitted_at: true,
      document_verification_status: true,
      document_rejection_reason: true,
    },
  })

  return R.ok(res, user, 'Documentos enviados para análise. Você será notificado em até 48h.')
}

// GET /api/users/me/verification — status atual + estado do cadastro
export async function getVerificationStatus(req: Request, res: Response) {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: {
      document_photo_url: true,
      selfie_photo_url: true,
      document_submitted_at: true,
      document_verification_status: true,
      document_rejection_reason: true,
      document_reviewed_at: true,
      document_verified: true,
      cpf: true, rg: true, birth_date: true, mother_name: true,
      address_zip: true, address_street: true, address_number: true,
      address_neighborhood: true, address_city: true, address_state: true,
      emergency_contact_name: true, emergency_contact_phone: true,
    },
  })
  if (!user) return R.notFound(res, 'Usuário não encontrado')

  const missing = missingProfileFields(user as Record<string, unknown>)
  return R.ok(res, {
    document_photo_url: user.document_photo_url,
    selfie_photo_url: user.selfie_photo_url,
    document_submitted_at: user.document_submitted_at,
    document_verification_status: user.document_verification_status,
    document_rejection_reason: user.document_rejection_reason,
    document_reviewed_at: user.document_reviewed_at,
    document_verified: user.document_verified,
    profile_complete: missing.length === 0,
    missing_fields: missing,
    missing_labels: missing.map((f) => FIELD_LABELS[f]),
  })
}

// ---- Admin: revisar verificação de outro usuário ----

const reviewSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  reason: z.string().optional(),
})

// GET /api/admin/verifications — lista usuários por status de verificação (admin)
export async function adminListVerifications(req: Request, res: Response) {
  const status = (req.query.status as string) ?? 'PENDING'
  const allowedStatuses = ['NONE', 'PENDING', 'APPROVED', 'REJECTED']
  if (!allowedStatuses.includes(status)) {
    return R.badRequest(res, 'Status inválido')
  }
  const q = (req.query.q as string)?.trim()
  const limit = Math.min(Number(req.query.limit ?? 30), 100)
  const page = Math.max(Number(req.query.page ?? 1), 1)

  const where = {
    document_verification_status: status as 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED',
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' as const } },
            { email: { contains: q, mode: 'insensitive' as const } },
            ...(q.replace(/\D/g, '').length >= 3 ? [{ cpf: { contains: q.replace(/\D/g, '') } }] : []),
          ],
        }
      : {}),
  }

  const [users, total, counts] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true, name: true, email: true, phone: true, cpf: true, rg: true,
        birth_date: true, mother_name: true, role: true, avatar: true,
        address_zip: true, address_street: true, address_number: true,
        address_complement: true, address_neighborhood: true,
        address_city: true, address_state: true,
        emergency_contact_name: true, emergency_contact_phone: true,
        document_photo_url: true, selfie_photo_url: true,
        document_submitted_at: true, document_verification_status: true,
        document_rejection_reason: true, document_reviewed_at: true,
        document_verified: true,
        created_at: true,
      },
      orderBy: { document_submitted_at: status === 'PENDING' ? 'asc' : 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
    prisma.user.groupBy({
      by: ['document_verification_status'],
      _count: { document_verification_status: true },
    }),
  ])

  const summary: Record<string, number> = { NONE: 0, PENDING: 0, APPROVED: 0, REJECTED: 0 }
  for (const c of counts) summary[c.document_verification_status] = c._count.document_verification_status

  return R.ok(res, { users, total, page, limit, summary })
}

// PUT /api/users/:id/verification/review — admin aprova/rejeita
export async function reviewVerification(req: Request, res: Response) {
  const parsed = reviewSchema.safeParse(req.body)
  if (!parsed.success) return R.badRequest(res, 'Dados inválidos', parsed.error.flatten().fieldErrors)

  const target = await prisma.user.findUnique({ where: { id: req.params.id } })
  if (!target) return R.notFound(res, 'Usuário não encontrado')

  const updated = await prisma.user.update({
    where: { id: req.params.id },
    data: {
      document_verification_status: parsed.data.status,
      document_rejection_reason: parsed.data.status === 'REJECTED' ? (parsed.data.reason || 'Documento não pôde ser verificado.') : null,
      document_reviewed_at: new Date(),
      document_verified: parsed.data.status === 'APPROVED',
    },
    select: {
      id: true,
      document_verification_status: true,
      document_rejection_reason: true,
      document_reviewed_at: true,
      document_verified: true,
    },
  })
  return R.ok(res, updated, parsed.data.status === 'APPROVED' ? 'Conta verificada' : 'Verificação recusada')
}

export async function changePassword(req: Request, res: Response) {
  const { currentPassword, newPassword, refreshToken } = req.body ?? {}
  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
    return R.badRequest(res, 'Senhas não informadas')
  }
  if (newPassword.length < 8 || newPassword.length > 128) {
    return R.badRequest(res, 'Nova senha deve ter ao menos 8 caracteres')
  }

  const user = await prisma.user.findUnique({ where: { id: req.userId } })
  if (!user) return R.notFound(res)

  const valid = await bcrypt.compare(currentPassword, user.password)
  if (!valid) return R.badRequest(res, 'Senha atual incorreta')

  const hashed = await bcrypt.hash(newPassword, 10)
  // Encerra as outras sessões (ex.: aparelho perdido/senha vazada); mantém só
  // a sessão atual quando o app informa o próprio refresh token.
  await prisma.$transaction([
    prisma.user.update({ where: { id: req.userId }, data: { password: hashed } }),
    prisma.refreshToken.deleteMany({
      where: {
        user_id: req.userId,
        ...(typeof refreshToken === 'string' && refreshToken ? { token: { not: refreshToken } } : {}),
      },
    }),
  ])
  return R.ok(res, null, 'Senha alterada com sucesso')
}

// ---- Habilidades do Prestador ----

const skillSchema = z.object({
  category_id: z.string().uuid(),
  years_experience: z.number().int().min(0).max(50).default(0),
  certification: z.string().optional(),
  service_radius_km: z.number().int().min(1).max(200).default(20),
  hourly_rate: z.number().positive().optional(),
})

export async function addSkill(req: Request, res: Response) {
  const parsed = skillSchema.safeParse(req.body)
  if (!parsed.success) return R.badRequest(res, 'Dados inválidos', parsed.error.flatten().fieldErrors)

  const category = await prisma.category.findUnique({ where: { id: parsed.data.category_id } })
  if (!category) return R.notFound(res, 'Categoria não encontrada')

  const skill = await prisma.providerSkill.upsert({
    where: { provider_id_category_id: { provider_id: req.userId, category_id: parsed.data.category_id } },
    update: parsed.data,
    create: { provider_id: req.userId, ...parsed.data },
    include: { category: { select: { id: true, name: true, icon: true } } },
  })
  return R.created(res, skill, 'Habilidade adicionada')
}

export async function listSkills(req: Request, res: Response) {
  const skills = await prisma.providerSkill.findMany({
    where: { provider_id: req.userId },
    include: { category: { select: { id: true, name: true, icon: true, group: { select: { name: true } } } } },
  })
  return R.ok(res, skills)
}

export async function removeSkill(req: Request, res: Response) {
  const skill = await prisma.providerSkill.findUnique({
    where: { id: req.params.id },
  })
  if (!skill || skill.provider_id !== req.userId) return R.notFound(res, 'Habilidade não encontrada')

  await prisma.providerSkill.delete({ where: { id: req.params.id } })
  return R.noContent(res)
}

// ============================================================
// ONBOARDING
// ============================================================

const onboardingSchema = z.object({
  flow: z.enum(['provider', 'client']),
  step: z.number().int().min(0).max(20).optional(),
  completed: z.boolean().optional(),
  data: z.record(z.any()).optional(),
})

export async function updateOnboarding(req: Request, res: Response) {
  const parsed = onboardingSchema.safeParse(req.body)
  if (!parsed.success) return R.badRequest(res, 'Dados inválidos', parsed.error.flatten().fieldErrors)

  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { onboarding_state: true },
  })
  if (!user) return R.notFound(res, 'Usuário não encontrado')

  const currentState = (user.onboarding_state as Record<string, any>) || {}
  const { flow, step, completed, data } = parsed.data
  const flowState = currentState[flow] || {}

  const newFlowState: Record<string, any> = { ...flowState }
  if (step !== undefined) newFlowState.step = step
  if (completed !== undefined) newFlowState.completed = completed
  if (data) newFlowState.data = { ...(flowState.data || {}), ...data }
  if (completed) newFlowState.completed_at = new Date().toISOString()

  const updated = await prisma.user.update({
    where: { id: req.userId },
    data: { onboarding_state: { ...currentState, [flow]: newFlowState } },
    select: { onboarding_state: true },
  })
  return R.ok(res, updated)
}

// ============================================================
// ADMIN — gestão de usuários
// ============================================================

// GET /api/users/admin/list?search=&role=&status=active|suspended
export async function adminListUsers(req: Request, res: Response) {
  const search = req.query.search ? String(req.query.search).trim() : ''
  const role = req.query.role ? String(req.query.role).toUpperCase() : ''
  const status = req.query.status ? String(req.query.status) : ''

  const where: Record<string, unknown> = {}
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      ...(String(search).replace(/\D/g, '').length >= 3 ? [{ cpf: { contains: String(search).replace(/\D/g, '') } }] : []),
    ]
  }
  if (['CLIENT', 'PROVIDER', 'BOTH', 'ADMIN'].includes(role)) where.role = role
  if (status === 'suspended') where.is_active = false
  if (status === 'active') where.is_active = true

  const users = await prisma.user.findMany({
    where,
    orderBy: { created_at: 'desc' },
    take: 100,
    select: {
      id: true, name: true, email: true, phone: true, role: true, avatar: true,
      is_active: true, suspended_until: true, no_show_count: true,
      document_verification_status: true, document_verified: true, is_verified_pro: true,
      provider_balance: true, rating_avg: true, rating_count: true,
      address_city: true, address_state: true, created_at: true,
    },
  })
  return R.ok(res, users)
}

// GET /api/users/admin/users/:id — detalhe + contadores
export async function adminGetUser(req: Request, res: Response) {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: {
      id: true, name: true, email: true, phone: true, role: true, avatar: true, bio: true,
      cpf: true, is_active: true, suspended_until: true, no_show_count: true,
      banned_at: true, ban_reason: true, verified_pro_expires: true,
      document_verification_status: true, document_verified: true, document_rejection_reason: true,
      is_verified_pro: true, provider_balance: true, credit_balance: true,
      rating_avg: true, rating_count: true,
      address_city: true, address_state: true, address_neighborhood: true,
      created_at: true,
      _count: {
        select: {
          orders_as_client: true, proposals: true,
          schedules_provider: true, schedules_client: true,
          payments_provider: true, withdrawals: true,
        },
      },
    },
  })
  if (!user) return R.notFound(res, 'Usuário não encontrado')
  return R.ok(res, user)
}

// PATCH /api/users/admin/users/:id/suspend  body: { until?, reason? }
export async function adminSuspendUser(req: Request, res: Response) {
  if (req.params.id === req.userId) return R.badRequest(res, 'Você não pode suspender a própria conta.')
  const target = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true, role: true } })
  if (!target) return R.notFound(res, 'Usuário não encontrado')
  if (target.role === 'ADMIN') return R.badRequest(res, 'Não é possível suspender outro administrador.')

  const until = req.body?.until ? new Date(req.body.until) : null
  if (until && isNaN(until.getTime())) return R.badRequest(res, 'Data inválida')
  const [user] = await prisma.$transaction([
    prisma.user.update({
      where: { id: req.params.id },
      data: { is_active: false, suspended_until: until },
      select: { id: true, is_active: true, suspended_until: true },
    }),
    prisma.refreshToken.deleteMany({ where: { user_id: req.params.id } }),
  ])
  invalidateAccountState(req.params.id)
  return R.ok(res, user, 'Usuário suspenso')
}

// PATCH /api/users/admin/users/:id/reactivate — reverte suspensão OU banimento
export async function adminReactivateUser(req: Request, res: Response) {
  const target = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true } })
  if (!target) return R.notFound(res, 'Usuário não encontrado')
  const [user] = await prisma.$transaction([
    prisma.user.update({
      where: { id: req.params.id },
      data: { is_active: true, suspended_until: null, banned_at: null, ban_reason: null },
      select: { id: true, is_active: true, suspended_until: true },
    }),
    // banimento revertido: o CPF volta a ser desta conta (ativa)
    prisma.cpfRegistry.updateMany({ where: { user_id: req.params.id, status: 'BANNED' }, data: { status: 'ACTIVE' } }),
  ])
  invalidateAccountState(req.params.id)
  return R.ok(res, user, 'Usuário reativado')
}

// GET /api/users/admin/cpf?cpf= — situação de um CPF (sem expor o número)
export async function adminLookupCpf(req: Request, res: Response) {
  const cpf = normalizeCpf(req.query.cpf)
  if (!isValidCpf(cpf)) return R.badRequest(res, 'CPF inválido')
  const [registry, active, conflicts] = await Promise.all([
    lookupCpf(cpf),
    prisma.user.findMany({
      where: { cpf },
      select: { id: true, name: true, email: true, is_active: true, banned_at: true, created_at: true },
    }),
    prisma.cpfConflict.findMany({ where: { resolved_at: null }, orderBy: { created_at: 'desc' }, take: 50 }),
  ])
  const ids = new Set(registry.map((r) => r.user_id))
  const owners = await prisma.user.findMany({
    where: { id: { in: Array.from(ids) } },
    select: { id: true, name: true, email: true, is_active: true, banned_at: true, created_at: true },
  })
  return R.ok(res, {
    registry: registry.map((r) => ({ ...r, user: owners.find((o) => o.id === r.user_id) ?? null })),
    accounts: active,
    pending_conflicts: conflicts.filter((c) => ids.has(c.kept_user_id) || ids.has(c.user_id)),
  })
}

// POST /api/users/admin/cpf/release { cpf, reason } — libera um CPF bloqueado
// (ex.: alguém usou o CPF de outra pessoa). O motivo fica registrado.
const releaseSchema = z.object({ cpf: z.string().min(11).max(18), reason: z.string().min(5).max(500) })
export async function adminReleaseCpf(req: Request, res: Response) {
  const parsed = releaseSchema.safeParse(req.body)
  if (!parsed.success) return R.badRequest(res, 'Informe o CPF e o motivo (mín. 5 caracteres)')
  if (!isValidCpf(parsed.data.cpf)) return R.badRequest(res, 'CPF inválido')
  const cpf = normalizeCpf(parsed.data.cpf)
  const holder = await prisma.user.findFirst({ where: { cpf, is_active: true }, select: { id: true } })
  if (holder) {
    return R.conflict(res, 'Este CPF está em uma conta ativa. Remova o CPF dessa conta (ou suspenda-a) antes de liberá-lo.')
  }
  const count = await releaseCpfByAdmin(cpf, req.userId, parsed.data.reason)
  if (count === 0) return R.notFound(res, 'CPF não está bloqueado')
  // contas inativas que ainda guardam o número deixam de bloqueá-lo
  await prisma.user.updateMany({ where: { cpf, is_active: false }, data: { cpf: null } })
  return R.ok(res, { released: count }, 'CPF liberado para um novo cadastro')
}

// POST /api/users/admin/users/:id/ban  body: { reason } — banimento definitivo
// (má-fé, no-show confirmado, cancelamento pós-liberação — Termos de Uso)
export async function adminBanUser(req: Request, res: Response) {
  if (req.params.id === req.userId) return R.badRequest(res, 'Você não pode banir a própria conta.')
  const target = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true, role: true } })
  if (!target) return R.notFound(res, 'Usuário não encontrado')
  if (target.role === 'ADMIN') return R.badRequest(res, 'Não é possível banir outro administrador.')

  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : ''
  if (!reason) return R.badRequest(res, 'Informe o motivo do banimento')

  await banUser(req.params.id, reason)
  return R.ok(res, { id: req.params.id, banned: true }, 'Usuário banido')
}
