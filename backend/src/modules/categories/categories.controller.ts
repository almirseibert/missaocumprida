import { Request, Response } from 'express'
import { prisma } from '../../config/database'
import * as R from '../../utils/response'

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
      questionnaire_fields: {
        orderBy: { order: 'asc' },
        select: {
          id: true, question: true, field_type: true, options: true,
          is_required: true, order: true, affects_price: true,
          help_text: true, placeholder: true,
        },
      },
    },
  })
  if (!category) return R.notFound(res, 'Categoria não encontrada')

  return R.ok(res, category)
}
