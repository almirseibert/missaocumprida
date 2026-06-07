import { TouchableOpacity, View, Text } from 'react-native'

interface StatCellProps {
  icon: string
  value: string
  label: string
  onPress?: () => void
}

/**
 * Célula da "stats strip" da Home do prestador (ref: mockup Tela 03).
 * Usada lado a lado em flex-row 1/3 cada — ícone emoji, valor em display-extrabold
 * e label minúscula em slate2-500. Vira TouchableOpacity quando `onPress` é passado.
 */
export function StatCell({ icon, value, label, onPress }: StatCellProps) {
  const Wrap = onPress ? TouchableOpacity : View
  return (
    <Wrap
      onPress={onPress}
      activeOpacity={0.7}
      className="flex-1 items-center py-2.5"
    >
      <Text style={{ fontSize: 18 }} className="mb-0.5">{icon}</Text>
      <Text className="font-display-extrabold text-[15px] text-slate2-900">
        {value}
      </Text>
      <Text className="font-sans text-[10px] text-slate2-500 mt-0.5">
        {label}
      </Text>
    </Wrap>
  )
}
