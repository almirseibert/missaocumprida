import { Tabs, router } from 'expo-router'
import { useEffect } from 'react'
import { View } from 'react-native'
import { Home, ListOrdered, Calendar, User, Briefcase } from 'lucide-react-native'
import { useAuthStore } from '../../src/store/auth'
import { TermsModal } from '../../src/components/TermsModal'
import { GlassBottomNav } from '../../src/components/GlassBottomNav'
import {
  configureNotifications,
  startNotificationPolling,
  stopNotificationPolling,
} from '../../src/lib/notifications'

export default function AppLayout() {
  const { user } = useAuthStore()

  useEffect(() => {
    if (!user) {
      router.replace('/(auth)/login')
      return
    }
    // Redireciona para onboarding se não concluído
    const state = (user.onboarding_state ?? {}) as any
    const isProv = user.role === 'PROVIDER' || user.role === 'BOTH'
    const isCli = user.role === 'CLIENT' || user.role === 'BOTH'
    if (isProv && !state.provider?.completed) {
      router.replace('/(onboarding)/comecar-prestador' as any)
      return
    }
    if (isCli && !state.client?.completed) {
      router.replace('/(onboarding)/comecar-cliente' as any)
      return
    }
    let cancelled = false
    ;(async () => {
      const granted = await configureNotifications()
      if (cancelled) return
      if (granted) startNotificationPolling(20000)
    })()
    return () => {
      cancelled = true
      stopNotificationPolling()
    }
  }, [user])

  if (!user) return null

  const isProvider = user.role === 'PROVIDER' || user.role === 'BOTH'
  const isClient = user.role === 'CLIENT' || user.role === 'BOTH' || user.role === 'ADMIN'

  return (
    <View style={{ flex: 1 }}>
    <Tabs
      tabBar={(props) => <GlassBottomNav {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Início',
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="meus-pedidos"
        options={{
          title: 'Pedidos',
          tabBarIcon: ({ color, size }) => <ListOrdered color={color} size={size} />,
          href: isClient ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="feed"
        options={{
          title: 'Feed',
          tabBarIcon: ({ color, size }) => <Briefcase color={color} size={size} />,
          href: isProvider ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="agendamentos"
        options={{
          title: 'Agenda',
          tabBarIcon: ({ color, size }) => <Calendar color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
      {/* Telas sem tab */}
      <Tabs.Screen name="pedido/[id]" options={{ href: null }} />
      <Tabs.Screen name="pedido/novo/[slug]" options={{ href: null }} />
      <Tabs.Screen name="agendamento/[id]" options={{ href: null }} />
      <Tabs.Screen name="carteira" options={{ href: null }} />
      <Tabs.Screen name="verificacao" options={{ href: null }} />
      <Tabs.Screen name="pagamento/[orderId]" options={{ href: null }} />
      <Tabs.Screen name="suporte/index" options={{ href: null }} />
      <Tabs.Screen name="suporte/[id]" options={{ href: null }} />
    </Tabs>
    <TermsModal />
    </View>
  )
}
