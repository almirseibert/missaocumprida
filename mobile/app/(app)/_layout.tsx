import { Tabs, router } from 'expo-router'
import { useEffect } from 'react'
import { Home, ListOrdered, Calendar, User, Briefcase } from 'lucide-react-native'
import { useAuthStore } from '../../src/store/auth'

export default function AppLayout() {
  const { user } = useAuthStore()

  useEffect(() => {
    if (!user) router.replace('/(auth)/login')
  }, [user])

  if (!user) return null

  const isProvider = user.role === 'PROVIDER' || user.role === 'BOTH'

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarStyle: { borderTopColor: '#e5e7eb', paddingBottom: 4 },
        tabBarLabelStyle: { fontSize: 11 },
      }}
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
        }}
      />
      {isProvider && (
        <Tabs.Screen
          name="feed"
          options={{
            title: 'Feed',
            tabBarIcon: ({ color, size }) => <Briefcase color={color} size={size} />,
          }}
        />
      )}
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
    </Tabs>
  )
}
