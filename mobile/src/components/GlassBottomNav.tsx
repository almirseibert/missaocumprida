import { View, Text, TouchableOpacity, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Home, ListOrdered, Calendar, User, Briefcase, LifeBuoy, ShieldCheck } from 'lucide-react-native'
import type { ComponentType } from 'react'

interface ItemProps {
  active: boolean
  label: string
  Icon: ComponentType<{ size?: number; color?: string }>
  onPress: () => void
}

function Item({ active, label, Icon, onPress }: ItemProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        flex: 1,
        paddingVertical: 8,
        paddingHorizontal: 4,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: active ? 'rgba(237,237,237,0.7)' : 'transparent',
      }}
    >
      <Icon size={22} color={active ? '#0A65DE' : 'rgba(255,255,255,0.95)'} />
      <Text
        numberOfLines={1}
        style={{
          fontSize: 11,
          fontWeight: '600',
          marginTop: 3,
          color: active ? '#0A65DE' : 'rgba(255,255,255,0.95)',
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  )
}

/**
 * Bottom nav inspirada na pill glass do guia do projeto.
 * RN não tem backdrop-filter; usamos azul translúcido + sombras que aproximam o efeito.
 * Para blur real, adicionar `expo-blur` e envelopar em <BlurView>.
 */
export function GlassBottomNav({
  state,
  descriptors,
  navigation,
}: any) {
  const insets = useSafeAreaInsets()

  // Filtra rotas que não devem aparecer (href:null nas options das Tabs)
  const visible = state.routes
    .map((route: any, index: number) => ({ route, index }))
    .filter(({ route }: any) => {
      const opts = descriptors[route.key]?.options ?? {}
      return opts.href !== null && opts.tabBarButton !== null
    })

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: Math.max(12, insets.bottom + 4),
        alignItems: 'center',
        zIndex: 50,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          gap: 6,
          padding: 8,
          borderRadius: 999,
          width: '95%',
          maxWidth: 520,
          backgroundColor: 'rgba(10, 101, 222, 0.85)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.5)',
          shadowColor: '#000',
          shadowOpacity: 0.18,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 8 },
          elevation: 12,
        }}
      >
        {visible.map(({ route, index }: any) => {
          const { options } = descriptors[route.key]
          const label = options.title ?? route.name
          const isActive = state.index === index
          const Icon = options.tabBarIconComponent || iconFor(route.name)
          return (
            <Item
              key={route.key}
              active={isActive}
              label={label}
              Icon={Icon}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                })
                if (!isActive && !event.defaultPrevented) {
                  navigation.navigate(route.name)
                }
              }}
            />
          )
        })}
      </View>
    </View>
  )
}

// Fallback caso a tela não declare tabBarIconComponent: mapeamos pelo nome.
function iconFor(name: string): ComponentType<{ size?: number; color?: string }> {
  switch (name) {
    case 'home': return Home
    case 'meus-pedidos': return ListOrdered
    case 'feed': return Briefcase
    case 'agendamentos': return Calendar
    case 'perfil': return User
    case 'suporte/index': return LifeBuoy
    default: return ShieldCheck
  }
}
