import { TouchableOpacity, Text } from 'react-native'
import { formatCurrency } from '../../lib/utils'

interface CategoryCardProps {
  icon: string
  name: string
  /** Preço base mínimo — formatado como "De R$ X". Se ausente, o subtítulo é omitido. */
  basePriceMin?: number
  /** Subtítulo customizado (sobrescreve o default "De R$ ..."). */
  subtitle?: string
  onPress?: () => void
}

/**
 * Card de categoria do grid 2×2 da Home (ref: mockup Tela 01).
 * Fundo branco, borda slate2-200, ícone emoji 26px, nome em display-bold.
 */
export function CategoryCard({
  icon,
  name,
  basePriceMin,
  subtitle,
  onPress,
}: CategoryCardProps) {
  const sub = subtitle ?? (basePriceMin != null ? `De ${formatCurrency(basePriceMin)}` : null)

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      className="bg-white border border-slate2-200 rounded-2xl px-3 py-3.5"
    >
      <Text style={{ fontSize: 26, marginBottom: 8 }}>{icon}</Text>
      <Text
        className="font-display-bold text-[13px] text-slate2-900 mb-0.5"
        numberOfLines={1}
      >
        {name}
      </Text>
      {sub && (
        <Text className="font-sans text-[11px] text-slate2-500">{sub}</Text>
      )}
    </TouchableOpacity>
  )
}
