import { useCallback, useState } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, Modal,
  ActivityIndicator, RefreshControl, Alert, TextInput,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useFocusEffect } from 'expo-router'
import { api, getApiError } from '../../src/lib/api'
import { Order } from '../../src/types'
import { formatCurrency, formatDateShort } from '../../src/lib/utils'

export default function FeedScreen() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [propostaVisible, setPropostaVisible] = useState(false)
  const [propostaOrderId, setPropostaOrderId] = useState('')
  const [propostaValor, setPropostaValor] = useState('')
  const [propostaMensagem, setPropostaMensagem] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function load() {
    try {
      const r = await api.get('/orders/feed')
      // O backend retorna { orders, total, ... } — aceita também array direto
      const d = r.data.data
      setOrders(Array.isArray(d) ? d : (d?.orders ?? []))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useFocusEffect(useCallback(() => { load() }, []))

  async function confirmarProposta() {
    const value = parseFloat(propostaValor.replace(',', '.'))
    if (isNaN(value) || value <= 0) { Alert.alert('Valor inválido'); return }
    setEnviando(true)
    try {
      await api.post(`/orders/${propostaOrderId}/proposals`, {
        value,
        message: propostaMensagem || 'Tenho disponibilidade para realizar este serviço.',
      })
      setPropostaVisible(false)
      setPropostaValor('')
      setPropostaMensagem('')
      Alert.alert('Proposta enviada!', 'O cliente receberá sua proposta em breve.')
      load()
    } catch (err) {
      Alert.alert('Erro', getApiError(err))
    } finally {
      setEnviando(false)
    }
  }

  function enviarProposta(orderId: string) {
    setPropostaOrderId(orderId)
    setPropostaVisible(true)
  }

  if (loading) return <ActivityIndicator className="flex-1 mt-20" color="#2563eb" />

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <Modal visible={propostaVisible} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-white rounded-t-2xl p-6 gap-4">
            <Text className="text-lg font-bold text-gray-800">Enviar Proposta</Text>
            <View>
              <Text className="text-sm text-gray-500 mb-1">Valor (R$)</Text>
              <TextInput
                className="border border-gray-200 rounded-xl px-3 py-2.5 text-gray-800"
                placeholder="Ex: 150,00"
                keyboardType="decimal-pad"
                value={propostaValor}
                onChangeText={setPropostaValor}
              />
            </View>
            <View>
              <Text className="text-sm text-gray-500 mb-1">Mensagem (opcional)</Text>
              <TextInput
                className="border border-gray-200 rounded-xl px-3 py-2.5 text-gray-800"
                placeholder="Descreva sua proposta…"
                multiline
                numberOfLines={3}
                value={propostaMensagem}
                onChangeText={setPropostaMensagem}
              />
            </View>
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => { setPropostaVisible(false); setPropostaValor(''); setPropostaMensagem('') }}
                className="flex-1 border border-gray-300 rounded-xl py-3 items-center"
              >
                <Text className="text-gray-600">Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmarProposta}
                disabled={enviando}
                className={`flex-1 rounded-xl py-3 items-center ${enviando ? 'bg-green-400' : 'bg-green-600'}`}
              >
                <Text className="text-white font-semibold">{enviando ? 'Enviando…' : 'Enviar'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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

}
