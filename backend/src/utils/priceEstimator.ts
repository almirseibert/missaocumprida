// ============================================================
// PRICE ESTIMATOR — engine de precificação dinâmica
// ============================================================
//
// Suporta 4 métodos (em pricing_formula.method):
//   PER_UNIT  → quantidade × base_rate (m², ponto, sessão, km)
//   HOURLY    → horas × base_rate
//   FIXED     → faixa fixa, sem multiplicar por quantidade
//   TIERED    → faixa fixa que muda com base no valor de um campo
//
// pricing_formula (Category):
// {
//   "method": "PER_UNIT",
//   "unit_field": "area_m2",        // key da pergunta que carrega a quantidade
//   "base_rate_min": 18,            // R$/unidade
//   "base_rate_max": 25,            // R$/unidade
//   "min_charge": 250,              // chamada mínima
//   "tiers": [                      // só p/ TIERED
//     { "match_field": "tipo_servico", "value": "visita", "min": 80, "max": 150 },
//     { "match_field": "tipo_servico", "value": "instalacao_tomada", "method": "PER_UNIT", "unit_field": "pontos", "base_rate_min": 45, "base_rate_max": 130 }
//   ]
// }
//
// pricing_effect (QuestionnaireField):
//   { "type": "MULTIPLIER", "options": { "boa": 1.0, "media": 1.2, "ruim": 1.5 } }
//   { "type": "UNIT_QUANTITY" }   // só para o NUMBER da unidade (alias para unit_field)
//   { "type": "SURCHARGE", "if_true": { "kind": "FIXED", "amount": 50 } }
//   { "type": "SURCHARGE", "if_true": { "kind": "PERCENT", "pct": 0.15 } }
//   { "type": "SURCHARGE", "if_false": { ... } }   // surcharge quando resposta = false
//   { "type": "EXTRA_PER_UNIT", "amount_min": 8, "amount_max": 12 } // adiciona R$/unidade
// ============================================================

type Method = 'PER_UNIT' | 'HOURLY' | 'FIXED' | 'TIERED'

interface FieldLite {
  id: string
  key: string | null
  field_type: string
  affects_price: boolean
  price_modifier: any
  pricing_effect: any
}

interface AnswerMap {
  // chave pode ser id do field ou a key estável
  [k: string]: string | number | boolean
}

interface BreakdownItem {
  label: string
  effect: string
  range: [number, number]
}

interface EstimateResult {
  min: number
  max: number
  unit?: string
  breakdown: BreakdownItem[]
}

const REGION_DEFAULT: Record<string, number> = {
  SP: 1.4, RJ: 1.3, DF: 1.2, MG: 1.1, RS: 1.05, PR: 1.05, SC: 1.05,
  BA: 0.95, PE: 0.95, CE: 0.9, AM: 0.9, PA: 0.85, MA: 0.85,
}

