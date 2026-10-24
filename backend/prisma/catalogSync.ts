import crypto from 'crypto'
import { PrismaClient, FieldType } from '@prisma/client'

/**
 * Sincronização idempotente do questionário de uma categoria.
 * ------------------------------------------------------------------
 * - Cada pergunta tem uma chave estável: `q_` + md5(pergunta)[0..10] (a mesma
 *   fórmula da migração 20261024040000). Rodar o seed de novo ATUALIZA as
 *   perguntas existentes — os IDs não mudam e as respostas dos pedidos antigos
 *   continuam apontando para elas.
 * - Perguntas que saíram do seed são ARQUIVADAS (is_active=false), nunca apagadas.
 * - Regras do catálogo (revisão pós-Play):
 *   · fotos não são perguntas: o formulário tem um bloco de fotos opcional em
 *     TODAS as categorias; o texto vira a dica (photo_hint);
 *   · "Descreva…" vira a dica/obrigatoriedade do campo Descrição;
 *   · "É urgente?" repete o seletor de urgência do formulário;
 *   · Sim/Não nunca é obrigatório (desmarcado = "Não").
 */

export type SeedField = {
  question: string
  field_type: string
  options?: string[]
  is_required?: boolean
  affects_price?: boolean
  price_modifier?: Record<string, number>
  help_text?: string
  placeholder?: string
  key?: string
}

export function fieldKey(question: string): string {
  return 'q_' + crypto.createHash('md5').update(question, 'utf8').digest('hex').slice(0, 10)
}

// Categorias em que a pergunta de urgência repete o formulário
const URGENCY_DUPLICATES = new Set([
  'encanador', 'chaveiro', 'chaveiro-automotivo', 'motoboy', 'recuperacao-dados',
  'eletrica-automotiva', 'despachante-documentos',
])

/** Opções que pertencem a outra categoria (evita o mesmo serviço em dois lugares). */
export const OPTION_OVERRIDES: Record<string, Record<string, { remove?: string[]; add?: string[] }>> = {
  'limpeza-telhado': {
    'Tipo de serviço no telhado?': { remove: ['Desobstrução de calhas', 'Impermeabilização', 'Troca de telhas quebradas'] },
  },
  lavanderia: { 'Tipo de serviço?': { remove: ['Somente passadoria'] } },
  'jardinagem-paisagismo': {
    'Tipo de serviço?': { remove: ['Horta orgânica', 'Poda de árvores/arbustos'], add: ['Poda de arbustos e cerca viva'] },
  },
  depilacao: {
    'Região a depilar?': { remove: ['Sobrancelha'] },
    'Método preferido?': { remove: ['Henna (para sobrancelha)'] },
  },
  'estetica-facial': { 'Tipo de tratamento?': { remove: ['Sobrancelha design + henna'] } },
  'personal-stylist': { 'Qual serviço?': { remove: ['Closet detox (organizar guarda-roupa)'] } },
  'instalar-ar-condicionado': { 'Tipo de serviço?': { add: ['Conserto (não gela, vazamento)'] } },
  'desenvolvimento-site': { 'Tipo de projeto?': { remove: ['Loja virtual/E-commerce'] } },
  'chef-particular': { 'Tipo de serviço?': { remove: ['Churrasco', 'Refeições semanais', 'Buffet completo'] } },
  'aulas-particulares': { 'Qual matéria/disciplina?': { remove: ['ENEM/Vestibular', 'Concursos Públicos'] } },
  'conserto-eletrodomesticos': {
    'Qual eletrodoméstico?': {
      remove: ['Geladeira/Freezer', 'Máquina de lavar roupa', 'Fogão/Cooktop', 'Forno elétrico/Microondas', 'Aspirador de pó', 'Liquidificador/Batedeira', 'Televisor', 'Ar-condicionado (conserto)'],
      add: ['Freezer horizontal', 'Coifa/depurador', 'Frigobar/adega', 'Outro'],
    },
  },
  'limpeza-sofas': { 'O que será higienizado?': { add: ['Cortinas', 'Tapete + sofá'] } },
  'house-sitting': { 'O que precisa ser feito?': { add: ['Só regar as plantas'] } },
}

