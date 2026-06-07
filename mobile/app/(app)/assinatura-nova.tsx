import { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { ArrowLeft, Repeat } from 'lucide-react-native'
import { api } from '../../src/lib/api'
import { Schedule } from '../../src/types'
import { MakeRecurringButton } from '../../src/components/MakeRecurringButton'
import { formatCurrency } from '../../src/lib/utils'

export default function AssinaturaNovaScreen() {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get('/schedules')
      .then((r) => {
        const list: Schedule[] = Array.isArray(r.data.data) ? r.data.data : []
        setSchedules(
          list.filter(
            (s) =>
              s.status === 'DONE' &&
              (s.order as any)?.category_id &&
              s.provider_id,
          ),
        )
      })
      .catch(() => setSchedules([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <SafeAreaView className="flex-1 bg-slate2-50" edges={['top']}>
      <View className="flex-row items-center px-4 py-3 bg-white border-b border-slate2-100 gap-2">
        <TouchableOpacity onPress={() => router.back()} className="p-1">
          <ArrowLeft size={22} color="#0F172A" />
        </TouchableOpacity>
        <Repeat size={20} color="#7C3AED" />
        <Text className="text-lg font-semibold text-slate2-900">Nova assinatura</Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#7C3AED" />
        </View>
      ) : schedules.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <Repeat size={48} color="#94A3B8" />
          <Text className="text-slate2-600 text-center mt-3">
            Você ainda não tem serviços concluídos para tornar recorrentes.
          </Text>
        </View>
      ) : (
        <ScrollView className="flex-1 p-4">
          <Text className="text-sm text-slate2-600 mb-3">
            Escolha um serviço já concluído para transformar em recorrência.
          </Text>
          {schedules.map((s) => (
            <View key={s.id} className="bg-white rounded-2xl p-4 mb-3">
              <View className="flex-row items-center gap-3 mb-3">
                <View className="flex-1">
                  <Text className="font-semibold text-slate2-900">{s.order?.title}</Text>
                  <Text className="text-xs text-slate2-500 mt-0.5">
                    com {s.provider?.name} · {s.order?.category?.name}
                  </Text>
                </View>
                {(s.order as any)?.final_price != null && (
                  <Text className="font-semibold text-slate2-700 text-sm">
                    {formatCurrency((s.order as any).final_price)}
                  </Text>
                )}
              </View>
              <MakeRecurringButton schedule={s} onCreated={() => router.replace('/assinaturas' as any)} />
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}
