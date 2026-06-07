import { View, ViewProps } from 'react-native'

interface CardProps extends ViewProps {
  /** padding interno em px (default: 16 = guia gap-4) */
  padding?: number
  /** raio (default: 14 = "Cards" do guia) */
  radius?: number
  /** elevação: 0 = sem sombra (default), 1–4 conforme spec do guia */
  elevation?: 0 | 1 | 2 | 3 | 4
  /** desabilita a borda padrão */
  noBorder?: boolean
}

const SHADOWS = {
  0: undefined,
  1: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  2: { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  3: { shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 32, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  4: { shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 48, shadowOffset: { width: 0, height: 16 }, elevation: 12 },
} as const

export function Card({
  padding = 16,
  radius = 14,
  elevation = 0,
  noBorder = false,
  style,
  children,
  ...rest
}: CardProps) {
  return (
    <View
      style={[
        {
          backgroundColor: '#fff',
          borderRadius: radius,
          padding,
          borderWidth: noBorder ? 0 : 1,
          borderColor: '#E2E8F0', // slate2-200
        },
        SHADOWS[elevation],
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  )
}
