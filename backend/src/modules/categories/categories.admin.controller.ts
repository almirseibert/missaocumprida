import { Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../../config/database'
import * as R from '../../utils/response'
import { fieldKey } from '../../utils/fieldKey'
import { audit } from '../audit/audit.service'
import {
  CANONICAL_MERGES,
  SKILL_EXPANSIONS,
  MergeError,
  canonicalMergeStatus,
  expandSkills,
  mergeCategory,
} from './catalogMerge.service'

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
  audit({ type: 'CATALOG_GROUP_CREATED', entityType: 'ServiceGroup', entityId: group.id, after: group })
  return R.created(res, group, 'Grupo criado')
}

export async function adminUpdateGroup(req: Request, res: Response) {
  const parsed = groupSchema.partial().safeParse(req.body)
  if (!parsed.success) return R.badRequest(res, 'Dados inválidos', parsed.error.flatten().fieldErrors)
  const exists = await prisma.serviceGroup.findUnique({ where: { id: req.params.id } })
  if (!exists) return R.notFound(res, 'Grupo não encontrado')
  const group = await prisma.serviceGroup.update({ where: { id: req.params.id }, data: parsed.data })
  audit({ type: 'CATALOG_GROUP_UPDATED', entityType: 'ServiceGroup', entityId: group.id, before: exists, after: parsed.data })
  return R.ok(res, group, 'Grupo atualizado')
}

export async function adminDeleteGroup(req: Request, res: Response) {
  const count = await prisma.category.count({ where: { group_id: req.params.id } })
  if (count > 0) {
    return R.badRequest(res, `Este grupo tem ${count} categoria(s). Mova ou exclua as categorias antes, ou apenas desative o grupo.`)
  }
  await prisma.serviceGroup.delete({ where: { id: req.params.id } })
  audit({ type: 'CATALOG_GROUP_DELETED', entityType: 'ServiceGroup', entityId: req.params.id })
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
      _count: { select: { questionnaire_fields: { where: { is_active: true } }, orders: true } },
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
  description_hint: z.string().max(500).optional().nullable(),
  description_required: z.boolean().optional(),
  photo_hint: z.string().max(300).optional().nullable(),
})

export async function adminCreateCategory(req: Request, res: Response) {
  const parsed = categorySchema.safeParse(req.body)
  if (!parsed.success) return R.badRequest(res, 'Dados inválidos', parsed.error.flatten().fieldErrors)
  const group = await prisma.serviceGroup.findUnique({ where: { id: parsed.data.group_id } })
  if (!group) return R.badRequest(res, 'Grupo informado não existe')
  const slug = await uniqueSlug(parsed.data.name, async (s) => !!(await prisma.category.findUnique({ where: { slug: s } })))
  const category = await prisma.category.create({ data: { ...parsed.data, slug } })
  audit({ type: 'CATEGORY_CREATED', entityType: 'Category', entityId: category.id, after: category })
  return R.created(res, category, 'Categoria criada')
}

export async function adminUpdateCategory(req: Request, res: Response) {
  const parsed = categorySchema.partial().safeParse(req.body)
  if (!parsed.success) return R.badRequest(res, 'Dados inválidos', parsed.error.flatten().fieldErrors)
  const exists = await prisma.category.findUnique({ where: { id: req.params.id } })
  if (!exists) return R.notFound(res, 'Categoria não encontrada')
  const category = await prisma.category.update({ where: { id: req.params.id }, data: parsed.data })
  const before: Record<string, unknown> = {}
  for (const k of Object.keys(parsed.data)) before[k] = (exists as Record<string, unknown>)[k]
  audit({ type: 'CATEGORY_UPDATED', entityType: 'Category', entityId: category.id, before, after: parsed.data, metadata: { slug: category.slug } })
  return R.ok(res, category, 'Categoria atualizada')
}

export async function adminDeleteCategory(req: Request, res: Response) {
  const orders = await prisma.order.count({ where: { category_id: req.params.id } })
  if (orders > 0) {
    return R.badRequest(res, `Esta categoria já tem ${orders} pedido(s) e não pode ser excluída. Desative-a em vez disso.`)
  }
  // Remove perguntas associadas (cascade já cobre, mas explícito p/ clareza) e a categoria
  const removed = await prisma.category.delete({ where: { id: req.params.id } })
  audit({ type: 'CATEGORY_DELETED', entityType: 'Category', entityId: removed.id, before: { name: removed.name, slug: removed.slug } })
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
  is_active: z.boolean().optional(),
})

