interface PriceField {
  affects_price: boolean
  price_modifier: Record<string, number> | null
}

interface AnswerMap {
  [fieldId: string]: string
}

interface PriceRange {
  min: number
  max: number
}

export function estimatePrice(
  baseMin: number,
  baseMax: number,
  fields: PriceField[],
  answers: AnswerMap
): PriceRange {
  let multiplier = 1

  for (const field of fields) {
    if (!field.affects_price || !field.price_modifier) continue

    // Encontra o valor respondido que corresponde a este campo
    const answeredValue = Object.values(answers).find(
      (v) => field.price_modifier![v] !== undefined
    )

    if (answeredValue && field.price_modifier[answeredValue]) {
      multiplier *= field.price_modifier[answeredValue]
    }
  }

  return {
    min: Math.round(baseMin * multiplier),
    max: Math.round(baseMax * multiplier),
  }
}
