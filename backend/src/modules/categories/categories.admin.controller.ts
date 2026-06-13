import { Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../../config/database'
import * as R from '../../utils/response'

// Gera um slug único a partir de um texto, verificando colisão na tabela dada.
function slugifyBase(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

async function uniqueSlug(base: string, exists: (slug: string) => Promise<boolean>): Promise<string> {
  const root = slugifyBase(base) || 'item'
  let slug = root
  let i = 2
  while (await exists(slug)) {
    slug = `${root}-${i++}`
  }
  return slug
}

// ===========================================================================
// GRUPOS DE SERVIÇO
// ===========================================================================
export async function adminListGroups(_req: Request, res: Response) {
  const groups = await prisma.serviceGroup.findMany({
    orderBy: { order: 'asc' },
    include: { _count: { select: { categories: true } } },
  })
  return R.ok(res, groups)
}

const groupSchema = z.object({
  name: z.string().min(2),
  icon: z.string().min(1),
  description: z.string().optional().nullable(),
  order: z.number().int().optional(),
  is_active: z.boolean().optional(),
})

export async function adminCreateGroup(req: Request, res: Response) {
  const parsed = groupSchema.safeParse(req.body)
  if (!parsed.success) return R.badRequest(res, 'Dados inválidos', parsed.error.flatten().fieldErrors)
  const slug = await uniqueSlug(parsed.data.name, async (s) => !!(await prisma.serviceGroup.findUnique({ where: { slug: s } })))
  const group = await prisma.serviceGroup.create({ data: { ...parsed.data, slug } })
  return R.created(res, group, 'Grupo criado')
}

export async function adminUpdateGroup(req: Request, res: Response) {
  const parsed = groupSchema.partial().safeParse(req.body)
  if (!parsed.success) return R.badRequest(res, 'Dados inválidos', parsed.error.flatten().fieldErrors)
  const exists = await prisma.serviceGroup.findUnique({ where: { id: req.params.id } })
  if (!exists) return R.notFound(res, 'Grupo não encontrado')
  const group = await prisma.serviceGroup.update({ where: { id: req.params.id }, data: parsed.data })
  return R.ok(res, group, 'Grupo atualizado')
}

export async function adminDeleteGroup(req: Request, res: Response) {
  const count = await prisma.category.count({ where: { group_id: req.params.id } })
  if (count > 0) {
    return R.badRequest(res, `Este grupo tem ${count} categoria(s). Mova ou exclua as categorias antes, ou apenas desative o grupo.`)
  }
  await prisma.serviceGroup.delete({ where: { id: req.params.id } })
  return R.ok(res, null, 'Grupo excluído')
}

// ===========================================================================
// CATEGORIAS / SERVIÇOS
// ===========================================================================
export async function adminListCategories(req: Request, res: Response) {
  const { group_id } = req.query
  const categories = await prisma.category.findMany({
    where: group_id ? { group_id: String(group_id) } : undefined,
    orderBy: [{ group_id: 'asc' }, { order: 'asc' }],
    include: {
      group: { select: { id: true, name: true, slug: true } },
      _count: { select: { questionnaire_fields: true, orders: true } },
    },
  })
  return R.ok(res, categories)
}

const categorySchema = z.object({
  group_id: z.string().min(1),
  name: z.string().min(2),
  icon: z.string().min(1),
  description: z.string().optional().nullable(),
  base_price_min: z.number().optional(),
  base_price_max: z.number().optional(),
  requires_photos: z.boolean().optional(),
  estimated_hours: z.number().optional().nullable(),
  is_active: z.boolean().optional(),
  order: z.number().int().optional(),
  archetype: z.string().optional().nullable(),
  pricing_unit: z.string().optional().nullable(),
})

export async function adminCreateCategory(req: Request, res: Response) {
  const parsed = categorySchema.safeParse(req.body)
  if (!parsed.success) return R.badRequest(res, 'Dados inválidos', parsed.error.flatten().fieldErrors)
  const group = await prisma.serviceGroup.findUnique({ where: { id: parsed.data.group_id } })
  if (!group) return R.badRequest(res, 'Grupo informado não existe')
  const slug = await uniqueSlug(parsed.data.name, async (s) => !!(await prisma.category.findUnique({ where: { slug: s } })))
  const category = await prisma.category.create({ data: { ...parsed.data, slug } })
  return R.created(res, category, 'Categoria criada')
}

export async function adminUpdateCategory(req: Request, res: Response) {
  const parsed = categorySchema.partial().safeParse(req.body)
  if (!parsed.success) return R.badRequest(res, 'Dados inválidos', parsed.error.flatten().fieldErrors)
  const exists = await prisma.category.findUnique({ where: { id: req.params.id } })
  if (!exists) return R.notFound(res, 'Categoria não encontrada')
  const category = await prisma.category.update({ where: { id: req.params.id }, data: parsed.data })
  return R.ok(res, category, 'Categoria atualizada')
}

export async function adminDeleteCategory(req: Request, res: Response) {
  const orders = await prisma.order.count({ where: { category_id: req.params.id } })
  if (orders > 0) {
    return R.badRequest(res, `Esta categoria já tem ${orders} pedido(s) e não pode ser excluída. Desative-a em vez disso.`)
  }
  // Remove perguntas associadas (cascade já cobre, mas explícito p/ clareza) e a categoria
  await prisma.category.delete({ where: { id: req.params.id } })
  return R.ok(res, null, 'Categoria excluída')
}

// ===========================================================================
// PERGUNTAS DO QUESTIONÁRIO
// ===========================================================================
export async function adminListFields(req: Request, res: Response) {
  const fields = await prisma.questionnaireField.findMany({
    where: { category_id: req.params.categoryId },
    orderBy: { order: 'asc' },
  })
  return R.ok(res, fields)
}

const FIELD_TYPES = ['TEXT', 'TEXTAREA', 'SELECT', 'RADIO', 'BOOLEAN', 'PHOTO', 'NUMBER', 'DATE'] as const

const fieldSchema = z.object({
  question: z.string().min(2),
  field_type: z.enum(FIELD_TYPES),
  options: z.array(z.string()).optional().nullable(), // para SELECT/RADIO
  placeholder: z.string().optional().nullable(),
  is_required: z.boolean().optional(),
  order: z.number().int().optional(),
  affects_price: z.boolean().optional(),
  key: z.string().optional().nullable(),
  help_text: z.string().optional().nullable(),
})

export async function adminCreateField(req: Request, res: Response) {
  const parsed = fieldSchema.safeParse(req.body)
  if (!parsed.success) return R.badRequest(res, 'Dados inválidos', parsed.error.flatten().fieldErrors)
  const category = await prisma.category.findUnique({ where: { id: req.params.categoryId } })
  if (!category) return R.notFound(res, 'Categoria não encontrada')

  const { options, ...rest } = parsed.data
  const field = await prisma.questionnaireField.create({
    data: { ...rest, category_id: req.params.categoryId, options: options ?? undefined },
  })
  return R.created(res, field, 'Pergunta adicionada')
}

export async function adminUpdateField(req: Request, res: Response) {
  const parsed = fieldSchema.partial().safeParse(req.body)
  if (!parsed.success) return R.badRequest(res, 'Dados inválidos', parsed.error.flatten().fieldErrors)
  const exists = await prisma.questionnaireField.findUnique({ where: { id: req.params.id } })
  if (!exists) return R.notFound(res, 'Pergunta não encontrada')
  const { options, ...rest } = parsed.data
  const field = await prisma.questionnaireField.update({
    where: { id: req.params.id },
    data: { ...rest, ...(options !== undefined ? { options: options ?? undefined } : {}) },
  })
  return R.ok(res, field, 'Pergunta atualizada')
}

export async function adminDeleteField(req: Request, res: Response) {
  const exists = await prisma.questionnaireField.findUnique({ where: { id: req.params.id } })
  if (!exists) return R.notFound(res, 'Pergunta não encontrada')
  await prisma.questionnaireField.delete({ where: { id: req.params.id } })
  return R.ok(res, null, 'Pergunta removida')
}
