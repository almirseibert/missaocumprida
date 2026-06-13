import { Tabs, router } from 'expo-router'
import { useEffect } from 'react'
import { View } from 'react-native'
import { useAuthStore } from '../../src/store/auth'
import { TermsModal } from '../../src/components/TermsModal'
import { TopNav } from '../../src/components/TopNav'
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
      {/* Menu no topo da tela — TopNav decide sozinho quando aparecer */}
      <TopNav />
      <Tabs
        tabBar={() => null}
        screenOptions={{ headerShown: false }}
      >
        {/* ── Abas visíveis (whitelist espelhada no TopNav) ── */}
        <Tabs.Screen name="home" options={{ title: 'Início' }} />
        <Tabs.Screen
          name="meus-pedidos"
          options={{ title: 'Pedidos', href: isClient ? undefined : null }}
        />
        <Tabs.Screen
          name="feed"
          options={{ title: 'Feed', href: isProvider ? undefined : null }}
        />
        <Tabs.Screen name="agendamentos" options={{ title: 'Agenda' }} />
        <Tabs.Screen name="perfil" options={{ title: 'Perfil' }} />

        {/* ── Telas sem aba — TODA tela nova em (app)/ deve entrar aqui ── */}
        <Tabs.Screen name="pedido/[id]" options={{ href: null }} />
        <Tabs.Screen name="pedido/novo/[slug]" options={{ href: null }} />
        <Tabs.Screen name="agendamento/[id]" options={{ href: null }} />
        <Tabs.Screen name="carteira" options={{ href: null }} />
        <Tabs.Screen name="verificacao" options={{ href: null }} />
        <Tabs.Screen name="pagamento/[orderId]" options={{ href: null }} />
        <Tabs.Screen name="suporte/index" options={{ href: null }} />
        <Tabs.Screen name="suporte/[id]" options={{ href: null }} />
        <Tabs.Screen name="dashboard" options={{ href: null }} />
        <Tabs.Screen name="minhas-propostas" options={{ href: null }} />
        <Tabs.Screen name="assinaturas" options={{ href: null }} />
        <Tabs.Screen name="assinatura-nova" options={{ href: null }} />
        <Tabs.Screen name="agenda-config" options={{ href: null }} />
        <Tabs.Screen name="notificacoes-config" options={{ href: null }} />
        <Tabs.Screen name="indicar" options={{ href: null }} />
        <Tabs.Screen name="pacotes/index" options={{ href: null }} />
        <Tabs.Screen name="pacotes/[id]" options={{ href: null }} />
        <Tabs.Screen name="perfil-pacotes" options={{ href: null }} />
        <Tabs.Screen name="verificar-pro" options={{ href: null }} />
      </Tabs>
      <TermsModal />
    </View>
  )
}
