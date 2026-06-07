import { useCallback, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  Alert, Modal,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useFocusEffect } from 'expo-router'
import { ArrowLeft, Zap, X } from 'lucide-react-native'
import { api, getApiError } from '../../src/lib/api'
import { Proposal } from '../../src/types'
import { formatCurrency } from '../../src/lib/utils'

const BOOST_LEVELS = [
  { level: 1, label: 'Destaque', price: 5, icon: '⭐', desc: 'Aparece com destaque amarelo' },
  { level: 2, label: 'Topo', price: 15, icon: '🚀', desc: 'Vai para o topo + selo Recomendado' },
] as const

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendente', ACCEPTED: 'Aceita', REJECTED: 'Recusada', CANCELLED: 'Cancelada',
}
const STATUS_COLOR: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  ACCEPTED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-rose-100 text-rose-700',
  CANCELLED: 'bg-slate2-100 text-slate2-600',
}

export default function MinhasPropostasScreen() {
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [loading, setLoading] = useState(true)
  const [boostFor, setBoostFor] = useState<Proposal | null>(null)
  const [boosting, setBoosting] = useState(false)

  useFocusEffect(useCallback(() => { load() }, []))

  async function load() {
    setLoading(true)
    try {
      const res = await api.get('/proposals/mine')
      const d = res.data.data
      setProposals(Array.isArray(d) ? d : [])
    } catch {
      setProposals([])
    } finally {
      setLoading(false)
    }
  }

  async function applyBoost(level: 1 | 2) {
    if (!boostFor) return
    setBoosting(true)
    try {
      await api.post(`/proposals/${boostFor.id}/boost`, { level })
      Alert.alert('Sucesso', 'Proposta destacada!')
      setBoostFor(null)
      await load()
    } catch (err) {
      Alert.alert('Erro', getApiError(err))
    } finally {
      setBoosting(false)
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-slate2-50" edges={['top']}>
      <View className="flex-row items-center px-4 py-3 bg-white border-b border-slate2-100 gap-2">
        <TouchableOpacity onPress={() => router.back()} className="p-1">
          <ArrowLeft size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-slate2-900">Minhas propostas</Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#7C3AED" />
        </View>
      ) : proposals.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-slate2-600 text-center">
            Você ainda não enviou propostas. Confira o feed para responder a pedidos.
          </Text>
        </View>
      ) : (
        <ScrollView className="flex-1 p-4">
          {proposals.map(p => {
            const boost = p.boost_level ?? 0
            return (
              <TouchableOpacity
                key={p.id}
                onPress={() => router.push(`/(app)/pedido/${p.order_id}` as any)}
                className={`rounded-2xl p-4 mb-3 border-2 ${boost === 2 ? 'bg-emerald-50/40 border-emerald-300' : boost === 1 ? 'bg-amber-50/40 border-amber-300' : 'bg-white border-slate2-200'}`}
              >
                {boost > 0 && (
                  <View className="mb-2">
                    <Text className={`text-[10px] font-bold px-2 py-0.5 rounded-full text-white self-start ${boost === 2 ? 'bg-emerald-600' : 'bg-amber-500'}`}>
                      {boost === 2 ? '🚀 Recomendado' : '⭐ Destaque'}
                    </Text>
                  </View>
                )}
                <View className="flex-row justify-between items-start mb-2">
                  <Text className="font-semibold text-slate2-900 flex-1 mr-2">
                    {(p as any).order?.title || 'Pedido'}
                  </Text>
                  <Text className="font-bold text-brand-700">{formatCurrency(p.value)}</Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <Text className={`text-[10px] px-2 py-0.5 rounded-full ${STATUS_COLOR[p.status]}`}>
                    {STATUS_LABEL[p.status]}
                  </Text>
                  {p.status === 'PENDING' && boost < 2 && (
                    <TouchableOpacity
                      onPress={(e) => { e.stopPropagation?.(); setBoostFor(p) }}
                      className="flex-row items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-300 ml-auto"
                    >
                      <Zap size={12} color="#B45309" />
                      <Text className="text-amber-700 text-xs font-medium">Destacar</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            )
          })}
        </ScrollView>
      )}

      <Modal visible={!!boostFor} transparent animationType="fade" onRequestClose={() => setBoostFor(null)}>
        <View className="flex-1 bg-black/40 justify-end">
          <View className="bg-white rounded-t-3xl p-5">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-lg font-semibold">Destacar proposta</Text>
              <TouchableOpacity onPress={() => setBoostFor(null)}>
                <X size={22} color="#0F172A" />
              </TouchableOpacity>
            </View>
            <Text className="text-sm text-slate2-600 mb-4">
              O valor é debitado do seu saldo de prestador.
            </Text>
            {BOOST_LEVELS.map(opt => {
              const disabled = (boostFor?.boost_level ?? 0) >= opt.level
              return (
                <TouchableOpacity
                  key={opt.level}
                  disabled={disabled || boosting}
                  onPress={() => applyBoost(opt.level)}
                  className={`p-4 rounded-2xl border-2 mb-2 ${opt.level === 2 ? 'border-emerald-300 bg-emerald-50' : 'border-amber-300 bg-amber-50'} ${disabled ? 'opacity-40' : ''}`}
                >
                  <View className="flex-row justify-between items-center">
                    <Text className="font-bold text-slate2-900">{opt.icon} {opt.label}</Text>
                    <Text className="font-bold text-slate2-900">R$ {opt.price.toFixed(2)}</Text>
                  </View>
                  <Text className="text-xs text-slate2-600 mt-1">{opt.desc}</Text>
                </TouchableOpacity>
              )
            })}
            <Text className="text-[11px] text-slate2-500 text-center mt-2">
              Saldo insuficiente? Aguarde um pagamento ou peça suporte.
            </Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}
