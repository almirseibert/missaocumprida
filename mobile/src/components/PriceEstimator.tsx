import { useEffect, useRef, useState } from 'react'
import { View, Text, ActivityIndicator } from 'react-native'
import { api } from '../lib/api'
import { formatCurrency } from '../lib/utils'

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

interface Props {
  categorySlug: string
  answers: Record<string, string | boolean | number>
  state?: string
  fallbackMin: number
  fallbackMax: number
  onEstimate?: (min: number, max: number) => void
}

export function PriceEstimator({
  categorySlug, answers, state, fallbackMin, fallbackMax, onEstimate,
}: Props) {
  const [result, setResult] = useState<EstimateResult>({
    min: fallbackMin, max: fallbackMax, breakdown: [],
  })
  const [loading, setLoading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastKeyRef = useRef('')

  useEffect(() => {
    const key = JSON.stringify(answers)
    if (key === lastKeyRef.current) return
    lastKeyRef.current = key
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const r = await api.post(`/categories/${categorySlug}/estimate`, { answers, state })
        const data = r.data.data as EstimateResult
        setResult(data)
        onEstimate?.(data.min, data.max)
      } catch {
        /* mantém fallback */
      } finally {
        setLoading(false)
      }
    }, 400)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [categorySlug, answers, state, onEstimate])

  return (
    <View className="bg-brand-50 border border-brand-200 rounded-2xl p-4">
      <View className="flex-row items-center justify-between mb-1">
        <Text className="text-sm font-semibold text-brand-900">Estimativa de preço</Text>
        {loading && <ActivityIndicator size="small" color="#1D4ED8" />}
      </View>
      <Text className="text-2xl font-extrabold text-brand-700">
        {formatCurrency(result.min)} <Text className="text-base font-normal text-brand-500">–</Text> {formatCurrency(result.max)}
        {result.unit ? <Text className="text-sm font-normal text-brand-500">{` / ${result.unit}`}</Text> : null}
      </Text>
      {result.breakdown.length > 0 && (
        <View className="mt-3">
          {result.breakdown.map((b, i) => (
            <View key={i} className="flex-row justify-between mb-0.5">
              <Text className="text-xs text-brand-800 flex-1">{b.label}</Text>
              <Text className="text-xs text-brand-800 font-semibold ml-2">{b.effect}</Text>
            </View>
          ))}
        </View>
      )}
      <Text className="text-xs text-brand-600 mt-2">
        Preço médio com base nas suas respostas — a proposta final é feita pelo prestador.
      </Text>
    </View>
  )
}
