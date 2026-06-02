import { useEffect, useRef, useState } from 'react'
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { ArrowLeft, Send } from 'lucide-react-native'
import { api, getApiError } from '../../../src/lib/api'
import { useAuthStore } from '../../../src/store/auth'
import { Schedule, Message } from '../../../src/types'
import { formatDate, formatTime, formatCurrency, SCHEDULE_STATUS_LABEL } from '../../../src/lib/utils'

export default function AgendamentoDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { user } = useAuthStore()
  const [schedule, setSchedule] = useState<Schedule | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<ScrollView>(null)

  useEffect(() => {
    load()
    const interval = setInterval(loadMessages, 5000)
    return () => clearInterval(interval)
  }, [id])

  async function load() {
    try {
      const [sRes, mRes] = await Promise.all([
        api.get(`/schedules/${id}`),
        api.get(`/schedules/${id}/messages`),
      ])
      setSchedule(sRes.data.data)
      setMessages(mRes.data.data || [])
    } finally {
      setLoading(false)
    }
  }

  async function loadMessages() {
    try {
      const r = await api.get(`/schedules/${id}/messages`)
      setMessages(r.data.data || [])
    } catch {}
  }

  async function sendMessage() {
    if (!text.trim()) return
    setSending(true)
    try {
      await api.post(`/schedules/${id}/messages`, { content: text.trim() })
      setText('')
      await loadMessages()
      setTimeout(() => scrollRef.current?.scrollToEnd(), 100)
    } catch (err) {
      Alert.alert('Erro', getApiError(err))
    } finally {
      setSending(false)
    }
  }

  async function doAction(action: 'checkin' | 'complete' | 'confirm', label: string) {
    Alert.alert(label, `Confirmar "${label}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Confirmar',
        onPress: async () => {
          try {
            await api.post(`/schedules/${id}/${action}`)
            await load()
            Alert.alert('Sucesso', `${label} realizado com sucesso!`)
          } catch (err) {
            Alert.alert('Erro', getApiError(err))
          }
        },
      },
    ])
  }

  if (loading) return <ActivityIndicator className="flex-1 mt-20" color="#2563eb" />
  if (!schedule) return null

  const isProvider = user?.id === schedule.provider_id
  const isClient = user?.id === schedule.client_id

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 bg-white border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <ArrowLeft size={22} color="#374151" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="font-bold text-gray-800" numberOfLines={1}>
            {schedule.order?.title ?? 'Agendamento'}
          </Text>
          <Text className="text-xs text-gray-500">
            {SCHEDULE_STATUS_LABEL[schedule.status]} • {formatDate(schedule.scheduled_at)}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <ScrollView
          ref={scrollRef}
          className="flex-1"
          contentContainerClassName="p-4 gap-2"
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          {/* Info do agendamento */}
          <View className="bg-white rounded-2xl p-4 mb-2">
            <View className="flex-row justify-between">
              <Text className="text-sm text-gray-500">Prestador</Text>
              <Text className="text-sm font-medium text-gray-800">{schedule.provider?.name}</Text>
            </View>
            <View className="flex-row justify-between mt-1">
              <Text className="text-sm text-gray-500">Cliente</Text>
              <Text className="text-sm font-medium text-gray-800">{schedule.client?.name}</Text>
            </View>
            {schedule.order?.provider_amount && (
              <View className="flex-row justify-between mt-1">
                <Text className="text-sm text-gray-500">Valor (prestador recebe)</Text>
                <Text className="text-sm font-medium text-green-600">
                  {formatCurrency(schedule.order.provider_amount)}
                </Text>
              </View>
            )}
          </View>

          {/* Ações */}
          {schedule.status === 'CONFIRMED' && isProvider && (
            <TouchableOpacity
              onPress={() => doAction('checkin', 'Check-in')}
              className="bg-blue-600 rounded-xl py-3 items-center mb-2"
            >
              <Text className="text-white font-semibold">Fazer Check-in</Text>
            </TouchableOpacity>
          )}
          {schedule.status === 'IN_PROGRESS' && isProvider && (
            <TouchableOpacity
              onPress={() => doAction('complete', 'Marcar concluído')}
              className="bg-green-600 rounded-xl py-3 items-center mb-2"
            >
              <Text className="text-white font-semibold">Marcar como Concluído</Text>
            </TouchableOpacity>
          )}
          {schedule.status === 'DONE' && isClient && (
            <TouchableOpacity
              onPress={() => doAction('confirm', 'Confirmar conclusão')}
              className="bg-purple-600 rounded-xl py-3 items-center mb-2"
            >
              <Text className="text-white font-semibold">Confirmar Conclusão e Liberar Pagamento</Text>
            </TouchableOpacity>
          )}

          {/* Mensagens */}
          <Text className="text-xs text-gray-400 text-center my-2">Chat</Text>
          {messages.map(msg => {
            const isMine = msg.sender_id === user?.id
            return (
              <View key={msg.id} className={`max-w-[80%] ${isMine ? 'self-end' : 'self-start'}`}>
                {!isMine && (
                  <Text className="text-xs text-gray-400 mb-0.5 ml-1">{msg.sender?.name}</Text>
                )}
                <View className={`rounded-2xl px-4 py-2.5 ${isMine ? 'bg-blue-600' : 'bg-white border border-gray-200'}`}>
                  <Text className={isMine ? 'text-white' : 'text-gray-800'}>{msg.content}</Text>
                </View>
                <Text className={`text-xs text-gray-400 mt-0.5 ${isMine ? 'text-right mr-1' : 'ml-1'}`}>
                  {formatTime(msg.created_at)}
                </Text>
              </View>
            )
          })}
        </ScrollView>

        {/* Input de mensagem */}
        {schedule.status !== 'DONE' && schedule.status !== 'CANCELLED' && (
          <View className="flex-row items-center px-4 py-3 bg-white border-t border-gray-100 gap-3">
            <TextInput
              className="flex-1 bg-gray-100 rounded-full px-4 py-2.5 text-gray-800"
              placeholder="Mensagem…"
              value={text}
              onChangeText={setText}
              onSubmitEditing={sendMessage}
              returnKeyType="send"
            />
            <TouchableOpacity
              onPress={sendMessage}
              disabled={sending || !text.trim()}
              className={`w-10 h-10 rounded-full items-center justify-center ${text.trim() ? 'bg-blue-600' : 'bg-gray-200'}`}
            >
              <Send size={18} color={text.trim() ? '#fff' : '#9ca3af'} />
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
