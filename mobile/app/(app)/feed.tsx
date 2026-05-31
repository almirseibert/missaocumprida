import { useCallback, useState } from 'react'
import {
  View, Text, FlatList, TouchableOpacity,
  ActivityIndicator, SafeAreaView, RefreshControl, Alert,
} from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { api, getApiError } from '../../src/lib/api'
import { Order } from '../../src/types'
import { formatCurrency, formatDateShort } from '../../src/lib/utils'

export default function FeedScreen() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function load() {
    try {
      const r = await api.get('/orders/feed')
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
        <Text className="text-2xl font-bold text-gray-800">Feed de Pedidos</Text>
        <Text className="text-gray-500 text-sm mt-1">Pedidos próximos às suas habilidades</Text>
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
              {item.distance_km != null && (
                <Text className="text-xs text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded-full">
                  {item.distance_km.toFixed(1)} km
                </Text>
              )}
            </View>

            {item.category && (
              <Text className="text-xs text-gray-400 mt-1">
                {item.category.icon} {item.category.name}
              </Text>
            )}

            <View className="flex-row justify-between items-center mt-3">
              <Text className="text-sm text-gray-500">
                {item.desired_date ? '📅 ' + formatDateShort(item.desired_date) : '📅 A combinar'}
              </Text>
              <Text className="text-sm font-bold text-green-600">
                {item.estimated_price_min
                  ? formatCurrency(item.estimated_price_min) + '+'
                  : 'Ver proposta'}
              </Text>
            </View>

            {item.address && (
              <Text className="text-xs text-gray-400 mt-1.5" numberOfLines={1}>
                📍 {item.address}{item.city ? `, ${item.city}` : ''}
              </Text>
            )}

            <TouchableOpacity
              onPress={() => enviarProposta(item.id)}
              className="mt-3 bg-green-600 rounded-xl py-2.5 items-center"
            >
              <Text className="text-white font-semibold text-sm">Enviar Proposta</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View className="items-center mt-20">
            <Text className="text-5xl mb-4">🔍</Text>
            <Text className="text-gray-500 text-base text-center">
              Nenhum pedido disponível{'\n'}nas suas categorias de atendimento
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  )

  function enviarProposta(orderId: string) {
    Alert.prompt(
      'Enviar Proposta',
      'Informe o valor (R$) e uma mensagem',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Enviar',
          onPress: async (input) => {
            if (!input) return
            const [valor, ...msgParts] = input.split(' ')
            const value = parseFloat(valor.replace(',', '.'))
            const message = msgParts.join(' ') || 'Tenho disponibilidade para realizar este serviço.'
            if (isNaN(value) || value <= 0) {
              Alert.alert('Valor inválido', 'Informe o valor no início (ex: 150 Faço o serviço...)')
              return
            }
            try {
              await api.post(`/orders/${orderId}/proposals`, { value, message })
              Alert.alert('Proposta enviada!', 'O cliente receberá sua proposta em breve.')
              load()
            } catch (err) {
              Alert.alert('Erro', getApiError(err))
            }
          },
        },
      ],
      'plain-text',
      '',
      'numeric'
    )
  }
}
