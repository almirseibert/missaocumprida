import {
  TouchableOpacity, Text, ActivityIndicator,
  View, TouchableOpacityProps,
} from 'react-native'

export type ButtonVariant =
  | 'primary'    // Azul Confiança — ação principal
  | 'success'    // Verde Missão — confirmar conclusão / aceitar proposta
  | 'secondary'  // Cinza suave — cancelar / ação secundária
  | 'outline'    // contorno brand
  | 'ghost'      // transparente, hover slate2-100
  | 'danger'     // erro / destrutivo

export type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends TouchableOpacityProps {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  fullWidth?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  children: React.ReactNode
}

const VARIANTS: Record<ButtonVariant, { bg: string; text: string; border?: string }> = {
  primary:   { bg: '#1D4ED8', text: '#fff' },                                  // brand-700
  success:   { bg: '#059669', text: '#fff' },                                  // accent-600
  secondary: { bg: '#F1F5F9', text: '#1E293B' },                               // slate2-100 / slate2-800
  outline:   { bg: 'transparent', text: '#1D4ED8', border: '#1D4ED8' },
  ghost:     { bg: 'transparent', text: '#475569' },                           // slate2-600
  danger:    { bg: '#DC2626', text: '#fff' },
}

const SIZES: Record<ButtonSize, { paddingV: number; paddingH: number; fontSize: number; radius: number; iconGap: number }> = {
  sm: { paddingV: 7,  paddingH: 14, fontSize: 13, radius: 8,  iconGap: 6 },
  md: { paddingV: 10, paddingH: 20, fontSize: 14, radius: 10, iconGap: 7 },
  lg: { paddingV: 13, paddingH: 28, fontSize: 15, radius: 12, iconGap: 8 },
}

/**
 * Button — 6 variantes × 3 tamanhos, alinhado ao guia (seção 04 — Botões).
 * Aceita ícones nos dois lados, estado de loading com spinner e fullWidth.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  disabled,
  children,
  style,
  ...rest
}: ButtonProps) {
  const v = VARIANTS[variant]
  const s = SIZES[size]
  const isDisabled = disabled || loading

  return (
    <TouchableOpacity
      disabled={isDisabled}
      activeOpacity={0.85}
      style={[
        {
          backgroundColor: v.bg,
          borderRadius: s.radius,
          paddingVertical: s.paddingV,
          paddingHorizontal: s.paddingH,
          borderWidth: v.border ? 2 : 0,
          borderColor: v.border,
          opacity: isDisabled ? 0.55 : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
        style,
      ]}
      {...rest}
    >
      <View
        className="flex-row items-center justify-center"
        style={{ gap: s.iconGap }}
      >
        {loading && <ActivityIndicator color={v.text} size="small" />}
        {!loading && leftIcon}
        <Text
          className="font-display-bold"
          style={{ fontSize: s.fontSize, color: v.text }}
          numberOfLines={1}
        >
          {children}
        </Text>
        {!loading && rightIcon}
      </View>
    </TouchableOpacity>
  )
}