/** Descrições que deixam claro o que cada serviço parecido faz (e o que não faz). */
export const DESCRIPTION_OVERRIDES: Record<string, { name?: string; description: string }> = {
  'limpeza-telhado': { description: 'Limpeza de telhas e remoção de limo/sujeira. Calhas, troca de telhas e impermeabilização têm categorias próprias.' },
  'calhas-rufos': { description: 'Instalação, troca e desentupimento de calhas e rufos.' },
  'reforma-telhado': { description: 'Troca de telhas, madeiramento e estrutura do telhado.' },
  impermeabilizacao: { description: 'Impermeabilização de lajes, terraços, paredes e caixas d\'água.' },
  lavanderia: { description: 'Lavagem de roupas, edredons e limpeza a seco, com retirada e entrega. Para passar roupa em casa, use Passadeira.' },
  passadeira: { description: 'Profissional que passa roupas na sua casa (por hora ou por peças).' },
  'corte-cabelo': { name: 'Cabeleireiro(a)', description: 'Corte, escova e penteado (feminino, masculino e infantil). Barba e cortes masculinos de barbearia: Barbeiro.' },
  barbeiro: { description: 'Corte masculino, degradê, barba e acabamento de barbearia.' },
  maquiagem: { description: 'Maquiagem social, para eventos ou fotos. Pacote completo para o casamento: Dia da Noiva.' },
  'dia-da-noiva': { description: 'Pacote completo para o casamento: maquiagem, penteado e preparação da noiva.' },
  'aulas-particulares': { description: 'Reforço escolar e aulas de matérias. Preparação para ENEM, vestibular e concursos: Preparatório.' },
  'preparatorio-enem-concursos': { description: 'Preparação focada em ENEM, vestibulares e concursos públicos.' },
  'desenvolvimento-site': { description: 'Sites institucionais, landing pages, blogs e sistemas web. Para vender online: Loja Virtual.' },
  'loja-virtual': { description: 'Criação e configuração de loja virtual (e-commerce).' },
  'jardinagem-paisagismo': { description: 'Manutenção de jardins, poda de arbustos, plantio e projeto paisagístico. Horta e corte de árvores têm categorias próprias.' },
  'instalar-ar-condicionado': { description: 'Instalação, limpeza, recarga de gás e conserto de ar-condicionado.' },
  depilacao: { description: 'Depilação com cera, linha ou creme. Sobrancelha tem categoria própria (Design de Sobrancelhas).' },
  'horta-em-casa': { description: 'Montagem e manutenção de hortas em casa, varanda ou quintal.' },
  'chef-particular': { description: 'Chef que prepara um menu na sua casa (jantar, almoço, evento pequeno).' },
  churrasqueiro: { description: 'Churrasqueiro para festas e eventos.' },
  'buffet-completo': { description: 'Comida, equipe e equipamentos para eventos.' },
  'cozinheira-marmitas': { description: 'Refeições da semana e marmitas preparadas na sua casa.' },
  'conserto-eletrodomesticos': {
    name: 'Conserto de Outros Eletrodomésticos',
    description: 'Lava-louças, secadora, freezer, coifa, ar-condicionado e outros. Geladeira, máquina de lavar, fogão, micro-ondas e portáteis têm categorias próprias.',
  },
  carreto: { description: 'Transporte de poucos itens, móveis avulsos ou pequenas cargas. Mudança completa tem categoria própria.' },
  'limpeza-residencial': { description: 'Faxina, limpeza pesada, pós-obra e de mudança, avulsa ou com frequência.' },
  'limpeza-sofas': { description: 'Higienização de sofás, colchões, poltronas, tapetes, carpetes e cortinas.' },
  'personal-trainer': { description: 'Treino personalizado: musculação, funcional, corrida e condicionamento.' },
  'house-sitting': { description: 'Visitas de checagem, regar plantas, recolher correspondência e cuidar da casa enquanto você viaja.' },
  'aulas-informatica': { description: 'Informática básica e avançada, inclusive para idosos (celular, WhatsApp, banco pelo app).' },
}

export type CatalogRulesResult = {
  fields: SeedField[]
  photo_hint: string | null
  description_hint: string | null
  description_required: boolean
}

