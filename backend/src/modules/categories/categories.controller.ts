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

export async function getCategoryBySlug(req: Request, res: Response) {
  const category = await prisma.category.findUnique({
    where: { slug: req.params.slug },
    include: {
      group: { select: { id: true, name: true, slug: true, icon: true } },
    },
  })
  if (!category) return R.notFound(res, 'Categoria não encontrada')
  return R.ok(res, category)
}

export async function getQuestionnaire(req: Request, res: Response) {
  const category = await prisma.category.findUnique({
    where: { slug: req.params.slug },
    select: {
      id: true, name: true, icon: true, description: true, requires_photos: true,
      base_price_min: true, base_price_max: true, estimated_hours: true,
      archetype: true, pricing_formula: true, pricing_unit: true,
      questionnaire_fields: {
        orderBy: { order: 'asc' },
        select: {
          id: true, question: true, field_type: true, options: true,
          is_required: true, order: true, affects_price: true,
          help_text: true, placeholder: true, key: true, pricing_effect: true,
        },
      },
    },
  })
  if (!category) return R.notFound(res, 'Categoria não encontrada')

  return R.ok(res, category)
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
