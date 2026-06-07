import { useCallback, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useFocusEffect } from 'expo-router'
import { ArrowLeft, Repeat, Pause, Play, X, SkipForward, Calendar } from 'lucide-react-native'
import { api, getApiError } from '../../src/lib/api'
import { formatCurrency } from '../../src/lib/utils'

type Subscription = {
  id: string
  frequency: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY'
  weekday: number | null
  day_of_month: number | null
  time_slot: string
  base_value: number
  discount_pct: number
  status: 'ACTIVE' | 'PAUSED' | 'CANCELLED'
  next_occurrence: string
  title: string
  city: string
  provider: { id: string; name: string }
  category: { name: string; icon: string }
}

const FREQ_LABEL = { WEEKLY: 'Semanal', BIWEEKLY: 'Quinzenal', MONTHLY: 'Mensal' } as const
const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export default function AssinaturasScreen() {
  const [subs, setSubs] = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<'client' | 'provider'>('client')

  useFocusEffect(useCallback(() => {
    load()
  }, [role]))

  async function load() {
    setLoading(true)
    try {
      const res = await api.get(`/subscriptions?role=${role}`)
      const d = res.data.data
      setSubs(Array.isArray(d) ? d : [])
    } catch {
      setSubs([])
    } finally {
      setLoading(false)
    }
  }

  async function patch(id: string, body: any) {
    try {
      await api.patch(`/subscriptions/${id}`, body)
      await load()
    } catch (err) {
      Alert.alert('Erro', getApiError(err))
    }
  }

  async function cancel(id: string) {
    Alert.alert('Cancelar assinatura', 'Ocorrências futuras não serão geradas. Confirma?', [
      { text: 'Não', style: 'cancel' },
      { text: 'Sim', style: 'destructive', onPress: async () => {
        try { await api.delete(`/subscriptions/${id}`); await load() }
        catch (err) { Alert.alert('Erro', getApiError(err)) }
      }},
    ])
  }

  async function skip(id: string) {
    try {
      await api.post(`/subscriptions/${id}/skip-next`, {})
      await load()
    } catch (err) {
      Alert.alert('Erro', getApiError(err))
    }
  }

  function formatNext(iso: string) {
    const d = new Date(iso)
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const hh = String(d.getHours()).padStart(2, '0')
    const mi = String(d.getMinutes()).padStart(2, '0')
    return `${dd}/${mm} às ${hh}:${mi}`
  }

  return (
    <SafeAreaView className="flex-1 bg-slate2-50" edges={['top']}>
      <View className="flex-row items-center px-4 py-3 bg-white border-b border-slate2-100 gap-2">
        <TouchableOpacity onPress={() => router.back()} className="p-1">
          <ArrowLeft size={22} color="#0F172A" />
        </TouchableOpacity>
        <Repeat size={20} color="#7C3AED" />
        <Text className="text-lg font-semibold text-slate2-900 flex-1">Assinaturas</Text>
        {role === 'client' && (
          <TouchableOpacity
            onPress={() => router.push('/assinatura-nova' as any)}
            className="bg-brand-700 px-3 py-1.5 rounded-lg"
          >
            <Text className="text-white text-sm font-medium">+ Nova</Text>
          </TouchableOpacity>
        )}
      </View>

      <View className="bg-white px-4 py-2 border-b border-slate2-100 flex-row">
        <TouchableOpacity onPress={() => setRole('client')} className={`flex-1 py-2 rounded-lg ${role === 'client' ? 'bg-slate2-100' : ''}`}>
          <Text className={`text-center text-sm ${role === 'client' ? 'font-semibold' : ''}`}>Como cliente</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setRole('provider')} className={`flex-1 py-2 rounded-lg ${role === 'provider' ? 'bg-slate2-100' : ''}`}>
          <Text className={`text-center text-sm ${role === 'provider' ? 'font-semibold' : ''}`}>Como prestador</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#7C3AED" />
        </View>
      ) : subs.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <Repeat size={48} color="#94A3B8" />
          <Text className="text-slate2-600 text-center mt-3">
            Nenhuma assinatura {role === 'client' ? 'contratada' : 'recebida'}.
          </Text>
        </View>
      ) : (
        <ScrollView className="flex-1 p-4">
          {subs.map(sub => {
            const final = sub.base_value * (1 - sub.discount_pct)
            return (
              <View key={sub.id} className="bg-white rounded-2xl p-4 mb-3">
                <View className="flex-row items-center gap-2 mb-1">
                  <Text className="font-semibold text-slate2-900 flex-1">{sub.title}</Text>
                  {sub.status === 'PAUSED' && (
                    <Text className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Pausada</Text>
                  )}
                  {sub.status === 'CANCELLED' && (
                    <Text className="text-[10px] bg-slate2-200 text-slate2-600 px-2 py-0.5 rounded-full">Cancelada</Text>
                  )}
                </View>
                <Text className="text-xs text-slate2-500 mb-2">{sub.category.name} · {sub.city}</Text>
                <Text className="text-sm text-slate2-700">
                  {FREQ_LABEL[sub.frequency]}
                  {sub.weekday != null ? ` · ${WEEKDAYS[sub.weekday]}` : sub.day_of_month != null ? ` · dia ${sub.day_of_month}` : ''}
                  {' às '}{sub.time_slot}
                </Text>
                <Text className="text-sm text-slate2-700 mt-1">
                  {formatCurrency(final)} por ocorrência
                  <Text className="text-emerald-600 text-xs"> (-{(sub.discount_pct * 100).toFixed(0)}%)</Text>
                </Text>
                <View className="flex-row items-center gap-1 mt-1">
                  <Calendar size={12} color="#64748B" />
                  <Text className="text-xs text-slate2-500">Próxima: {formatNext(sub.next_occurrence)}</Text>
                </View>

                {sub.status !== 'CANCELLED' && (
                  <View className="flex-row gap-2 mt-3 pt-3 border-t border-slate2-100 flex-wrap">
                    {sub.status === 'ACTIVE' ? (
                      <TouchableOpacity onPress={() => patch(sub.id, { status: 'PAUSED' })} className="flex-row items-center gap-1 px-3 py-1.5 bg-amber-50 rounded-lg">
                        <Pause size={14} color="#B45309" />
                        <Text className="text-amber-700 text-xs">Pausar</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity onPress={() => patch(sub.id, { status: 'ACTIVE' })} className="flex-row items-center gap-1 px-3 py-1.5 bg-emerald-50 rounded-lg">
                        <Play size={14} color="#047857" />
                        <Text className="text-emerald-700 text-xs">Retomar</Text>
                      </TouchableOpacity>
                    )}
                    {role === 'client' && sub.status === 'ACTIVE' && (
                      <TouchableOpacity onPress={() => skip(sub.id)} className="flex-row items-center gap-1 px-3 py-1.5 bg-slate2-100 rounded-lg">
                        <SkipForward size={14} color="#475569" />
                        <Text className="text-slate2-700 text-xs">Pular próxima</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={() => cancel(sub.id)} className="flex-row items-center gap-1 px-3 py-1.5 bg-rose-50 rounded-lg ml-auto">
                      <X size={14} color="#E11D48" />
                      <Text className="text-rose-600 text-xs">Cancelar</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}
