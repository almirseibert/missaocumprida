import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { router } from 'expo-router'
import { Sparkles, ChevronRight, ShieldCheck } from 'lucide-react-native'
import { api } from '../lib/api'

type Suggestion = {
  category: { id: string; name: string; slug: string; icon: string }
  label: string
  delay_days: number
  providers: Array<{ id: string; name: string; is_verified_pro?: boolean }>
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

  if (loading || items.length === 0) return null

  return (
    <View className="bg-violet-50 rounded-2xl p-4 border border-violet-200">
      <View className="flex-row items-center gap-2 mb-2">
        <Sparkles size={18} color="#7C3AED" />
        <Text className="font-bold text-violet-900">Que tal contratar também?</Text>
      </View>
      <Text className="text-xs text-slate2-600 mb-3">
        Serviços que combinam com o que você acabou de contratar.
      </Text>
      {items.map(s => {
        const hasVerified = s.providers.some(p => p.is_verified_pro)
        return (
          <TouchableOpacity
            key={s.category.id}
            onPress={() => router.push(`/(app)/pedido/novo/${s.category.slug}` as any)}
            className="bg-white rounded-xl p-3 mb-2 flex-row items-center gap-3 border border-slate2-100"
          >
            <Text className="text-2xl">{s.category.icon}</Text>
            <View className="flex-1">
              <Text className="font-semibold text-slate2-900 text-sm">{s.category.name}</Text>
              <Text className="text-xs text-slate2-600" numberOfLines={1}>{s.label}</Text>
              {s.providers.length > 0 && (
                <View className="flex-row items-center gap-1 mt-0.5">
                  <Text className="text-[11px] text-slate2-500">
                    {s.providers.length} prestador{s.providers.length > 1 ? 'es' : ''} próximo{s.providers.length > 1 ? 's' : ''}
                  </Text>
                  {hasVerified && <ShieldCheck size={10} color="#2563EB" />}
                </View>
              )}
            </View>
            <ChevronRight size={16} color="#7C3AED" />
          </TouchableOpacity>
        )
      })}
    </View>
  )
}