export function applyCatalogRules(slug: string, raw: SeedField[]): CatalogRulesResult {
  const photoHints: string[] = []
  let description_hint: string | null = null
  let description_required = false
  const fields: SeedField[] = []
  const overrides = OPTION_OVERRIDES[slug] ?? {}

  for (const f of raw) {
    if (f.field_type === 'PHOTO') { photoHints.push(f.question); continue }
    if (f.field_type === 'TEXTAREA' && /^descreva/i.test(f.question.trim())) {
      if (!description_hint) description_hint = f.placeholder || f.question
      description_required = description_required || f.is_required !== false
      continue
    }
    if (URGENCY_DUPLICATES.has(slug) && /urgente|urgência/i.test(f.question) && ['BOOLEAN', 'RADIO'].includes(f.field_type)) continue
    if (slug === 'cerimonialista' && /^data prevista/i.test(f.question)) continue

    const field: SeedField = { ...f }
    if (field.field_type === 'BOOLEAN') field.is_required = false
    if (slug === 'motorista-particular' && field.question === 'Quantas horas?') {
      field.options = ['1-2 horas', '3-4 horas', '5-8 horas']
      field.is_required = false
    }
    const ov = overrides[field.question]
    if (ov && field.options) {
      let options = field.options.filter((o) => !(ov.remove ?? []).includes(o))
      for (const add of ov.add ?? []) if (!options.includes(add)) options = [...options, add]
      field.options = options
      if (field.price_modifier) {
        const pm: Record<string, number> = {}
        for (const o of options) pm[o] = field.price_modifier[o] ?? 1
        for (const [k, v] of Object.entries(field.price_modifier)) if (k === 'true' || k === 'false') pm[k] = v
        field.price_modifier = pm
      }
    }
    fields.push(field)
  }
  return { fields, photo_hint: photoHints.length ? photoHints.join(' · ') : null, description_hint, description_required }
}

/** Sincroniza (upsert por chave) o questionário e as dicas da categoria. */
export async function syncQuestionnaire(prisma: PrismaClient, categoryId: string, slug: string, raw: SeedField[]): Promise<void> {
  const rules = applyCatalogRules(slug, raw)
  const existing = await prisma.questionnaireField.findMany({ where: { category_id: categoryId } })
  const byKey = new Map(existing.map((e) => [e.key ?? fieldKey(e.question), e]))
  const seen = new Set<string>()

  for (let i = 0; i < rules.fields.length; i++) {
    const f = rules.fields[i]
    let key = f.key ?? fieldKey(f.question)
    if (seen.has(key)) key = `${key}_${i + 1}`
    seen.add(key)
    const data = {
      question: f.question,
      field_type: f.field_type as FieldType,
      options: f.options ? f.options : undefined,
      is_required: f.field_type === 'BOOLEAN' ? false : f.is_required ?? true,
      order: i + 1,
      affects_price: f.affects_price ?? false,
      price_modifier: f.price_modifier ? f.price_modifier : undefined,
      help_text: f.help_text ?? null,
      placeholder: f.placeholder ?? null,
      is_active: true,
    }
    const current = byKey.get(key)
    if (current) {
      await prisma.questionnaireField.update({ where: { id: current.id }, data: { ...data, key } })
    } else {
      await prisma.questionnaireField.create({ data: { ...data, key, category_id: categoryId } })
    }
  }
  // O que saiu do seed fica arquivado (pedidos antigos ainda apontam para lá)
  const stale = existing.filter((e) => !seen.has(e.key ?? fieldKey(e.question)) && e.is_active)
  if (stale.length) {
    await prisma.questionnaireField.updateMany({ where: { id: { in: stale.map((s) => s.id) } }, data: { is_active: false, is_required: false } })
  }

  const desc = DESCRIPTION_OVERRIDES[slug]
  await prisma.category.update({
    where: { id: categoryId },
    data: {
      requires_photos: false,
      photo_hint: rules.photo_hint,
      description_hint: rules.description_hint,
      description_required: rules.description_required,
      ...(desc ? { description: desc.description, ...(desc.name ? { name: desc.name } : {}) } : {}),
    },
  })
}

/** Ordem de exibição: alfabética dentro de cada grupo (antes tudo era 0 = aleatório). */
export async function reorderCategories(prisma: PrismaClient): Promise<void> {
  const groups = await prisma.serviceGroup.findMany({ select: { id: true } })
  for (const g of groups) {
    const cats = await prisma.category.findMany({ where: { group_id: g.id }, select: { id: true, name: true, is_active: true } })
    cats.sort((a, b) => Number(b.is_active) - Number(a.is_active) || a.name.localeCompare(b.name, 'pt-BR'))
    for (let i = 0; i < cats.length; i++) {
      await prisma.category.update({ where: { id: cats[i].id }, data: { order: cats[i].is_active ? i + 1 : 999 } })
    }
  }
}
