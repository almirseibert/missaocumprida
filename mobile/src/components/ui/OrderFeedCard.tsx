import { TouchableOpacity, View, Text } from 'react-native'
import { MapPin, Calendar } from 'lucide-react-native'
import { formatCurrency, formatDate } from '../../lib/utils'

interface OrderLike {
  id: string
  title: string
  created_at: string
  category?: { icon: string; name: string } | null
  neighborhood?: string | null
  city?: string | null
  distance_km?: number | null
  desired_date?: string | null
  estimated_price_min?: number | null
  estimated_price_max?: number | null
}

interface OrderFeedCardProps {
  order: OrderLike
  /** Percentual líquido recebido pelo prestador (default 0.9 = 90% após taxa) */
  providerNetRatio?: number
  onPress?: () => void
  /** Texto do CTA do canto inferior direito (default "Proposta") */
  ctaLabel?: string
  onCtaPress?: () => void
}

function formatAgo(createdAt: string): string {
  const minutes = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000)
  if (minutes < 60)   return `há ${minutes}min`
  if (minutes < 1440) return `há ${Math.floor(minutes / 60)}h`
  return formatDate(createdAt)
}

/**
 * Card de pedido do feed do prestador (ref: mockup Tela 03 — Telas Mobile).
 * Linhas: categoria pill + tempo · título · meta (local, distância, data) · preço + CTA.
 */
export function OrderFeedCard({
  order,
  providerNetRatio = 0.9,
  onPress,
  ctaLabel = 'Proposta',
  onCtaPress,
}: OrderFeedCardProps) {
  const min = order.estimated_price_min
  const max = order.estimated_price_max
  const ago = formatAgo(order.created_at)

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      className="bg-white border border-slate2-200 rounded-[14px] p-3.5"
    >
      {/* Linha 1: categoria + tempo */}
      <View className="flex-row items-center gap-1.5 mb-2">
        {order.category && (
          <>
            <Text style={{ fontSize: 16 }}>{order.category.icon}</Text>
            <View className="bg-brand-100 px-2 py-0.5 rounded-full flex-row items-center gap-1">
              <View className="w-[5px] h-[5px] rounded-full bg-brand-700 opacity-70" />
              <Text className="font-display-bold text-[10px] text-brand-700">
                {order.category.name}
              </Text>
            </View>
          </>
        )}
        <Text className="font-sans text-[10px] text-slate2-400 ml-auto">{ago}</Text>
      </View>

      {/* Título */}
      <Text
        className="font-display-bold text-[14px] text-slate2-900 mb-1"
        numberOfLines={2}
      >
        {order.title}
      </Text>

      {/* Meta inline */}
      <View className="flex-row flex-wrap gap-2.5 mb-2.5">
        {(order.neighborhood || order.city) && (
          <View className="flex-row items-center gap-0.5">
            <MapPin size={10} color="#64748B" />
            <Text className="font-sans text-[11px] text-slate2-500" numberOfLines={1}>
              {[order.neighborhood, order.city].filter(Boolean).join(', ')}
            </Text>
          </View>
        )}
        {order.distance_km != null && (
          <Text className="font-display-bold text-[11px] text-brand-600">
            {order.distance_km.toFixed(1)} km
          </Text>
        )}
        {order.desired_date && (
          <View className="flex-row items-center gap-0.5">
            <Calendar size={10} color="#64748B" />
            <Text className="font-sans text-[11px] text-slate2-500">
              {formatDate(order.desired_date)}
            </Text>
          </View>
        )}
      </View>

      {/* Preço + ação */}
      <View className="flex-row items-center justify-between">
        <View>
          {min ? (
            <>
              <Text className="font-display-extrabold text-[17px] text-brand-700 leading-tight">
                {formatCurrency(min)}{max ? `–${formatCurrency(max)}` : ''}
              </Text>
              <Text className="font-display-bold text-[10px] text-accent-600">
                ~{formatCurrency(min * providerNetRatio)} para você
              </Text>
            </>
          ) : (
            <Text className="font-sans text-[12px] text-slate2-500">
              Aberto à proposta
            </Text>
          )}
        </View>
        <TouchableOpacity
          onPress={onCtaPress ?? onPress}
          activeOpacity={0.85}
          className="bg-brand-700 rounded-[10px] px-3.5 py-2"
        >
          <Text className="font-display-bold text-[12px] text-white">
            {ctaLabel}
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  )
}
