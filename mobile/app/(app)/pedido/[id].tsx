import { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, SafeAreaView,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { ArrowLeft } from 'lucide-react-native'
import { api, getApiError } from '../../../src/lib/api'
import { useAuthStore } from '../../../src/store/auth'
import { Order, Proposal } from '../../../src/types'
import { formatCurrency, formatDate, ORDER_STATUS_LABEL, ORDER_STATUS_COLOR } from '../../../src/lib/utils'

export default function PedidoDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { user } = useAuthStore()
  const [order, setOrder] = useState<Order | null>(null)
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [id])

  async function load() {
    try {
      const [oRes, pRes] = await Promise.all([
        api.get(`/orders/${id}`),
        api.get(`/orders/${id}/proposals`).catch(() => ({ data: { data: [] } })),
      ])
      setOrder(oRes.data.data)
      setProposals(pRes.data.data || [])
    } finally {
      setLoading(false)
    }
  }

  async function acceptProposal(proposalId: string) {
    Alert.alert('Aceitar proposta', 'Deseja aceitar esta proposta e ir para o pagamento?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Aceitar',
        onPress: async () => {
          try {
            await api.post(`/proposals/${proposalId}/accept`)
            Alert.alert('Proposta aceita!', 'Agora realize o pagamento para confirmar o serviço.', [
              { text: 'Pagar', onPress: () => router.push(`/(app)/pagamento/${id}`) },
            ])
          } catch (err) {
            Alert.alert('Erro', getApiError(err))
          }
        },
      },
    ])
  }

  if (loading) return <ActivityIndicator className="flex-1 mt-20" color="#2563eb" />
  if (!order) return null

  const isClient = user?.id === order.client_id
  const isProvider = user?.id !== order.client_id

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="flex-row items-center px-4 py-3 bg-white border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <ArrowLeft size={22} color="#374151" />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-gray-800 flex-1" numberOfLines={1}>Pedido</Text>
        <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: ORDER_STATUS_COLOR[order.status] + '20' }}>
          <Text className="text-xs font-medium" style={{ color: ORDER_STATUS_COLOR[order.status] }}>
            {ORDER_STATUS_LABEL[order.status]}
          </Text>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="p-5 gap-4">
        {/* Info principal */}
        <View className="bg-white rounded-2xl p-4 gap-2">
          <Text className="text-lg font-bold text-gray-800">{order.title}</Text>
          {order.description && <Text className="text-gray-500 text-sm">{order.description}</Text>}
          {order.desired_date && (
            <Text className="text-sm text-gray-600">📅 {formatDate(order.desired_date)}</Text>
          )}
          {order.address && (
            <Text className="text-sm text-gray-600">📍 {order.address}{order.city ? `, ${order.city}` : ''}</Text>
          )}
          {(order.estimated_price_min || order.estimated_price_max) && (
            <Text className="text-sm text-blue-600 font-medium">
              Estimativa: {order.estimated_price_min ? formatCurrency(order.estimated_price_min) : ''} – {order.estimated_price_max ? formatCurrency(order.estimated_price_max) : ''}
            </Text>
          )}
        </View>

        {/* Banner pagamento pendente */}
        {order.status === 'ACCEPTED' && isClient && (
          <TouchableOpacity
            onPress={() => router.push(`/(app)/pagamento/${id}`)}
            className="bg-orange-500 rounded-2xl p-4 flex-row items-center justify-between"
          >
            <View>
              <Text className="text-white font-bold">Pagamento pendente</Text>
              <Text className="text-orange-100 text-sm">Toque para pagar e confirmar o serviço</Text>
            </View>
            <Text className="text-white text-2xl">→</Text>
          </TouchableOpacity>
        )}

        {/* Propostas */}
        {isClient && proposals.length > 0 && (
          <View>
            <Text className="text-base font-bold text-gray-700 mb-3">
              Propostas recebidas ({proposals.length})
            </Text>
            <View className="gap-3">
              {proposals.map(p => (
                <View key={p.id} className="bg-white rounded-2xl p-4">
                  <View className="flex-row justify-between items-start">
                    <View className="flex-1">
                      <Text className="font-semibold text-gray-800">{p.provider?.name ?? 'Prestador'}</Text>
                      {p.provider && (
                        <Text className="text-xs text-yellow-500">
                          ⭐ {p.provider.rating_avg.toFixed(1)} ({p.provider.rating_count})
                        </Text>
                      )}
                    </View>
                    <Text className="text-lg font-bold text-blue-600">{formatCurrency(p.value)}</Text>
                  </View>
                  {p.message && <Text className="text-sm text-gray-500 mt-2">{p.message}</Text>}
                  {p.status === 'PENDING' && order.status === 'OPEN' && (
                    <TouchableOpacity
                      onPress={() => acceptProposal(p.id)}
                      className="mt-3 bg-blue-600 rounded-xl py-2.5 items-center"
                    >
                      <Text className="text-white font-semibold">Aceitar proposta</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        {proposals.length === 0 && order.status === 'OPEN' && isClient && (
          <View className="bg-blue-50 rounded-2xl p-4 items-center">
            <Text className="text-blue-700 text-center">Aguardando propostas dos prestadores…</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
