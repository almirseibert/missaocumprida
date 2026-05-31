import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity,
  ActivityIndicator, SafeAreaView, RefreshControl,
} from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { api } from '../../src/lib/api'
import { Order } from '../../src/types'
import { formatCurrency, formatDateShort, ORDER_STATUS_LABEL, ORDER_STATUS_COLOR } from '../../src/lib/utils'

export default function MeusPedidosScreen() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function load() {
    try {
      const r = await api.get('/orders')
      setOrders(r.data.data || [])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useFocusEffect(useCallback(() => { load() }, []))

  if (loading) return <ActivityIndicator className="flex-1 mt-20" color="#2563eb" />

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="px-5 pt-6 pb-4">
        <Text className="text-2xl font-bold text-gray-800">Meus Pedidos</Text>
      </View>
      <FlatList
        data={orders}
        keyExtractor={o => o.id}
        contentContainerClassName="px-5 gap-3 pb-6"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} />}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => router.push(`/(app)/pedido/${item.id}`)}
            className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
          >
            <View className="flex-row justify-between items-start">
              <Text className="font-semibold text-gray-800 flex-1 mr-2" numberOfLines={2}>
                {item.title}
              </Text>
              <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: ORDER_STATUS_COLOR[item.status] + '20' }}>
                <Text className="text-xs font-medium" style={{ color: ORDER_STATUS_COLOR[item.status] }}>
                  {ORDER_STATUS_LABEL[item.status]}
                </Text>
              </View>
            </View>
            <View className="flex-row justify-between mt-3">
              <Text className="text-sm text-gray-500">
                {item.desired_date ? formatDateShort(item.desired_date) : '—'}
              </Text>
              {item.client_total && (
                <Text className="text-sm font-semibold text-blue-600">
                  {formatCurrency(item.client_total)}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View className="items-center mt-20">
            <Text className="text-5xl mb-4">📋</Text>
            <Text className="text-gray-500 text-base">Nenhum pedido ainda</Text>
            <TouchableOpacity
              onPress={() => router.push('/(app)/home')}
              className="mt-4 bg-blue-600 rounded-xl px-6 py-3"
            >
              <Text className="text-white font-semibold">Contratar serviço</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </SafeAreaView>
  )
}
