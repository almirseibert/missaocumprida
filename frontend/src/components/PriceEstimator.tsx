'use client'

import { useEffect, useState, useRef } from 'react'
import { Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'

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

interface PriceEstimatorProps {
  categorySlug: string
  answers: Record<string, string>
  state?: string
  fallbackMin: number
  fallbackMax: number
  onEstimate?: (min: number, max: number) => void
}

export function PriceEstimator({
  categorySlug, answers, state, fallbackMin, fallbackMax, onEstimate,
}: PriceEstimatorProps) {
  const [result, setResult] = useState<EstimateResult>({
    min: fallbackMin, max: fallbackMax, breakdown: [],
  })
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastAnswersRef = useRef<string>('')

  useEffect(() => {
    const key = JSON.stringify(answers)
    if (key === lastAnswersRef.current) return
    lastAnswersRef.current = key
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const r = await api.post(`/categories/${categorySlug}/estimate`, { answers, state })
        const data = r.data.data as EstimateResult
        setResult(data)
        onEstimate?.(data.min, data.max)
      } catch {
        // mantém fallback
      } finally {
        setLoading(false)
      }
    }, 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [categorySlug, answers, state, onEstimate])

  return (
    <div className="bg-brand-50 border border-brand-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium text-brand-900">Estimativa de preço</div>
        {loading && <Loader2 className="animate-spin text-brand-600" size={16} />}
      </div>
      <div className="text-2xl font-bold text-brand-700">
        {formatCurrency(result.min)} <span className="text-base font-normal text-brand-500">–</span> {formatCurrency(result.max)}
        {result.unit && <span className="text-sm font-normal text-brand-500 ml-1">/ {result.unit}</span>}
      </div>
      {result.breakdown.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-brand-800">
          {result.breakdown.map((b, i) => (
            <li key={i} className="flex justify-between">
              <span>{b.label}</span>
              <span className="font-medium">{b.effect}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="text-xs text-brand-600 mt-2">
        Preço médio com base nas suas respostas — a proposta final é feita pelo prestador.
      </div>
    </div>
  )
}
