import { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Share, Image, Linking, TextInput,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { ArrowLeft, Share2, Phone, Navigation, Pencil, Trash2 } from 'lucide-react-native'
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
  const [fees, setFees] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [adjusting, setAdjusting] = useState(false)
  const [adjustValue, setAdjustValue] = useState('')

  useEffect(() => { load() }, [id])

  async function load() {
    try {
      const [oRes, pRes] = await Promise.all([
        api.get(`/orders/${id}`),
        api.get(`/orders/${id}/proposals`).catch(() => ({ data: { data: [] } })),
      ])
      const o = oRes.data.data
      setOrder(o)
      setProposals(pRes.data.data || [])
      // Taxa de Conexão: estado das taxas na janela de pagamento
      if (o?.status === 'ACCEPTED') {
        api.get(`/payments/fees/order/${id}`)
          .then(r => setFees(r.data.data))
          .catch(() => {})
      }
    } finally {
      setLoading(false)
    }
  }

  async function acceptProposal(proposalId: string) {
    Alert.alert(
      'Aceitar proposta',
      'Ao aceitar, você paga apenas a taxa de conexão para liberar o contato do profissional. O serviço é pago diretamente a ele.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Aceitar',
          onPress: async () => {
            try {
              await api.post(`/proposals/${proposalId}/accept`)
              Alert.alert('Proposta aceita!', 'Agora pague a taxa de conexão para liberar o contato.', [
                { text: 'Pagar taxa', onPress: () => router.push(`/(app)/pagamento/${id}`) },
              ])
            } catch (err) {
              Alert.alert('Erro', getApiError(err))
            }
          },
        },
      ],
    )
  }

  async function rejectProposal(proposalId: string) {
    try {
      await api.post(`/proposals/${proposalId}/reject`)
      load()
    } catch (err) {
      Alert.alert('Erro', getApiError(err))
    }
  }

  // Excluir = cancelar e tirar da lista (o registro fica para o suporte).
  function confirmDelete() {
    if (!order) return
    const closed = ['CANCELLED', 'DONE', 'RATED'].includes(order.status)
    const msg = closed
      ? 'O pedido sai da sua lista. O histórico continua guardado.'
      : order.status === 'ACCEPTED'
        ? 'A conexão ainda não foi concluída: você pode cancelar sem penalidade. Se já pagou sua taxa, ela volta como crédito.'
        : 'O pedido será cancelado e sairá da sua lista. Quem mandou proposta será avisado.'
    Alert.alert(closed ? 'Remover da lista' : 'Excluir pedido', msg, [
      { text: 'Voltar', style: 'cancel' },
      {
        text: 'Confirmar',
        style: 'destructive',
        onPress: async () => {
          try {
            const r = await api.delete(`/orders/${order.id}`, { data: {} })
            Alert.alert('Pronto', r.data.message ?? 'Pedido excluído')
            router.replace('/(app)/meus-pedidos' as any)
          } catch (err) {
            Alert.alert('Erro', getApiError(err))
          }
        },
      },
    ])
  }

  async function saveAdjust(proposalId: string) {
    const value = parseFloat(adjustValue.replace(',', '.'))
    if (!value || value <= 0) { Alert.alert('Valor inválido'); return }
    try {
      await api.patch(`/proposals/${proposalId}`, { value })
      setAdjusting(false)
      Alert.alert('Proposta atualizada')
      load()
    } catch (err) {
      Alert.alert('Erro', getApiError(err))
    }
  }

  if (loading) return <ActivityIndicator className="flex-1 mt-20" color="#059669" />
  if (!order) return null

  const isClient = user?.id === order.client_id
  const unlocked = !order.location_blurred && !!order.address
  const myProposal = !isClient ? (order as any).proposals?.find((p: Proposal) => p.provider_id === user?.id) as Proposal | undefined : undefined
  const editedAfterMyProposal =
    !!myProposal && !!order.edited_at &&
    new Date(order.edited_at).getTime() > new Date(myProposal.updated_at ?? myProposal.created_at).getTime()
  const fullAddress = [
    [order.address, order.address_number].filter(Boolean).join(', '),
    order.address_complement,
    order.neighborhood,
    [order.city, order.state].filter(Boolean).join('/'),
    order.cep ? `CEP ${order.cep.slice(0, 5)}-${order.cep.slice(5)}` : null,
  ].filter(Boolean).join(' · ')
  const clientPhone = (order.client as any)?.phone as string | null | undefined
  const servicePhotos = order.service_photos ?? []

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <View className="flex-row items-center px-4 py-3 bg-white border-b border-slate2-100">
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Voltar" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => router.back()} className="mr-3">
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
            <Share2 size={20} color="#059669" />
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
          {unlocked ? (
            <Text className="font-sans text-sm text-slate2-600">📍 {fullAddress}</Text>
          ) : (order.neighborhood || order.city) ? (
            <Text className="font-sans text-sm text-slate2-600">
              📍 {[order.neighborhood, order.city].filter(Boolean).join(', ')}
              {!isClient ? ' · endereço liberado após as taxas de conexão' : ''}
            </Text>
          ) : null}
          {unlocked && !isClient && order.location_source === 'PROFILE' && (
            <Text className="font-sans text-xs text-amber-700">Ponto no mapa aproximado — confirme o endereço com o cliente.</Text>
          )}
          {(order.estimated_price_min || order.estimated_price_max) && (
            <Text className="font-display-semibold text-sm text-brand-700">
              Estimativa: {order.estimated_price_min ? formatCurrency(order.estimated_price_min) : ''} – {order.estimated_price_max ? formatCurrency(order.estimated_price_max) : ''}
            </Text>
          )}
        </View>

        {/* Prestador com a conexão paga: contato e rota */}
        {!isClient && unlocked && (
          <View className="bg-white rounded-2xl p-4 gap-2.5 border border-brand-200">
            <Text className="font-display-bold text-slate2-900">Contato e local do cliente</Text>
            {clientPhone ? (
              <View className="flex-row gap-2.5">
                <TouchableOpacity onPress={() => Linking.openURL(`tel:${clientPhone}`)} className="flex-1 flex-row items-center justify-center gap-2 py-3 rounded-xl bg-brand-700">
                  <Phone size={16} color="#fff" />
                  <Text className="font-display-bold text-white text-sm">Ligar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => Linking.openURL(`https://wa.me/55${clientPhone.replace(/\D/g, '').replace(/^55/, '')}`)}
                  className="flex-1 items-center justify-center py-3 rounded-xl border-2 border-brand-600"
                >
                  <Text className="font-display-bold text-brand-700 text-sm">WhatsApp</Text>
                </TouchableOpacity>
              </View>
            ) : null}
            {order.latitude != null && order.longitude != null && (
              <View className="flex-row gap-2.5">
                <TouchableOpacity
                  onPress={() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${order.latitude},${order.longitude}`)}
                  className="flex-1 flex-row items-center justify-center gap-2 py-3 rounded-xl border border-slate2-300 bg-white"
                >
                  <Navigation size={16} color="#334155" />
                  <Text className="font-display-semibold text-slate2-800 text-sm">Google Maps</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => Linking.openURL(`https://waze.com/ul?ll=${order.latitude},${order.longitude}&navigate=yes`)}
                  className="flex-1 items-center justify-center py-3 rounded-xl border border-slate2-300 bg-white"
                >
                  <Text className="font-display-semibold text-slate2-800 text-sm">Waze</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Respostas do questionário */}
        {(order.answers_display?.length ?? 0) > 0 && (
          <View className="bg-white rounded-2xl p-4 gap-2.5 border border-slate2-200">
            <Text className="font-display-bold text-slate2-900">Detalhes informados</Text>
            {order.answers_display!.map((a) => (
              <View key={a.field_id}>
                <Text className="font-sans text-xs text-slate2-500">{a.question}</Text>
                <Text className="font-display-semibold text-sm text-slate2-900">{a.value}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Fotos do pedido */}
        {(order.photos?.length ?? 0) > 0 && (
          <View>
            <Text className="font-display-bold text-sm text-slate2-700 mb-2">Fotos do pedido</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
              {order.photos!.map((url) => (
                <TouchableOpacity key={url} onPress={() => Linking.openURL(url)}>
                  <Image source={{ uri: url }} style={{ width: 88, height: 88, borderRadius: 12 }} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Fotos de check-in e conclusão */}
        {servicePhotos.length > 0 && (['CHECKIN', 'COMPLETION'] as const).map((stage) => {
          const list = servicePhotos.filter((p) => p.stage === stage)
          if (!list.length) return null
          return (
            <View key={stage}>
              <Text className="font-display-bold text-sm text-slate2-700 mb-2">
                {stage === 'CHECKIN' ? 'Início do serviço (check-in)' : 'Serviço concluído'}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
                {list.map((p) => (
                  <TouchableOpacity key={p.id} onPress={() => Linking.openURL(p.url)}>
                    <Image source={{ uri: p.url }} style={{ width: 88, height: 88, borderRadius: 12 }} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )
        })}

        {/* Prestador: sua proposta (e aviso se o cliente editou o pedido) */}
        {myProposal && myProposal.status === 'PENDING' && ['OPEN', 'IN_PROPOSAL'].includes(order.status) && (
          <View className={`rounded-2xl p-4 border ${editedAfterMyProposal ? 'border-amber-300 bg-amber-50' : 'border-slate2-200 bg-white'}`}>
            <Text className="font-display-bold text-slate2-900">Sua proposta: {formatCurrency(myProposal.value)}</Text>
            {editedAfterMyProposal && (
              <Text className="font-sans text-sm text-amber-800 mt-1">
                O cliente editou o pedido depois da sua proposta. Confira os detalhes e ajuste o valor se precisar.
              </Text>
            )}
            {adjusting ? (
              <View className="flex-row gap-2 mt-3 items-center">
                <TextInput
                  className="flex-1 bg-white border border-slate2-300 rounded-xl px-3 py-2.5 font-sans text-slate2-900"
                  keyboardType="decimal-pad"
                  value={adjustValue}
                  onChangeText={setAdjustValue}
                  placeholder="Novo valor"
                />
                <Button size="sm" onPress={() => saveAdjust(myProposal.id)}>Salvar</Button>
                <Button size="sm" variant="ghost" onPress={() => setAdjusting(false)}>Cancelar</Button>
              </View>
            ) : (
              <View className="mt-3 self-start">
                <Button size="sm" variant="outline" onPress={() => { setAdjustValue(String(myProposal.value)); setAdjusting(true) }}>
                  Ajustar proposta
                </Button>
              </View>
            )}
          </View>
        )}

        {/* Banners da Taxa de Conexão (janela ACCEPTED) */}
        {order.status === 'ACCEPTED' && isClient && (() => {
          const clientPaid = fees?.client_fee && ['PAID', 'COVERED'].includes(fees.client_fee.status)
          if (clientPaid) {
            return (
              <TouchableOpacity
                onPress={() => router.push(`/(app)/pagamento/${id}`)}
                className="rounded-2xl p-4 flex-row items-center justify-between bg-brand-700"
              >
                <View className="flex-1">
                  <Text className="font-display-bold text-white">Aguardando o profissional</Text>
                  <Text className="font-sans text-white/90 text-sm mt-0.5">
                    Sua taxa foi paga. Se ele não confirmar no prazo, ela volta como crédito.
                  </Text>
                </View>
                <Text className="text-white text-2xl">→</Text>
              </TouchableOpacity>
            )
          }
          return (
            <TouchableOpacity
              onPress={() => router.push(`/(app)/pagamento/${id}`)}
              className="rounded-2xl p-4 flex-row items-center justify-between"
              style={{ backgroundColor: '#D97706' }}
            >
              <View className="flex-1">
                <Text className="font-display-bold text-white">Taxa de conexão pendente</Text>
                <Text className="font-sans text-white/90 text-sm mt-0.5">
                  {fees?.client_fee?.promo_active
                    ? `Promoção: ${Math.round(fees.client_fee.pct_applied * 100)}% em vez de ${Math.round(fees.client_fee.regular_pct * 100)}% — toque para pagar`
                    : 'Toque para pagar e liberar o contato do profissional'}
                </Text>
              </View>
              <Text className="text-white text-2xl">→</Text>
            </TouchableOpacity>
          )
        })()}

        {/* Prestador aceito: CTA para pagar a taxa dele */}
        {order.status === 'ACCEPTED' && !isClient && fees?.viewer_side === 'PROVIDER' && (
          <TouchableOpacity
            onPress={() => router.push(`/(app)/taxa-conexao/${id}` as any)}
            className="rounded-2xl p-4 flex-row items-center justify-between bg-accent-600"
          >
            <View className="flex-1">
              <Text className="font-display-bold text-white">
                {fees?.client_fee && ['PAID', 'COVERED'].includes(fees.client_fee.status)
                  ? 'Pague sua taxa para liberar o contato'
                  : 'Proposta aceita — aguardando o cliente'}
              </Text>
              <Text className="font-sans text-white/90 text-sm mt-0.5">
                Toque para ver os detalhes da taxa de conexão
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
                  {p.status === 'PENDING' && ['OPEN', 'IN_PROPOSAL'].includes(order.status) && (
                    <View className="mt-3 flex-row gap-2">
                      <View className="flex-1">
                        <Button variant="success" size="md" fullWidth onPress={() => acceptProposal(p.id)}>
                          ✓ Aceitar proposta
                        </Button>
                      </View>
                      <Button variant="secondary" size="md" onPress={() => rejectProposal(p.id)}>Recusar</Button>
                    </View>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        {proposals.length === 0 && order.status === 'OPEN' && isClient && (
          <View className="bg-trust-50 rounded-2xl p-4 items-center border border-trust-100">
            <Text className="font-sans text-trust-700 text-center">
              Aguardando propostas dos prestadores…
            </Text>
          </View>
        )}

        {/* Cliente: editar / excluir */}
        {isClient && (
          <View className="flex-row gap-2.5 mb-6">
            {['OPEN', 'IN_PROPOSAL'].includes(order.status) && order.category?.slug && (
              <TouchableOpacity
                onPress={() => router.push(`/(app)/pedido/novo/${order.category!.slug}?editar=${order.id}` as any)}
                className="flex-1 flex-row items-center justify-center gap-2 py-3 rounded-xl border-2 border-brand-600 bg-white"
              >
                <Pencil size={16} color="#047857" />
                <Text className="font-display-bold text-brand-700 text-sm">Editar pedido</Text>
              </TouchableOpacity>
            )}
            {['OPEN', 'IN_PROPOSAL', 'ACCEPTED', 'CANCELLED', 'DONE', 'RATED'].includes(order.status) && (
              <TouchableOpacity
                onPress={confirmDelete}
                className="flex-1 flex-row items-center justify-center gap-2 py-3 rounded-xl border-2 border-red-200 bg-white"
              >
                <Trash2 size={16} color="#DC2626" />
                <Text className="font-display-bold text-red-600 text-sm">
                  {['CANCELLED', 'DONE', 'RATED'].includes(order.status) ? 'Remover da lista' : 'Excluir pedido'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
