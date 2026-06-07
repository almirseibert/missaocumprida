import { View, Text, Image, ImageSourcePropType } from 'react-native'

interface AvatarProps {
  name?: string
  source?: ImageSourcePropType | { uri: string }
  size?: number
  /** par de cores para o gradiente; aplicado como gradiente CSS-like (apenas cor sólida no RN — usa a primeira) */
  gradient?: [string, string]
}

// Cores derivadas determinísticamente do nome (paleta acessível alinhada
// aos gradientes do guia: brand-600/accent-600, 7C3AED/DB2777, 0891B2/2563EB).
const PALETTE: Array<[string, string]> = [
  ['#1D4ED8', '#059669'], // brand → accent (default da identidade)
  ['#7C3AED', '#DB2777'], // violet → pink (Marcos no mockup)
  ['#0891B2', '#2563EB'], // cyan → brand (Ana no mockup)
  ['#0EA5E9', '#7C3AED'],
  ['#F59E0B', '#DC2626'],
]

function pickPalette(name: string): [string, string] {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return PALETTE[hash % PALETTE.length]
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map(p => p[0]?.toUpperCase() ?? '').join('') || '?'
}

export function Avatar({ name = '', source, size = 40, gradient }: AvatarProps) {
  if (source) {
    return (
      <Image
        source={source as ImageSourcePropType}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    )
  }
  const [c1] = gradient ?? pickPalette(name)
  // RN não tem gradiente nativo sem expo-linear-gradient; usamos a primeira
  // cor da paleta como fallback sólido. Para gradient real, usar LinearGradient
  // diretamente no consumidor.
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: c1,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          color: '#fff',
          fontSize: size * 0.36,
          fontFamily: 'PlusJakartaSans_700Bold',
        }}
      >
        {initials(name)}
      </Text>
    </View>
  )
}
