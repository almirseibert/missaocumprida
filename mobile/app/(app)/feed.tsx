import { useCallback, useState } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, Modal,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useFocusEffect } from 'expo-router'
import { api, getApiError } from '../../src/lib/api'
import { Order } from '../../src/types'
import { formatCurrency, formatDateShort } from '../../src/lib/utils'
import { Button, Input } from '../../src/components/ui'

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

  if (loading) return <ActivityIndicator className="flex-1 mt-20" color="#1D4ED8" />

  return (
    <SafeAreaView className="flex-1 bg-slate2-50">
      <Modal visible={propostaVisible} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-white rounded-t-2xl p-6 gap-4">
            <Text className="font-display-bold text-lg text-slate2-900">
              Enviar Proposta
            </Text>
            <Input
              label="Valor (R$)"
              placeholder="Ex: 150,00"
              keyboardType="decimal-pad"
              value={propostaValor}
              onChangeText={setPropostaValor}
            />
            <Input
              label="Mensagem (opcional)"
              placeholder="Descreva sua proposta…"
              multiline
              numberOfLines={3}
              value={propostaMensagem}
              onChangeText={setPropostaMensagem}
            />
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Button
                  variant="secondary"
                  size="md"
                  fullWidth
                  onPress={() => { setPropostaVisible(false); setPropostaValor(''); setPropostaMensagem('') }}
                >
                  Cancelar
                </Button>
              </View>
              <View className="flex-1">
                <Button
                  variant="success"
                  size="md"
                  fullWidth
                  loading={enviando}
                  onPress={confirmarProposta}
                >
                  {enviando ? 'Enviando…' : '✓ Enviar'}
                </Button>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <View className="px-5 pt-6 pb-4">
        <Text className="font-display-extrabold text-2xl text-slate2-900">
          Feed de Pedidos
        </Text>
        <Text className="font-sans text-slate2-500 text-sm mt-1">
          Pedidos próximos às suas habilidades
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
            className={`rounded-2xl p-4 border-2 ${(item as any).is_urgent ? 'bg-rose-50 border-rose-500' : 'bg-white border-slate2-200'}`}
          >
            {(item as any).is_urgent && (
              <View className="flex-row items-center mb-2">
                <Text className="text-[10px] font-bold bg-rose-600 text-white px-2 py-1 rounded-full">
                  🚨 URGENTE
                </Text>
              </View>
            )}
            <View className="flex-row justify-between items-start">
              <Text
                className="font-display-bold text-slate2-900 flex-1 mr-2"
                numberOfLines={2}
              >
                {item.title}
              </Text>
              {item.distance_km != null && (
                <Text className="font-sans-semibold text-xs text-brand-700 bg-brand-50 px-2.5 py-1 rounded-full">
                  {item.distance_km.toFixed(1)} km
                </Text>
              )}
            </View>

            {item.category && (
              <Text className="font-sans text-xs text-slate2-400 mt-1">
                {item.category.icon} {item.category.name}
              </Text>
            )}

            <View className="flex-row justify-between items-center mt-3">
              <Text className="font-sans text-sm text-slate2-500">
                {item.desired_date ? '📅 ' + formatDateShort(item.desired_date) : '📅 A combinar'}
              </Text>
              <Text className="font-display-extrabold text-sm text-accent-600">
                {item.estimated_price_min
                  ? formatCurrency(item.estimated_price_min) + '+'
                  : 'Ver proposta'}
              </Text>
            </View>

            {item.address && (
              <Text
                className="font-sans text-xs text-slate2-400 mt-1.5"
                numberOfLines={1}
              >
                📍 {item.address}{item.city ? `, ${item.city}` : ''}
              </Text>
            )}

            <View className="mt-3">
              <Button variant="primary" size="sm" fullWidth onPress={() => enviarProposta(item.id)}>
                Enviar Proposta
              </Button>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View className="items-center mt-20">
            <Text className="text-5xl mb-4">🔍</Text>
            <Text className="font-sans text-slate2-500 text-base text-center">
              Nenhum pedido disponível{'\n'}nas suas categorias de atendimento
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  )
}
