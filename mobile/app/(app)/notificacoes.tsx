import { useCallback, useEffect, useState } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { ArrowLeft, Bell, CheckCheck } from 'lucide-react-native'
import { api } from '../../src/lib/api'
import { formatRelative } from '../../src/lib/utils'

interface Notif {
  id: string
  type: string
  title: string
  body: string
  data?: { order_id?: string; schedule_id?: string } | null
  read: boolean
  created_at: string
}

/** Caixa de entrada de notificações — aberta pelo sino do TopNav. */
export default function NotificacoesScreen() {
  const [items, setItems] = useState<Notif[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      const r = await api.get('/notifications')
      const d = r.data.data
      // Envelope aninhado: { notifications, unread } (ver AGENTS.md)
      setItems(Array.isArray(d) ? d : (d?.notifications ?? []))
    } catch {}
  }, [])

  useEffect(() => {
    load().finally(() => setLoading(false))
  }, [load])

  async function onRefresh() {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  async function markAllRead() {
    try {
      await api.patch('/notifications/read-all')
      setItems((prev) => prev.map((n) => ({ ...n, read: true })))
    } catch {}
  }

  async function openNotification(n: Notif) {
    if (!n.read) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)))
      api.patch(`/notifications/${n.id}/read`).catch(() => {})
    }
    if (n.data?.schedule_id) {
      router.push(`/(app)/agendamento/${n.data.schedule_id}`)
    } else if (n.data?.order_id) {
      router.push(`/(app)/pedido/${n.data.order_id}`)
    }
  }

  const unread = items.filter((n) => !n.read).length

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <View className="flex-row items-center px-4 py-3 bg-white border-b border-slate2-100 gap-3">
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ArrowLeft size={22} color="#334155" />
        </TouchableOpacity>
        <Text className="font-display-bold text-lg text-slate2-900 flex-1">Notificações</Text>
        {unread > 0 && (
          <TouchableOpacity
            onPress={markAllRead}
            accessibilityRole="button"
            accessibilityLabel="Marcar todas como lidas"
            className="flex-row items-center gap-1.5 bg-brand-50 rounded-full px-3 py-1.5"
          >
            <CheckCheck size={14} color="#047857" />
            <Text className="font-sans-semibold text-xs text-brand-700">Ler todas</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator className="flex-1 mt-20" color="#059669" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => n.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ padding: 16, gap: 8, flexGrow: 1 }}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center py-20">
              <Bell size={40} color="#94A3B8" />
              <Text className="font-display-bold text-slate2-700 mt-4">Nada por aqui</Text>
              <Text className="font-sans text-sm text-slate2-500 mt-1 text-center">
                Avisos sobre propostas, pagamentos e agendamentos aparecem aqui.
              </Text>
            </View>
          }
          renderItem={({ item: n }) => (
            <TouchableOpacity
              onPress={() => openNotification(n)}
              accessibilityRole="button"
              accessibilityLabel={`Notificação: ${n.title}`}
              className={`rounded-2xl p-4 border ${
                n.read ? 'bg-white border-slate2-200' : 'bg-brand-50 border-brand-100'
              }`}
            >
              <View className="flex-row items-start gap-2">
                {!n.read && <View className="w-2 h-2 rounded-full bg-brand-600 mt-1.5" />}
                <View className="flex-1">
                  <Text className="font-display-semibold text-sm text-slate2-900">{n.title}</Text>
                  <Text className="font-sans text-xs text-slate2-600 mt-0.5 leading-relaxed">
                    {n.body}
                  </Text>
                  <Text className="font-sans text-[10px] text-slate2-400 mt-1.5">
                    {formatRelative(n.created_at)}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  )
}
