import { memo, useCallback, useEffect, useState } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, ScrollView,
  TextInput, ActivityIndicator, RefreshControl,
} from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { Search, ChevronDown, ShieldCheck } from 'lucide-react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { api } from '../../src/lib/api'
import { useAuthStore } from '../../src/store/auth'
import { ServiceGroup, Category, Order, Schedule } from '../../src/types'
import { formatCurrency, formatDate } from '../../src/lib/utils'
import {
  CategoryCard, StatCell, OrderFeedCard,
} from '../../src/components/ui'

export default function HomeScreen() {
  const { user } = useAuthStore()
  if (!user) return null
  if (user.role === 'PROVIDER') return <ProviderHome />
  return <ClientHome />
}

// =============================================================================
// VISÃO CLIENTE — Tela 01 do Telas Mobile.html
// =============================================================================
type RecentProvider = {
  provider: { id: string; name: string; avatar?: string | null; is_verified_pro?: boolean }
  last_category: { name: string; slug: string; icon: string } | null
}

function ClientHome() {
  const { user } = useAuthStore()
  const [groups, setGroups] = useState<ServiceGroup[]>([])
  const [activeSchedule, setActiveSchedule] = useState<Schedule | null>(null)
  const [recents, setRecents] = useState<RecentProvider[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})

  function toggleGroup(id: string) {
    setOpenGroups((prev) => {
      const next = { ...prev, [id]: !prev[id] }
      AsyncStorage.setItem('@mc:home-open-groups', JSON.stringify(next)).catch(() => {})
      return next
    })
  }

  useEffect(() => {
    AsyncStorage.getItem('@mc:home-open-groups')
      .then((raw) => raw && setOpenGroups(JSON.parse(raw)))
      .catch(() => {})
  }, [])

  async function load() {
    try {
      const [groupsRes, schedRes, recentsRes] = await Promise.all([
        api.get('/categories/groups'),
        api.get('/schedules').catch(() => ({ data: { data: [] } })),
        api.get('/recommendations/recent-providers').catch(() => ({ data: { data: [] } })),
      ])
      setGroups(groupsRes.data.data ?? [])
      const schedules: Schedule[] = schedRes.data.data ?? []
      const upcoming = schedules.find(
        (s) => s.status === 'CONFIRMED' || s.status === 'IN_PROGRESS',
      )
      setActiveSchedule(upcoming ?? null)
      setRecents(recentsRes.data?.data ?? [])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useFocusEffect(useCallback(() => { load() }, []))

  const filteredCats: Category[] | null = search.trim()
    ? groups.flatMap((g) => g.categories).filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase()),
      )
    : null

  return (
    <View className="flex-1 bg-slate2-50">
      <ScrollView
        contentContainerClassName="p-4 pb-8"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} />}
      >
        {/* Greeting */}
        <View className="mb-3.5">
          <Text className="font-display-extrabold text-[20px] text-slate2-900">
            Olá, {user?.name.split(' ')[0]}!
          </Text>
          <Text className="font-sans text-[13px] text-slate2-500 mt-0.5">
            O que você precisa hoje?
          </Text>
        </View>

        {/* Search */}
        <View className="relative mb-4">
          <View className="absolute left-3 top-0 bottom-0 justify-center z-10">
            <Search size={16} color="#94A3B8" />
          </View>
          <TextInput
            className="bg-white border-[1.5px] border-slate2-200 rounded-xl py-3 pl-10 pr-3 text-[13px] text-slate2-900 font-sans"
            placeholder="Buscar serviço (limpeza, elétrica…)"
            placeholderTextColor="#94A3B8"
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {/* Active order banner — cor sólida brand-800 (mockup tinha gradient
            brand-800→brand-700; expo-linear-gradient não está instalado) */}
        {activeSchedule && !search && (
          <TouchableOpacity
            onPress={() => router.push(`/(app)/agendamento/${activeSchedule.id}`)}
            activeOpacity={0.85}
            className="bg-brand-800 rounded-[14px] p-4 mb-[18px]"
          >
            <Text className="font-display-bold text-[9px] uppercase tracking-wider text-white/55 mb-1">
              Pedido em andamento
            </Text>
            <Text className="font-display-bold text-[14px] text-white mb-2">
              {activeSchedule.order?.title ?? 'Serviço agendado'}
              {' · '}
              {formatDate(activeSchedule.scheduled_at)}
            </Text>
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-1.5">
                <View className="w-[22px] h-[22px] rounded-full bg-white/20 items-center justify-center">
                  <Text className="font-display-bold text-[9px] text-white">
                    {(activeSchedule.provider?.name ?? '?').slice(0, 2).toUpperCase()}
                  </Text>
                </View>
                <Text className="font-sans text-[12px] text-white/80">
                  {activeSchedule.provider?.name ?? 'Prestador'}
                </Text>
              </View>
              <View className="bg-white/15 rounded-full px-2.5 py-0.5">
                <Text className="font-display-bold text-[10px] text-white">
                  {activeSchedule.status === 'IN_PROGRESS' ? 'Em andamento' : 'Agendado'}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        )}

        {/* Voltar a contratar — top 3 prestadores recentes */}
        {!search && recents.length > 0 && (
          <View className="mb-4">
            <Text className="font-display-bold text-[14px] text-slate2-900 mb-2">
              Voltar a contratar
            </Text>
            <View className="gap-2">
              {recents.map((r) => (
                <TouchableOpacity
                  key={r.provider.id}
                  onPress={() =>
                    r.last_category
                      ? router.push(`/(app)/pedido/novo/${r.last_category.slug}` as any)
                      : router.push('/(app)/pacotes' as any)
                  }
                  activeOpacity={0.85}
                  className="flex-row items-center gap-3 bg-white border border-slate2-200 rounded-2xl p-3"
                >
                  <View className="w-10 h-10 rounded-full bg-brand-100 items-center justify-center">
                    <Text className="font-display-bold text-[12px] text-brand-700">
                      {(r.provider.name ?? '?').slice(0, 1).toUpperCase()}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center gap-1">
                      <Text className="font-display-bold text-[13px] text-slate2-900" numberOfLines={1}>
                        {r.provider.name}
                      </Text>
                      {r.provider.is_verified_pro && (
                        <ShieldCheck size={12} color="#2563EB" fill="#2563EB" />
                      )}
                    </View>
                    {r.last_category && (
                      <Text className="font-sans text-[11px] text-slate2-500" numberOfLines={1}>
                        {r.last_category.icon} {r.last_category.name}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Categorias — busca ou agrupadas */}
        {filteredCats ? (
          <View className="gap-2.5">
            {filteredCats.length === 0 ? (
              <Text className="font-sans text-center text-slate2-400 mt-6">
                Nenhum serviço encontrado
              </Text>
            ) : (
              <CategoryGrid cats={filteredCats} />
            )}
          </View>
        ) : loading ? (
          <ActivityIndicator className="mt-8" color="#1D4ED8" />
        ) : (
          <View className="gap-2.5">
            {groups.map((group) => {
              const isOpen = !!openGroups[group.id]
              return (
                <View key={group.id} className="bg-white border border-slate2-200 rounded-2xl overflow-hidden">
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => toggleGroup(group.id)}
                    className="flex-row items-center gap-3 p-4"
                  >
                    <Text className="text-[22px]">{group.icon}</Text>
                    <View className="flex-1">
                      <Text className="font-display-bold text-[14px] text-slate2-900">
                        {group.name}
                      </Text>
                      <Text className="font-sans text-[11px] text-slate2-500 mt-0.5">
                        {group.categories.length} serviço{group.categories.length === 1 ? '' : 's'}
                      </Text>
                    </View>
                    <ChevronDown
                      size={18}
                      color="#94A3B8"
                      style={{ transform: [{ rotate: isOpen ? '180deg' : '0deg' }] }}
                    />
                  </TouchableOpacity>
                  {isOpen && (
                    <View className="px-4 pb-4 pt-1 border-t border-slate2-100">
                      <View className="mt-3">
                        <CategoryGrid cats={group.categories} />
                      </View>
                    </View>
                  )}
                </View>
              )
            })}
          </View>
        )}
      </ScrollView>
    </View>
  )
}

// Grid 2×2 que envolve N CategoryCards (largura 48.5%, gap 10).
const CategoryGrid = memo(function CategoryGrid({ cats }: { cats: Category[] }) {
  return (
    <View className="flex-row flex-wrap" style={{ gap: 10 }}>
      {cats.map((c) => (
        <View key={c.id} style={{ width: '48.5%' }}>
          <CategoryCard
            icon={c.icon}
            name={c.name}
            basePriceMin={c.base_price_min}
            onPress={() => router.push(`/(app)/pedido/novo/${c.slug}` as any)}
          />
        </View>
      ))}
    </View>
  )
})

// =============================================================================
// VISÃO PRESTADOR — Tela 03 (Feed Prestador) das Telas Mobile.html
// =============================================================================
function ProviderHome() {
  const { user } = useAuthStore()
  const [orders, setOrders] = useState<Order[]>([])
  const [providerHasLocation, setProviderHasLocation] = useState(false)
  const [proposalsCount, setProposalsCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function load() {
    try {
      const [feedRes, proposalsRes] = await Promise.all([
        api.get('/orders/feed', { params: { page: 1, limit: 20 } }),
        api.get('/proposals/mine').catch(() => ({ data: { data: [] } })),
      ])
      const d = feedRes.data.data
      setOrders(d?.orders ?? [])
      setProviderHasLocation(!!d?.provider_has_location)
      setProposalsCount(proposalsRes.data?.data?.length ?? null)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useFocusEffect(useCallback(() => { load() }, []))

  if (loading) return <ActivityIndicator className="flex-1 mt-20" color="#1D4ED8" />

  const balance = user?.provider_balance ?? 0
  const rating = (user?.rating_avg ?? 0).toFixed(1)

  return (
    <View className="flex-1 bg-slate2-50">
      {/* Header brand-700 */}
      <View className="bg-brand-700 px-4 pt-4 pb-4">
        <Text className="font-display-extrabold text-[17px] text-white">
          Olá, {user?.name.split(' ')[0]}!
        </Text>
        <Text className="font-sans text-[12px] text-white/70 mt-0.5">
          {orders.length} pedido{orders.length === 1 ? '' : 's'} disponíve{orders.length === 1 ? 'l' : 'is'} na sua área
        </Text>
      </View>

      {/* Stats strip */}
      <View className="flex-row bg-white border-b border-slate2-100 px-3.5 pt-3.5 pb-1.5">
        <StatCell icon="💰" value={formatCurrency(balance)} label="Saldo" onPress={() => router.push('/(app)/carteira')} />
        <StatCell icon="📋" value={proposalsCount?.toString() ?? '—'} label="Propostas" onPress={() => router.push('/(app)/minhas-propostas' as any)} />
        <StatCell icon="⭐" value={rating} label="Avaliação" />
      </View>

      {!providerHasLocation && (
        <View className="mx-3.5 mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3 flex-row items-center gap-2">
          <Text className="text-amber-600 text-base">⚠️</Text>
          <Text className="font-sans text-xs text-amber-800 flex-1">
            Cadastre sua localização no perfil para receber pedidos próximos.
          </Text>
          <TouchableOpacity onPress={() => router.push('/(app)/perfil')}>
            <Text className="font-display-bold text-xs text-amber-900 underline">
              Perfil
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        contentContainerClassName="px-3.5 pt-3 pb-6 gap-2.5"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} />}
        renderItem={({ item }) => (
          <OrderFeedCard
            order={item}
            onPress={() => router.push(`/(app)/pedido/${item.id}`)}
          />
        )}
        ListEmptyComponent={
          <View className="items-center mt-14 px-6">
            <Text className="text-5xl mb-3">📭</Text>
            <Text className="font-display-bold text-base text-slate2-800 text-center">
              Nenhum pedido aberto agora
            </Text>
            <Text className="font-sans text-[13px] text-slate2-500 text-center mt-1">
              Cadastre mais habilidades ou aumente seu raio
            </Text>
          </View>
        }
      />
    </View>
  )
}
