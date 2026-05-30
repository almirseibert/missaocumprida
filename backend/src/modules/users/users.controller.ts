import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../../config/database'
import { env } from '../../config/env'
import * as R from '../../utils/response'

export async function getMe(req: Request, res: Response) {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: {
      id: true, name: true, email: true, phone: true, role: true,
      avatar: true, bio: true, document_verified: true,
      rating_avg: true, rating_count: true, latitude: true, longitude: true,
      is_active: true, created_at: true,
      provider_skills: {
        include: { category: { select: { id: true, name: true, icon: true } } },
      },
    },
  })
  if (!user) return R.notFound(res, 'Usuário não encontrado')
  return R.ok(res, user)
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
  bio: z.string().max(500).optional(),
  role: z.enum(['CLIENT', 'PROVIDER', 'BOTH']).optional(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
})

export async function updateMe(req: Request, res: Response) {
  const parsed = updateSchema.safeParse(req.body)
  if (!parsed.success) return R.badRequest(res, 'Dados inválidos', parsed.error.flatten().fieldErrors)

  const user = await prisma.user.update({
    where: { id: req.userId },
    data: parsed.data,
    select: { id: true, name: true, email: true, phone: true, role: true, avatar: true, bio: true, latitude: true, longitude: true },
  })
  return R.ok(res, user, 'Perfil atualizado com sucesso')
}

export async function uploadAvatar(req: Request, res: Response) {
  if (!req.file) return R.badRequest(res, 'Nenhuma imagem enviada')
  const url = `${env.API_URL}/uploads/${req.file.filename}`
  await prisma.user.update({ where: { id: req.userId }, data: { avatar: url } })
  return R.ok(res, { avatar: url }, 'Foto de perfil atualizada')
}

export async function changePassword(req: Request, res: Response) {
  const { currentPassword, newPassword } = req.body
  if (!currentPassword || !newPassword) return R.badRequest(res, 'Senhas não informadas')
  if (newPassword.length < 6) return R.badRequest(res, 'Nova senha deve ter ao menos 6 caracteres')

  const user = await prisma.user.findUnique({ where: { id: req.userId } })
  if (!user) return R.notFound(res)

  const valid = await bcrypt.compare(currentPassword, user.password)
  if (!valid) return R.badRequest(res, 'Senha atual incorreta')

  const hashed = await bcrypt.hash(newPassword, 10)
  await prisma.user.update({ where: { id: req.userId }, data: { password: hashed } })
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
