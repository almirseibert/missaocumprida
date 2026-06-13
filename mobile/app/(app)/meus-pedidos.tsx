import { useState, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useFocusEffect } from 'expo-router'
import { api } from '../../src/lib/api'
import { Order } from '../../src/types'
import { formatCurrency, formatDateShort } from '../../src/lib/utils'
import { Badge, Button, ORDER_STATUS_BADGE } from '../../src/components/ui'

export default function MeusPedidosScreen() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function load() {
    try {
      const r = await api.get('/orders')
      const d = r.data.data
      setOrders(Array.isArray(d) ? d : (d?.orders ?? []))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useFocusEffect(useCallback(() => { load() }, []))

  if (loading) return <ActivityIndicator className="flex-1 mt-20" color="#1D4ED8" />

  return (
    <SafeAreaView className="flex-1 bg-slate2-50" edges={['bottom']}>
      <View className="px-5 pt-6 pb-4">
        <Text className="font-display-extrabold text-2xl text-slate2-900">
          Meus Pedidos
        </Text>
      </View>
      <FlatList
        data={orders}
        keyExtractor={o => o.id}
        contentContainerClassName="px-5 gap-3 pb-6"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} />}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => router.push(`/(app)/pedido/${item.id}`)}
            activeOpacity={0.85}
            className="bg-white rounded-2xl p-4 border border-slate2-200"
          >
            <View className="flex-row justify-between items-start">
              <Text
                className="font-display-bold text-slate2-900 flex-1 mr-2"
                numberOfLines={2}
              >
                {item.title}
              </Text>
              {(() => {
                const b = ORDER_STATUS_BADGE[item.status]
                return b ? <Badge variant={b.variant}>{b.label}</Badge> : null
              })()}
            </View>
            <View className="flex-row justify-between mt-3">
              <Text className="font-sans text-sm text-slate2-500">
                {item.desired_date ? formatDateShort(item.desired_date) : '—'}
              </Text>
              {item.client_total && (
                <Text className="font-display-semibold text-sm text-brand-700">
                  {formatCurrency(item.client_total)}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View className="items-center mt-20">
            <Text className="text-5xl mb-4">📋</Text>
            <Text className="font-sans text-slate2-500 text-base">
              Nenhum pedido ainda
            </Text>
            <View className="mt-4">
              <Button variant="primary" size="md" onPress={() => router.push('/(app)/home')}>
                Contratar serviço
              </Button>
            </View>
          </View>
        }
      />
    </SafeAreaView>
  )
}