function num(v: any, fallback = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  const parsed = parseFloat(String(v ?? '').replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : fallback
}

function boolVal(v: any): boolean {
  if (typeof v === 'boolean') return v
  const s = String(v ?? '').toLowerCase().trim()
  return s === 'true' || s === 'sim' || s === '1' || s === 'yes'
}

// Resolve uma resposta por key estável OU por id de campo
function getAnswer(
  fields: FieldLite[],
  answers: AnswerMap,
  key: string,
): any {
  if (answers[key] !== undefined) return answers[key]
  const field = fields.find((f) => f.key === key)
  if (field && answers[field.id] !== undefined) return answers[field.id]
  return undefined
}

function regionMult(formula: any, state?: string | null): number {
  const table: Record<string, number> = formula?.region_multiplier || REGION_DEFAULT
  if (!state) return 1
  return table[state] ?? 1
}

/**
 * Estimador principal.
 * - `fields` deve incluir todos os QuestionnaireField da categoria.
 * - `formula` é o JSON `pricing_formula` da Category.
 * - `answers` mapeia key OU id → valor da resposta.
 * - `state` UF (ex "SP") usada no multiplicador regional.
 * - Fallback: se `formula` está vazio, usa o algoritmo legado (base_price_min × modifier).
 */
export function estimatePriceDynamic(
  formula: any,
  fields: FieldLite[],
  answers: AnswerMap,
  baseMin: number,
  baseMax: number,
  state?: string | null,
): EstimateResult {
  // Fallback compatível com o estimador antigo
  if (!formula || typeof formula !== 'object') {
    return estimatePrice(baseMin, baseMax, fields as any, answers as any)
  }

  let working = { ...formula } as any
  let breakdown: BreakdownItem[] = []

  // TIERED: o "tipo de serviço" troca o método/base
  if (working.method === 'TIERED' && Array.isArray(working.tiers)) {
    const tierFieldKey = working.tiers[0]?.match_field
    const tierAnswer = tierFieldKey ? getAnswer(fields, answers, tierFieldKey) : undefined
    const matched = working.tiers.find((t: any) => String(t.value) === String(tierAnswer))
    if (matched) {
      working = { ...working, ...matched }
      breakdown.push({
        label: `Opção: ${matched.label ?? matched.value}`,
        effect: 'troca o cálculo base',
        range: [matched.min ?? matched.base_rate_min ?? 0, matched.max ?? matched.base_rate_max ?? 0],
      })
    } else {
      // sem opção escolhida, devolve faixa cheia conservadora
      const all = working.tiers.flatMap((t: any) => [t.min, t.max, t.base_rate_min, t.base_rate_max]).filter(Number.isFinite)
      const low = Math.min(...all)
      const high = Math.max(...all)
      return { min: Math.round(low), max: Math.round(high), unit: working.pricing_unit, breakdown: [] }
    }
  }

  const method: Method = working.method || 'FIXED'

  // Base mínima e máxima conforme o método
  let rangeMin = 0
  let rangeMax = 0

  if (method === 'FIXED') {
    rangeMin = num(working.min ?? working.base_rate_min ?? baseMin)
    rangeMax = num(working.max ?? working.base_rate_max ?? baseMax)
  } else {
    // PER_UNIT / HOURLY
    const unitField = working.unit_field as string
    let quantity = unitField ? num(getAnswer(fields, answers, unitField), 0) : 0
    if (!quantity || quantity <= 0) {
      // sem quantidade, mostra faixa de 1 unidade como referência
      quantity = 1
      breakdown.push({
        label: 'Quantidade não informada',
        effect: 'mostrando faixa por unidade',
        range: [num(working.base_rate_min), num(working.base_rate_max)],
      })
    }
    rangeMin = num(working.base_rate_min) * quantity
    rangeMax = num(working.base_rate_max) * quantity
    if (quantity > 1 || !breakdown.length) {
      breakdown.push({
        label: `${quantity} × ${working.pricing_unit ?? 'un'}`,
        effect: `R$ ${working.base_rate_min}–${working.base_rate_max} por ${working.pricing_unit ?? 'unidade'}`,
        range: [rangeMin, rangeMax],
      })
    }
  }

  // Aplica modificadores por campo
  for (const field of fields) {
    const effect = field.pricing_effect
    if (!effect || typeof effect !== 'object') continue
    const key = field.key || field.id
    const ans = getAnswer(fields, answers, key)
    if (ans === undefined || ans === null || ans === '') continue

    if (effect.type === 'MULTIPLIER' && effect.options) {
      const mult = effect.options[String(ans)] ?? effect.options[String(ans).toLowerCase()]
      if (typeof mult === 'number' && mult !== 1) {
        const before: [number, number] = [rangeMin, rangeMax]
        rangeMin *= mult
        rangeMax *= mult
        breakdown.push({
          label: field.key ?? field.id,
          effect: `× ${mult.toFixed(2)}`,
          range: [rangeMin - before[0], rangeMax - before[1]],
        })
      }
    } else if (effect.type === 'SURCHARGE') {
      const v = boolVal(ans)
      const branch = v ? effect.if_true : effect.if_false
      if (branch) {
        if (branch.kind === 'FIXED' && typeof branch.amount === 'number') {
          rangeMin += branch.amount
          rangeMax += branch.amount
          breakdown.push({ label: field.key ?? field.id, effect: `+ R$ ${branch.amount}`, range: [branch.amount, branch.amount] })
        } else if (branch.kind === 'PERCENT' && typeof branch.pct === 'number') {
          const addMin = rangeMin * branch.pct
          const addMax = rangeMax * branch.pct
          rangeMin += addMin
          rangeMax += addMax
          breakdown.push({ label: field.key ?? field.id, effect: `+ ${Math.round(branch.pct * 100)}%`, range: [addMin, addMax] })
        }
      }
    } else if (effect.type === 'EXTRA_PER_UNIT' && (method === 'PER_UNIT' || method === 'HOURLY')) {
      const v = boolVal(ans)
      if (v) {
        const unitField = working.unit_field as string
        const quantity = unitField ? num(getAnswer(fields, answers, unitField), 1) : 1
        const addMin = num(effect.amount_min) * quantity
        const addMax = num(effect.amount_max) * quantity
        rangeMin += addMin
        rangeMax += addMax
        breakdown.push({ label: field.key ?? field.id, effect: `+ R$ ${effect.amount_min}–${effect.amount_max}/${working.pricing_unit ?? 'un'}`, range: [addMin, addMax] })
      }
    }
  }

  // Multiplicador regional
  const region = regionMult(working, state)
  if (region !== 1) {
    const beforeMin = rangeMin, beforeMax = rangeMax
    rangeMin *= region
    rangeMax *= region
    breakdown.push({ label: `Região ${state}`, effect: `× ${region.toFixed(2)}`, range: [rangeMin - beforeMin, rangeMax - beforeMax] })
  }

  // Chamada mínima
  const minCharge = num(working.min_charge, 0)
  if (minCharge > 0 && rangeMin < minCharge) {
    rangeMin = minCharge
    if (rangeMax < minCharge) rangeMax = minCharge
    breakdown.push({ label: 'Chamada mínima', effect: `mínimo R$ ${minCharge}`, range: [0, 0] })
  }

  return {
    min: Math.round(rangeMin),
    max: Math.round(rangeMax),
    unit: working.pricing_unit,
    breakdown,
  }
}

// ============================================================
// LEGACY — algoritmo antigo (mantido para compatibilidade)
// ============================================================
interface PriceField {
  affects_price: boolean
  price_modifier: Record<string, number> | null
}

interface PriceRange {
  min: number
  max: number
  breakdown: BreakdownItem[]
}

export function estimatePrice(
  baseMin: number,
  baseMax: number,
  fields: PriceField[],
  answers: { [fieldId: string]: string }
): PriceRange {
  let multiplier = 1

  for (const field of fields) {
    if (!field.affects_price || !field.price_modifier) continue
    const answeredValue = Object.values(answers).find(
      (v) => (field.price_modifier as Record<string, number>)[v as string] !== undefined
    )
    if (answeredValue && field.price_modifier[answeredValue as string]) {
      multiplier *= field.price_modifier[answeredValue as string]
    }
  }

  return {
    min: Math.round(baseMin * multiplier),
    max: Math.round(baseMax * multiplier),
    breakdown: [],
  }
}
