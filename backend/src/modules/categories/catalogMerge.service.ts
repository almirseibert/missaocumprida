// ============================================================
// Mescla de categorias duplicadas (mesmo serviço com nomes diferentes).
// A categoria "de" fica INATIVA (nunca é apagada) e aponta para a mantida
// (merged_into_id); o slug antigo redireciona. Pedidos, habilidades dos
// prestadores, pacotes, agenda e afinidades passam para a categoria mantida.
// As respostas dos pedidos antigos continuam legíveis (answers_snapshot).
// ============================================================
import { Prisma } from '@prisma/client'
import { prisma } from '../../config/database'
import { buildAnswersSnapshot } from '../orders/orders.service'

export type MergeCounts = {
  orders: number
  provider_skills: number
  service_packages: number
  availability_rules: number
  subscriptions: number
}

/** Mesclas propostas na revisão do catálogo (de → para, com o nome final). */
export const CANONICAL_MERGES: Array<{ from: string; into: string; rename?: string; note: string }> = [
  { from: 'frete-transporte', into: 'carreto', rename: 'Carreto / Frete Pequeno', note: 'Frete e carreto são o mesmo serviço; mudança completa continua separada.' },
  { from: 'diarista', into: 'limpeza-residencial', rename: 'Diarista / Limpeza Residencial', note: 'Diarista e limpeza residencial são o mesmo serviço.' },
  { from: 'limpeza-tapetes-cortinas', into: 'limpeza-sofas', rename: 'Higienização de Estofados, Tapetes e Cortinas', note: 'Higienização de sofá, tapete e cortina é feita pelo mesmo profissional.' },
  { from: 'treino-funcional', into: 'personal-trainer', note: 'Treino funcional é uma modalidade de personal trainer.' },
  { from: 'regar-plantas', into: 'house-sitting', rename: 'Cuidar da Casa na Ausência', note: 'Regar plantas já é uma opção de cuidar da casa.' },
  { from: 'tecnologia-idosos', into: 'aulas-informatica', note: 'Tecnologia para idosos é aula de informática para esse público.' },
]

/**
 * Prestadores de "Outros eletrodomésticos" também atendem os consertos
 * específicos (geladeira, máquina de lavar, fogão, micro-ondas, portáteis):
 * ganham essas habilidades para não perderem pedidos.
 */
export const SKILL_EXPANSIONS: Array<{ from: string; also: string[] }> = [
  {
    from: 'conserto-eletrodomesticos',
    also: ['conserto-geladeira', 'conserto-maquina-lavar', 'conserto-fogao', 'conserto-microondas', 'conserto-eletroportateis'],
  },
]

async function countUsage(tx: Prisma.TransactionClient | typeof prisma, categoryId: string): Promise<MergeCounts> {
  const [orders, provider_skills, service_packages, availability_rules, subscriptions] = await Promise.all([
    tx.order.count({ where: { category_id: categoryId } }),
    tx.providerSkill.count({ where: { category_id: categoryId } }),
    tx.servicePackage.count({ where: { category_id: categoryId } }),
    tx.availabilityRule.count({ where: { category_id: categoryId } }),
    tx.subscription.count({ where: { category_id: categoryId } }),
  ])
  return { orders, provider_skills, service_packages, availability_rules, subscriptions }
}

export class MergeError extends Error {
  status = 400
}

