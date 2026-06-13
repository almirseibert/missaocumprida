import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router, usePathname } from 'expo-router'
import { Home, ListOrdered, Calendar, User, Briefcase, Bell } from 'lucide-react-native'
import type { ComponentType } from 'react'
import { api } from '../lib/api'
import { useAuthStore } from '../store/auth'
import { Logo } from './Logo'

interface TabDef {
  path: string
  label: string
  Icon: ComponentType<{ size?: number; color?: string }>
}

// Whitelist explícita: somente estas telas aparecem no menu.
// Qualquer tela nova em app/(app)/ NÃO entra aqui automaticamente —
// isso evita o bug antigo de telas extras empilhadas na navegação.
const TABS: TabDef[] = [
  { path: '/home',          label: 'Início',  Icon: Home },
  { path: '/meus-pedidos',  label: 'Pedidos', Icon: ListOrdered },
  { path: '/feed',          label: 'Feed',    Icon: Briefcase },
  { path: '/agendamentos',  label: 'Agenda',  Icon: Calendar },
  { path: '/perfil',        label: 'Perfil',  Icon: User },
]

/**
 * Menu superior do app — barra azul da marca (brand-700) com abas em pill;
 * a aba ativa fica em pílula branca. Substitui o GlassBottomNav (menu
 * inferior). Visível apenas nas telas raiz das abas; telas de detalhe
 * usam o próprio header com botão voltar.
 */
export function TopNav() {
  const insets = useSafeAreaInsets()
  const pathname = usePathname()
  const { user } = useAuthStore()
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    let active = true
    async function fetchUnread() {
      try {
        const r = await api.get('/notifications')
        if (active) setUnread(r.data?.data?.unread ?? 0)
      } catch { /* silencia — rede/auth */ }
    }
    fetchUnread()
    const t = setInterval(fetchUnread, 30000)
    return () => { active = false; clearInterval(t) }
  }, [])

  if (!user) return null

  const isProvider = user.role === 'PROVIDER' || user.role === 'BOTH'
  const isClient = user.role === 'CLIENT' || user.role === 'BOTH' || user.role === 'ADMIN'

  const tabs = TABS.filter((t) => {
    if (t.path === '/meus-pedidos') return isClient
    if (t.path === '/feed') return isProvider
    return true
  })

  // Telas de detalhe (pedido/[id], pagamento, etc.) não exibem o menu.
  if (!tabs.some((t) => t.path === pathname)) return null

  return (
    <View
      style={{
        paddingTop: insets.top,
        shadowColor: '#0F172A',
        shadowOpacity: 0.12,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6,
        zIndex: 50,
      }}
      className="bg-brand-700"
    >
      {/* Linha da marca */}
      <View className="flex-row items-center justify-between px-4 pt-2.5 pb-2">
        <View className="flex-row items-center gap-2">
          <Logo size={28} />
          <Text className="font-display-extrabold text-[15px] text-white">
            Missão Cumprida
          </Text>
        </View>
        <View className="w-9 h-9 rounded-full bg-white/15 items-center justify-center">
          <Bell size={17} color="#fff" />
          {unread > 0 && (
            <View className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-0.5 rounded-full bg-red-500 border-2 border-brand-700 items-center justify-center">
              <Text className="font-display-extrabold text-[8px] text-white">
                {unread > 9 ? '9+' : unread}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Abas */}
      <View className="flex-row px-2 pb-2 gap-1">
        {tabs.map(({ path, label, Icon }) => {
          const active = pathname === path
          return (
            <TouchableOpacity
              key={path}
              onPress={() => { if (!active) router.navigate(`/(app)${path}` as any) }}
              activeOpacity={0.8}
              className={`flex-1 flex-row items-center justify-center gap-1 py-2 rounded-xl ${active ? 'bg-white' : ''}`}
            >
              <Icon size={15} color={active ? '#1D4ED8' : '#BFDBFE'} />
              <Text
                numberOfLines={1}
                className={`text-[11px] ${active ? 'font-display-bold text-brand-700' : 'font-display-semibold text-brand-200'}`}
              >
                {label}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}
