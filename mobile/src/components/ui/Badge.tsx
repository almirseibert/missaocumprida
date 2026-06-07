import { View, Text } from 'react-native'

export type BadgeVariant =
  | 'blue'    // padrão / em propostas
  | 'green'   // sucesso / concluído
  | 'amber'   // atenção / agendado
  | 'red'     // erro / cancelado
  | 'gray'    // neutro / aberto
  | 'purple'  // aceito
  | 'fuchsia' // em andamento

interface BadgeProps {
  variant?: BadgeVariant
  children: React.ReactNode
  size?: 'sm' | 'md'
  withDot?: boolean
}

// Mapa de cores derivado dos tokens semânticos do guia de Identidade Visual.
// Cada variante: fundo claro + texto escuro de mesma matiz, com ponto opcional
// antes do texto (mesma cor do texto com 70% de opacidade).
const VARIANTS: Record<BadgeVariant, { bg: string; text: string }> = {
  blue:    { bg: '#DBEAFE', text: '#1D4ED8' }, // brand-100 / brand-700
  green:   { bg: '#D1FAE5', text: '#047857' }, // accent-100 / accent-700
  amber:   { bg: '#FEF3C7', text: '#92400E' },
  red:     { bg: '#FEF2F2', text: '#DC2626' },
  gray:    { bg: '#F1F5F9', text: '#475569' }, // slate2-100 / slate2-600
  purple:  { bg: '#EDE9FE', text: '#5B21B6' },
  fuchsia: { bg: '#FDF4FF', text: '#86198F' },
}

export function Badge({
  variant = 'blue',
  children,
  size = 'sm',
  withDot = true,
}: BadgeProps) {
  const { bg, text } = VARIANTS[variant]
  const dotSize = size === 'md' ? 6 : 5
  const fontSize = size === 'md' ? 12 : 11
  const paddingV = size === 'md' ? 3 : 2
  const paddingH = size === 'md' ? 11 : 10

  return (
    <View
      className="self-start flex-row items-center rounded-full"
      style={{
        backgroundColor: bg,
        paddingVertical: paddingV,
        paddingHorizontal: paddingH,
        gap: 5,
      }}
    >
      {withDot && (
        <View
          style={{
            width: dotSize,
            height: dotSize,
            borderRadius: dotSize / 2,
            backgroundColor: text,
            opacity: 0.7,
          }}
        />
      )}
      <Text
        className="font-sans-semibold"
        style={{ fontSize, color: text }}
      >
        {children}
      </Text>
    </View>
  )
}

// Mapeamento conveniente: status do pedido/agendamento → variante.
export const ORDER_STATUS_BADGE: Record<string, { variant: BadgeVariant; label: string }> = {
  OPEN:        { variant: 'gray',    label: 'Aberto' },
  IN_PROPOSAL: { variant: 'blue',    label: 'Em propostas' },
  ACCEPTED:    { variant: 'purple',  label: 'Aceito' },
  SCHEDULED:   { variant: 'amber',   label: 'Agendado' },
  IN_PROGRESS: { variant: 'fuchsia', label: 'Em andamento' },
  DONE:        { variant: 'green',   label: 'Concluído' },
  REVIEWED:    { variant: 'green',   label: 'Avaliado' },
  CANCELLED:   { variant: 'red',     label: 'Cancelado' },
  DISPUTED:    { variant: 'red',     label: 'Em disputa' },
}
