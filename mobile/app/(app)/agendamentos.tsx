import { useCallback, useState } from 'react'
import {
  View, Text, FlatList, TouchableOpacity,
  ActivityIndicator, SafeAreaView, RefreshControl,
} from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { api } from '../../src/lib/api'
import { Schedule } from '../../src/types'
import { formatDate, SCHEDULE_STATUS_LABEL } from '../../src/lib/utils'

const STATUS_COLOR: Record<string, string> = {
  CONFIRMED: '#8b5cf6',
  IN_PROGRESS: '#06b6d4',
  DONE: '#10b981',
  CANCELLED: '#ef4444',
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

  if (loading) return <ActivityIndicator className="flex-1 mt-20" color="#2563eb" />

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="px-5 pt-6 pb-4">
        <Text className="text-2xl font-bold text-gray-800">Agendamentos</Text>
      </View>
      <FlatList
        data={schedules}
        keyExtractor={s => s.id}
        contentContainerClassName="px-5 gap-3 pb-6"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} />}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => router.push(`/(app)/agendamento/${item.id}`)}
            className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
          >
            <View className="flex-row justify-between items-start">
              <Text className="font-semibold text-gray-800 flex-1 mr-2" numberOfLines={2}>
                {item.order?.title ?? 'Agendamento'}
              </Text>
              <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: STATUS_COLOR[item.status] + '20' }}>
                <Text className="text-xs font-medium" style={{ color: STATUS_COLOR[item.status] }}>
                  {SCHEDULE_STATUS_LABEL[item.status]}
                </Text>
              </View>
            </View>
            <Text className="text-sm text-gray-500 mt-2">
              📅 {formatDate(item.scheduled_at)}
            </Text>
            <View className="flex-row mt-2 gap-4">
              {item.provider && (
                <Text className="text-xs text-gray-400">🔧 {item.provider.name}</Text>
              )}
              {item.client && (
                <Text className="text-xs text-gray-400">👤 {item.client.name}</Text>
              )}
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View className="items-center mt-20">
            <Text className="text-5xl mb-4">📅</Text>
            <Text className="text-gray-500 text-base">Nenhum agendamento ainda</Text>
          </View>
        }
      />
    </SafeAreaView>
  )
}
