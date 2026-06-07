import { useCallback, useState } from 'react'
import {
  View, Text, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useFocusEffect } from 'expo-router'
import { api } from '../../src/lib/api'
import { Schedule } from '../../src/types'
import { formatDate, SCHEDULE_STATUS_LABEL } from '../../src/lib/utils'
import { Badge, BadgeVariant } from '../../src/components/ui'

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  CONFIRMED:   'purple',
  IN_PROGRESS: 'fuchsia',
  DONE:        'green',
  CANCELLED:   'red',
}

export default function AgendamentosScreen() {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function load() {
    try {
      const r = await api.get('/schedules')
      setSchedules(r.data.data || [])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useFocusEffect(useCallback(() => { load() }, []))

  if (loading) return <ActivityIndicator className="flex-1 mt-20" color="#1D4ED8" />

  return (
    <SafeAreaView className="flex-1 bg-slate2-50">
      <View className="px-5 pt-6 pb-4">
        <Text className="font-display-extrabold text-2xl text-slate2-900">
          Agendamentos
        </Text>
      </View>
      <FlatList
        data={schedules}
        keyExtractor={s => s.id}
        contentContainerClassName="px-5 gap-3 pb-6"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} />}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => router.push(`/(app)/agendamento/${item.id}`)}
            activeOpacity={0.85}
            className="bg-white rounded-2xl p-4 border border-slate2-200"
          >
            <View className="flex-row justify-between items-start">
              <Text
                className="font-display-bold text-slate2-900 flex-1 mr-2"
                numberOfLines={2}
              >
                {item.order?.title ?? 'Agendamento'}
              </Text>
              <Badge variant={STATUS_VARIANT[item.status] ?? 'gray'}>
                {SCHEDULE_STATUS_LABEL[item.status]}
              </Badge>
            </View>
            <Text className="font-sans text-sm text-slate2-500 mt-2">
              📅 {formatDate(item.scheduled_at)}
            </Text>
            <View className="flex-row mt-2 gap-4">
              {item.provider && (
                <Text className="font-sans text-xs text-slate2-400">
                  🔧 {item.provider.name}
                </Text>
              )}
              {item.client && (
                <Text className="font-sans text-xs text-slate2-400">
                  👤 {item.client.name}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View className="items-center mt-20">
            <Text className="text-5xl mb-4">📅</Text>
            <Text className="font-sans text-slate2-500 text-base">
              Nenhum agendamento ainda
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  )
}