export async function mergeCategory(opts: {
  fromSlug: string
  intoSlug: string
  dryRun: boolean
  rename?: string | null
}): Promise<{ from: string; into: string; counts: MergeCounts; applied: boolean }> {
  const [from, into] = await Promise.all([
    prisma.category.findUnique({ where: { slug: opts.fromSlug }, include: { questionnaire_fields: true } }),
    prisma.category.findUnique({ where: { slug: opts.intoSlug } }),
  ])
  if (!from) throw new MergeError(`Categoria "${opts.fromSlug}" não encontrada`)
  if (!into) throw new MergeError(`Categoria "${opts.intoSlug}" não encontrada`)
  if (from.id === into.id) throw new MergeError('Escolha duas categorias diferentes')
  if (into.merged_into_id) throw new MergeError(`"${into.name}" já foi mesclada em outra categoria`)
  if (from.merged_into_id) {
    return { from: from.slug, into: into.slug, counts: await countUsage(prisma, from.id), applied: false }
  }

  const counts = await countUsage(prisma, from.id)
  if (opts.dryRun) return { from: from.slug, into: into.slug, counts, applied: false }

  // Pedidos antigos sem foto das respostas: grava antes de mudar a categoria
  const withoutSnapshot = await prisma.order.findMany({
    where: { category_id: from.id, answers_snapshot: { equals: Prisma.DbNull } },
    select: { id: true, answers: true },
  })
  for (const o of withoutSnapshot) {
    const answers = (o.answers ?? {}) as Record<string, string>
    await prisma.order.update({
      where: { id: o.id },
      data: { answers_snapshot: buildAnswersSnapshot(from.questionnaire_fields, answers) as never },
    })
  }

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE "orders" SET "original_category_id" = COALESCE("original_category_id", "category_id"), "category_id" = ${into.id}
      WHERE "category_id" = ${from.id}`

    // Habilidades: quem atendia a duplicada passa a atender a mantida
    const skills = await tx.providerSkill.findMany({ where: { category_id: from.id } })
    for (const s of skills) {
      const existing = await tx.providerSkill.findUnique({
        where: { provider_id_category_id: { provider_id: s.provider_id, category_id: into.id } },
      })
      if (existing) {
        await tx.providerSkill.update({
          where: { id: existing.id },
          data: {
            is_active: existing.is_active || s.is_active,
            years_experience: Math.max(existing.years_experience, s.years_experience),
            service_radius_km: Math.max(existing.service_radius_km, s.service_radius_km),
            hourly_rate: existing.hourly_rate ?? s.hourly_rate,
            certification: existing.certification ?? s.certification,
          },
        })
        await tx.providerSkill.delete({ where: { id: s.id } })
      } else {
        await tx.providerSkill.update({ where: { id: s.id }, data: { category_id: into.id } })
      }
    }

    await tx.servicePackage.updateMany({ where: { category_id: from.id }, data: { category_id: into.id } })
    await tx.availabilityRule.updateMany({ where: { category_id: from.id }, data: { category_id: into.id } })
    await tx.subscription.updateMany({ where: { category_id: from.id }, data: { category_id: into.id } })

    // Afinidades (cross-sell) usam slug
    await tx.categoryAffinity.deleteMany({
      where: { OR: [{ source_category: from.slug, target_category: into.slug }, { source_category: into.slug, target_category: from.slug }] },
    })
    const affs = await tx.categoryAffinity.findMany({ where: { OR: [{ source_category: from.slug }, { target_category: from.slug }] } })
    for (const a of affs) {
      const source = a.source_category === from.slug ? into.slug : a.source_category
      const target = a.target_category === from.slug ? into.slug : a.target_category
      const clash = await tx.categoryAffinity.findUnique({ where: { source_category_target_category: { source_category: source, target_category: target } } })
      if (clash) await tx.categoryAffinity.delete({ where: { id: a.id } })
      else await tx.categoryAffinity.update({ where: { id: a.id }, data: { source_category: source, target_category: target } })
    }

    await tx.category.update({
      where: { id: from.id },
      data: { is_active: false, merged_into_id: into.id, order: 999 },
    })
    if (opts.rename) await tx.category.update({ where: { id: into.id }, data: { name: opts.rename } })
  })

  return { from: from.slug, into: into.slug, counts, applied: true }
}

/** Dá aos prestadores de uma categoria as habilidades das categorias relacionadas. */
export async function expandSkills(fromSlug: string, alsoSlugs: string[], dryRun: boolean): Promise<{ providers: number; created: number }> {
  const from = await prisma.category.findUnique({ where: { slug: fromSlug } })
  if (!from) throw new MergeError(`Categoria "${fromSlug}" não encontrada`)
  const targets = await prisma.category.findMany({ where: { slug: { in: alsoSlugs }, is_active: true } })
  const skills = await prisma.providerSkill.findMany({ where: { category_id: from.id, is_active: true } })
  if (dryRun) return { providers: skills.length, created: 0 }
  let created = 0
  for (const s of skills) {
    for (const t of targets) {
      const r = await prisma.providerSkill.createMany({
        data: [{ provider_id: s.provider_id, category_id: t.id, years_experience: s.years_experience, service_radius_km: s.service_radius_km, hourly_rate: s.hourly_rate }],
        skipDuplicates: true,
      })
      created += r.count
    }
  }
  return { providers: skills.length, created }
}

/** Situação das mesclas propostas (para o painel do admin). */
export async function canonicalMergeStatus() {
  const slugs = Array.from(new Set(CANONICAL_MERGES.flatMap((m) => [m.from, m.into])))
  const cats = await prisma.category.findMany({
    where: { slug: { in: slugs } },
    select: { id: true, slug: true, name: true, is_active: true, merged_into_id: true },
  })
  const bySlug = new Map(cats.map((c) => [c.slug, c]))
  const out = []
  for (const m of CANONICAL_MERGES) {
    const from = bySlug.get(m.from)
    const into = bySlug.get(m.into)
    out.push({
      ...m,
      from_name: from?.name ?? null,
      into_name: into?.name ?? null,
      status: !from || !into ? 'MISSING' : from.merged_into_id ? 'DONE' : 'PENDING',
      counts: from ? await countUsage(prisma, from.id) : null,
    })
  }
  return out
}
