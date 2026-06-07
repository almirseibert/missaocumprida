'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Sparkles, ArrowRight } from 'lucide-react'
import { api } from '@/lib/api'
import { VerifiedBadge } from '@/components/VerifiedBadge'

type Provider = {
  id: string
  name: string
  avatar: string | null
  rating_avg: number | null
  rating_count: number | null
  is_verified_pro?: boolean
  distance_km?: number | null
}

type Suggestion = {
  category: { id: string; name: string; slug: string; icon: string }
  label: string
  delay_days: number
  providers: Provider[]
}

export function CrossSellSuggestions({ orderId }: { orderId: string }) {
  const [items, setItems] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/recommendations/after-order/${orderId}`)
      .then(r => setItems(r.data.data?.suggestions || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [orderId])

  if (loading) return null
  if (items.length === 0) return null

  return (
    <div className="bg-gradient-to-br from-brand-50 to-violet-50 rounded-2xl p-5 border border-brand-200 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-5 h-5 text-brand-700" />
        <h3 className="font-bold text-brand-900">Que tal contratar também?</h3>
      </div>
      <p className="text-xs text-slate2-600 mb-4">
        Serviços que combinam bem com o que você acabou de contratar.
      </p>
      <div className="space-y-3">
        {items.map((s) => (
          <Link
            key={s.category.id}
            href={`/pedido/novo/${s.category.slug}`}
            className="block bg-white rounded-xl p-3 hover:shadow-md transition-shadow border border-slate2-100"
          >
            <div className="flex items-center gap-3">
              <div className="text-2xl">{s.category.icon}</div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate2-900 text-sm">{s.category.name}</p>
                <p className="text-xs text-slate2-600 line-clamp-1">{s.label}</p>
                {s.providers.length > 0 && (
                  <p className="text-[11px] text-slate2-500 mt-1 flex items-center gap-1">
                    {s.providers.length} prestador{s.providers.length > 1 ? 'es' : ''} próximo{s.providers.length > 1 ? 's' : ''}
                    {s.providers.some(p => p.is_verified_pro) && <VerifiedBadge size="xs" />}
                  </p>
                )}
              </div>
              <ArrowRight className="w-4 h-4 text-brand-600" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
