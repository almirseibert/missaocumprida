import { Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../../config/database'
import * as R from '../../utils/response'
import { estimatePriceDynamic } from '../../utils/priceEstimator'

export async function listGroups(_req: Request, res: Response) {
  const groups = await prisma.serviceGroup.findMany({
    where: { is_active: true },
    orderBy: { order: 'asc' },
    include: {
      categories: {
        where: { is_active: true },
        orderBy: { order: 'asc' },
        select: { id: true, name: true, slug: true, icon: true, description: true, base_price_min: true, base_price_max: true },
      },
    },
  })
  return R.ok(res, groups)
}

export async function listCategories(req: Request, res: Response) {
  const { group } = req.query
  const categories = await prisma.category.findMany({
    where: {
      is_active: true,
      ...(group ? { group: { slug: group as string } } : {}),
    },
    orderBy: { order: 'asc' },
    include: {
      group: { select: { id: true, name: true, slug: true, icon: true } },
    },
  })
  return R.ok(res, categories)
}

/** Slug de categoria mesclada redireciona para a categoria mantida. */
async function resolveSlug(slug: string): Promise<string> {
  let current = await prisma.category.findUnique({ where: { slug }, select: { slug: true, merged_into_id: true } })
  for (let i = 0; i < 3 && current?.merged_into_id; i++) {
    current = await prisma.category.findUnique({ where: { id: current.merged_into_id }, select: { slug: true, merged_into_id: true } })
  }
  return current?.slug ?? slug
}

export async function getCategoryBySlug(req: Request, res: Response) {
  const category = await prisma.category.findUnique({
    where: { slug: await resolveSlug(req.params.slug) },
    include: {
      group: { select: { id: true, name: true, slug: true, icon: true, is_active: true } },
    },
  })
  if (!category || !category.is_active || !category.group?.is_active) {
    return R.notFound(res, 'Categoria não encontrada')
  }
  return R.ok(res, category)
}

export async function getQuestionnaire(req: Request, res: Response) {
  const category = await prisma.category.findUnique({
    where: { slug: await resolveSlug(req.params.slug) },
    select: {
      id: true, slug: true, name: true, icon: true, description: true, requires_photos: true,
      base_price_min: true, base_price_max: true, estimated_hours: true,
      archetype: true, pricing_formula: true, pricing_unit: true,
      description_hint: true, description_required: true, photo_hint: true,
      is_active: true,
      group: { select: { is_active: true } },
      questionnaire_fields: {
        // Perguntas arquivadas saem do formulário (respostas antigas continuam no pedido)
        where: { is_active: true },
        orderBy: { order: 'asc' },
        select: {
          id: true, question: true, field_type: true, options: true,
          is_required: true, order: true, affects_price: true,
          help_text: true, placeholder: true, key: true, pricing_effect: true,
        },
      },
    },
  })
  if (!category || !category.is_active || !category.group?.is_active) {
    return R.notFound(res, 'Categoria não encontrada')
  }

  const { group: _group, ...rest } = category
  // Fotos são sempre opcionais e disponíveis em todas as categorias
  return R.ok(res, { ...rest, requires_photos: false })
}

const estimateSchema = z.object({
  answers: z.record(z.any()).default({}),
  state: z.string().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
})

// POST /api/categories/:slug/estimate
// body: { answers: { key|id: valor }, state?: 'SP', latitude?, longitude? }
export async function estimateCategoryPrice(req: Request, res: Response) {
  const parsed = estimateSchema.safeParse(req.body)
  if (!parsed.success) return R.badRequest(res, 'Dados inválidos', parsed.error.flatten().fieldErrors)

  const category = await prisma.category.findUnique({
    where: { slug: req.params.slug },
    select: {
      base_price_min: true, base_price_max: true,
      pricing_formula: true, pricing_unit: true,
      questionnaire_fields: {
        where: { is_active: true },
        select: {
          id: true, field_type: true, affects_price: true,
          price_modifier: true, key: true, pricing_effect: true,
        },
      },
    },
  })
  if (!category) return R.notFound(res, 'Categoria não encontrada')

  const result = estimatePriceDynamic(
    category.pricing_formula,
    category.questionnaire_fields.map((f) => ({
      id: f.id,
      key: f.key,
      field_type: f.field_type,
      affects_price: f.affects_price,
      price_modifier: f.price_modifier,
      pricing_effect: f.pricing_effect,
    })),
    parsed.data.answers,
    category.base_price_min,
    category.base_price_max,
    parsed.data.state,
  )
  if (!result.unit) result.unit = category.pricing_unit ?? undefined
  return R.ok(res, result)
}
