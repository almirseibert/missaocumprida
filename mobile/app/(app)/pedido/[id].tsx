import { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Share,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { ArrowLeft, Share2 } from 'lucide-react-native'
import { api, getApiError } from '../../../src/lib/api'
import { useAuthStore } from '../../../src/store/auth'
import { Order, Proposal } from '../../../src/types'
import { formatCurrency, formatDate } from '../../../src/lib/utils'
import { Badge, Button, ORDER_STATUS_BADGE } from '../../../src/components/ui'

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

  if (loading) return <ActivityIndicator className="flex-1 mt-20" color="#1D4ED8" />
  if (!order) return null

  const isClient = user?.id === order.client_id

  return (
    <SafeAreaView className="flex-1 bg-slate2-50">
      <View className="flex-row items-center px-4 py-3 bg-white border-b border-slate2-100">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <ArrowLeft size={22} color="#334155" />
        </TouchableOpacity>
        <Text className="font-display-bold text-lg text-slate2-900 flex-1" numberOfLines={1}>
          Pedido
        </Text>
        {isClient && ['OPEN', 'IN_PROPOSAL'].includes(order.status) && (
          <TouchableOpacity
            onPress={async () => {
              try {
                const r = await api.post(`/orders/${order.id}/share`)
                const url = r.data.data.url as string
                await Share.share({
                  message: `Estou precisando deste serviço — você pode ajudar?\n${url}`,
                  url,
                })
              } catch (e) {
                Alert.alert('Erro', getApiError(e))
              }
            }}
            className="mr-2 p-2 rounded-lg"
          >
            <Share2 size={20} color="#1D4ED8" />
          </TouchableOpacity>
        )}
        {(() => {
          const b = ORDER_STATUS_BADGE[order.status]
          return b ? <Badge variant={b.variant}>{b.label}</Badge> : null
        })()}
      </View>

      <ScrollView className="flex-1" contentContainerClassName="p-5 gap-4">
        {/* Info principal */}
        <View className="bg-white rounded-2xl p-4 gap-2 border border-slate2-200">
          <Text className="font-display-extrabold text-lg text-slate2-900">{order.title}</Text>
          {order.description && (
            <Text className="font-sans text-slate2-500 text-sm leading-relaxed">
              {order.description}
            </Text>
          )}
          {order.desired_date && (
            <Text className="font-sans text-sm text-slate2-600">
              📅 {formatDate(order.desired_date)}
            </Text>
          )}
          {order.address && (
            <Text className="font-sans text-sm text-slate2-600">
              📍 {order.address}{order.city ? `, ${order.city}` : ''}
            </Text>
          )}
          {(order.estimated_price_min || order.estimated_price_max) && (
            <Text className="font-display-semibold text-sm text-brand-700">
              Estimativa: {order.estimated_price_min ? formatCurrency(order.estimated_price_min) : ''} – {order.estimated_price_max ? formatCurrency(order.estimated_price_max) : ''}
            </Text>
          )}
        </View>

        {/* Banner pagamento pendente — usa âmbar warning do design system */}
        {order.status === 'ACCEPTED' && isClient && (
          <TouchableOpacity
            onPress={() => router.push(`/(app)/pagamento/${id}`)}
            className="rounded-2xl p-4 flex-row items-center justify-between"
            style={{ backgroundColor: '#D97706' }}
          >
            <View className="flex-1">
              <Text className="font-display-bold text-white">Pagamento pendente</Text>
              <Text className="font-sans text-white/90 text-sm mt-0.5">
                Toque para pagar e confirmar o serviço
              </Text>
            </View>
            <Text className="text-white text-2xl">→</Text>
          </TouchableOpacity>
        )}

        {/* Propostas */}
        {isClient && proposals.length > 0 && (
          <View>
            <Text className="font-display-bold text-base text-slate2-700 mb-3">
              Propostas recebidas ({proposals.length})
            </Text>
            <View className="gap-3">
              {proposals.map(p => (
                <View key={p.id} className={`rounded-2xl p-4 border-2 ${p.boost_level === 2 ? 'bg-emerald-50/40 border-emerald-300' : p.boost_level === 1 ? 'bg-amber-50/40 border-amber-300' : 'bg-white border-slate2-200'}`}>
                  {(p.boost_level ?? 0) > 0 && (
                    <View className="mb-2">
                      <Text className={`text-[10px] font-bold px-2 py-0.5 rounded-full text-white self-start ${p.boost_level === 2 ? 'bg-emerald-600' : 'bg-amber-500'}`}>
                        {p.boost_level === 2 ? '🚀 Recomendado' : '⭐ Destaque'}
                      </Text>
                    </View>
                  )}
                  <View className="flex-row justify-between items-start">
                    <View className="flex-1">
                      <Text className="font-display-semibold text-slate2-900">
                        {p.provider?.name ?? 'Prestador'}
                      </Text>
                      {p.provider && (
                        <Text className="font-sans text-xs text-slate2-500 mt-0.5">
                          <Text style={{ color: '#F59E0B' }}>★</Text>{' '}
                          {(p.provider.rating_avg ?? 0).toFixed(1)} ({p.provider.rating_count ?? 0})
                        </Text>
                      )}
                    </View>
                    <Text className="font-display-extrabold text-lg text-brand-700">
                      {formatCurrency(p.value)}
                    </Text>
                  </View>
                  {p.message && (
                    <Text className="font-sans text-sm text-slate2-600 mt-2 leading-relaxed">
                      {p.message}
                    </Text>
                  )}
                  {p.status === 'PENDING' && order.status === 'OPEN' && (
                    <View className="mt-3">
                      <Button variant="success" size="md" fullWidth onPress={() => acceptProposal(p.id)}>
                        ✓ Aceitar proposta
                      </Button>
                    </View>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        {proposals.length === 0 && order.status === 'OPEN' && isClient && (
          <View className="bg-brand-50 rounded-2xl p-4 items-center border border-brand-100">
            <Text className="font-sans text-brand-700 text-center">
              Aguardando propostas dos prestadores…
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