export async function adminCreateField(req: Request, res: Response) {
  const parsed = fieldSchema.safeParse(req.body)
  if (!parsed.success) return R.badRequest(res, 'Dados inválidos', parsed.error.flatten().fieldErrors)
  const category = await prisma.category.findUnique({ where: { id: req.params.categoryId } })
  if (!category) return R.notFound(res, 'Categoria não encontrada')
  if (parsed.data.field_type === 'PHOTO') {
    return R.badRequest(res, 'Fotos não são pergunta: todo pedido já tem o bloco de fotos (opcional). Use a "dica de fotos" da categoria.')
  }

  const { options, ...rest } = parsed.data
  const key = rest.key || fieldKey(rest.question)
  const clash = await prisma.questionnaireField.findFirst({ where: { category_id: req.params.categoryId, key } })
  if (clash) return R.conflict(res, 'Já existe uma pergunta igual nesta categoria')
  const field = await prisma.questionnaireField.create({
    data: {
      ...rest,
      key,
      // Sim/Não nunca é obrigatório (desmarcado = "Não")
      is_required: rest.field_type === 'BOOLEAN' ? false : rest.is_required,
      category_id: req.params.categoryId,
      options: options ?? undefined,
    },
  })
  audit({ type: 'FIELD_CREATED', entityType: 'QuestionnaireField', entityId: field.id, after: parsed.data, metadata: { category_id: category.id, slug: category.slug } })
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
  audit({
    type: 'FIELD_UPDATED', entityType: 'QuestionnaireField', entityId: field.id,
    before: { question: exists.question, field_type: exists.field_type, is_required: exists.is_required, options: exists.options },
    after: parsed.data, metadata: { category_id: field.category_id },
  })
  return R.ok(res, field, 'Pergunta atualizada')
}

// "Excluir" pergunta = arquivar: pedidos antigos guardam respostas pelo id dela.
export async function adminDeleteField(req: Request, res: Response) {
  const exists = await prisma.questionnaireField.findUnique({ where: { id: req.params.id } })
  if (!exists) return R.notFound(res, 'Pergunta não encontrada')
  await prisma.questionnaireField.update({ where: { id: req.params.id }, data: { is_active: false, is_required: false } })
  audit({ type: 'FIELD_ARCHIVED', entityType: 'QuestionnaireField', entityId: exists.id, before: { question: exists.question }, metadata: { category_id: exists.category_id } })
  return R.ok(res, null, 'Pergunta arquivada (sai do formulário; respostas antigas continuam nos pedidos)')
}

// ===========================================================================
// MESCLA DE CATEGORIAS DUPLICADAS
// ===========================================================================
// GET /api/categories/admin/merges — mesclas propostas + situação de cada uma
export async function adminListMerges(_req: Request, res: Response) {
  return R.ok(res, { merges: await canonicalMergeStatus(), skill_expansions: SKILL_EXPANSIONS })
}

const mergeSchema = z.object({
  from_slug: z.string().min(2),
  into_slug: z.string().min(2),
  dry_run: z.boolean().optional().default(true),
  rename: z.string().min(3).max(120).optional().nullable(),
})

// POST /api/categories/admin/merge { from_slug, into_slug, dry_run, rename? }
// dry_run=true (padrão) só mostra o que seria movido.
export async function adminMergeCategories(req: Request, res: Response) {
  const parsed = mergeSchema.safeParse(req.body)
  if (!parsed.success) return R.badRequest(res, 'Dados inválidos', parsed.error.flatten().fieldErrors)
  const canonical = CANONICAL_MERGES.find((m) => m.from === parsed.data.from_slug && m.into === parsed.data.into_slug)
  try {
    const result = await mergeCategory({
      fromSlug: parsed.data.from_slug,
      intoSlug: parsed.data.into_slug,
      dryRun: parsed.data.dry_run,
      rename: parsed.data.rename ?? canonical?.rename ?? null,
    })
    let expansion = null
    if (result.applied) {
      for (const e of SKILL_EXPANSIONS.filter((x) => x.from === parsed.data.into_slug)) {
        expansion = await expandSkills(e.from, e.also, false)
      }
      audit({
        type: 'CATEGORY_MERGED', entityType: 'Category',
        metadata: { from: parsed.data.from_slug, into: parsed.data.into_slug, result, expansion },
      })
    }
    return R.ok(res, { ...result, expansion }, result.applied ? 'Categorias mescladas' : 'Simulação (nada foi alterado)')
  } catch (err) {
    if (err instanceof MergeError) return R.badRequest(res, err.message)
    throw err
  }
}

// POST /api/categories/admin/expand-skills { from_slug, dry_run }
export async function adminExpandSkills(req: Request, res: Response) {
  const from = String(req.body?.from_slug ?? '')
  const dryRun = req.body?.dry_run !== false
  const exp = SKILL_EXPANSIONS.find((e) => e.from === from)
  if (!exp) return R.badRequest(res, 'Expansão não prevista para esta categoria')
  try {
    const result = await expandSkills(exp.from, exp.also, dryRun)
    if (!dryRun) audit({ type: 'SKILLS_EXPANDED', entityType: 'Category', metadata: { from: exp.from, also: exp.also, result } })
    return R.ok(res, result, dryRun ? 'Simulação' : 'Habilidades adicionadas')
  } catch (err) {
    if (err instanceof MergeError) return R.badRequest(res, err.message)
    throw err
  }
}
