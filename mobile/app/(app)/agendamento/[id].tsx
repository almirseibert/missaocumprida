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
import { useChatSocket, ChatMessage } from '../../../src/hooks/useChatSocket'
import { CrossSellSuggestions } from '../../../src/components/CrossSellSuggestions'
import { MakeRecurringButton } from '../../../src/components/MakeRecurringButton'

export default function AgendamentoDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { user } = useAuthStore()
  const [schedule, setSchedule] = useState<Schedule | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<ScrollView>(null)
  const [otherTyping, setOtherTyping] = useState(false)
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Chat em tempo real
  const socket = useChatSocket({
    scheduleId: id as string,
    onNewMessage: (m: ChatMessage) => {
      setMessages((prev) => prev.some((x) => x.id === m.id) ? prev : [...prev, m as unknown as Message])
      setTimeout(() => scrollRef.current?.scrollToEnd(), 50)
    },
    onTyping: (data) => {
      if (data.userId === user?.id) return
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
      setOtherTyping(data.typing)
      if (data.typing) typingTimerRef.current = setTimeout(() => setOtherTyping(false), 4000)
    },
  })

  useEffect(() => {
    load()
    // Polling como fallback (mais lento que antes: 15s)
    const interval = setInterval(loadMessages, 15000)
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
    const content = text.trim()
    try {
      if (socket.connected) {
        const sent = await socket.sendMessage(content)
        setMessages((prev) => prev.some((x) => x.id === sent.id) ? prev : [...prev, sent as unknown as Message])
      } else {
        await api.post(`/schedules/${id}/messages`, { content })
        await loadMessages()
      }
      setText('')
      socket.setTyping(false)
      setTimeout(() => scrollRef.current?.scrollToEnd(), 100)
    } catch (err) {
      Alert.alert('Erro', getApiError(err))
    } finally {
      setSending(false)
    }
  }

  function onChangeText(v: string) {
    setText(v)
    socket.setTyping(v.length > 0)
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

  if (loading) return <ActivityIndicator className="flex-1 mt-20" color="#1D4ED8" />
  if (!schedule) return null

  const isProvider = user?.id === schedule.provider_id
  const isClient = user?.id === schedule.client_id

  return (
    <SafeAreaView className="flex-1 bg-slate2-50">
      {/* Header — segue mockup "Chat / Agendamento" das Telas Mobile */}
      <View className="flex-row items-center px-4 py-3 bg-white border-b border-slate2-100">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <ArrowLeft size={22} color="#334155" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="font-display-bold text-slate2-900" numberOfLines={1}>
            {schedule.order?.title ?? 'Agendamento'}
          </Text>
          <Text className="font-sans text-xs text-slate2-500">
            {SCHEDULE_STATUS_LABEL[schedule.status]} · {formatDate(schedule.scheduled_at)}
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
          <View className="bg-white rounded-2xl p-4 mb-2 border border-slate2-200">
            <View className="flex-row justify-between">
              <Text className="font-sans text-sm text-slate2-500">Prestador</Text>
              <Text className="font-sans-medium text-sm text-slate2-800">
                {schedule.provider?.name}
              </Text>
            </View>
            <View className="flex-row justify-between mt-1">
              <Text className="font-sans text-sm text-slate2-500">Cliente</Text>
              <Text className="font-sans-medium text-sm text-slate2-800">
                {schedule.client?.name}
              </Text>
            </View>
            {isClient && (schedule.status === 'DONE' || (schedule.order as any)?.status === 'RATED') && schedule.order_id && (
              <View className="mt-3 gap-3">
                <MakeRecurringButton schedule={schedule} />
                <CrossSellSuggestions orderId={schedule.order_id} />
              </View>
            )}
            {schedule.order?.provider_amount && (
              <View className="flex-row justify-between mt-1">
                <Text className="font-sans text-sm text-slate2-500">
                  Valor (prestador recebe)
                </Text>
                <Text className="font-display-semibold text-sm text-accent-600">
                  {formatCurrency(schedule.order.provider_amount)}
                </Text>
              </View>
            )}
          </View>

          {/* Ações — botões coloridos conforme estado do fluxo */}
          {schedule.status === 'CONFIRMED' && isProvider && (
            <TouchableOpacity
              onPress={() => doAction('checkin', 'Check-in')}
              className="bg-brand-700 rounded-xl py-3 items-center mb-2"
            >
              <Text className="font-display-bold text-white">Fazer Check-in</Text>
            </TouchableOpacity>
          )}
          {schedule.status === 'IN_PROGRESS' && isProvider && (
            <TouchableOpacity
              onPress={() => doAction('complete', 'Marcar concluído')}
              className="bg-accent-600 rounded-xl py-3 items-center mb-2"
            >
              <Text className="font-display-bold text-white">
                ✓ Marcar como Concluído
              </Text>
            </TouchableOpacity>
          )}
          {schedule.status === 'DONE' && isClient && (
            <TouchableOpacity
              onPress={() => doAction('confirm', 'Confirmar conclusão')}
              className="bg-accent-600 rounded-xl py-3 items-center mb-2"
            >
              <Text className="font-display-bold text-white">
                ✓ Confirmar Conclusão e Liberar Pagamento
              </Text>
            </TouchableOpacity>
          )}

          {/* Mensagens — bolhas no padrão do mockup (brand-700 outgoing, branco c/ borda incoming) */}
          <Text className="font-sans text-xs text-slate2-400 text-center my-2">Chat</Text>
          {messages.map(msg => {
            const isMine = msg.sender_id === user?.id
            return (
              <View key={msg.id} className={`max-w-[80%] ${isMine ? 'self-end' : 'self-start'}`}>
                {!isMine && (
                  <Text className="font-sans text-xs text-slate2-400 mb-0.5 ml-1">
                    {msg.sender?.name}
                  </Text>
                )}
                <View
                  className={
                    isMine
                      ? 'bg-brand-700 px-3.5 py-2.5'
                      : 'bg-white border border-slate2-200 px-3.5 py-2.5'
                  }
                  style={{
                    borderRadius: 14,
                    borderTopLeftRadius: isMine ? 14 : 14,
                    borderTopRightRadius: isMine ? 14 : 14,
                    borderBottomLeftRadius: isMine ? 14 : 4,
                    borderBottomRightRadius: isMine ? 4 : 14,
                  }}
                >
                  <Text
                    className={`font-sans text-[13px] leading-[20px] ${
                      isMine ? 'text-white' : 'text-slate2-800'
                    }`}
                  >
                    {msg.content}
                  </Text>
                </View>
                <Text
                  className={`font-sans text-[10px] mt-1 ${
                    isMine ? 'text-right mr-1 text-slate2-400' : 'ml-1 text-slate2-400'
                  }`}
                >
                  {formatTime(msg.created_at)}
                </Text>
              </View>
            )
          })}
        </ScrollView>

        {otherTyping && (
          <Text className="text-xs text-slate2-500 italic px-4 py-1 bg-white">digitando...</Text>
        )}

        {socket.enabled && (
          <View className="flex-row items-center gap-1.5 px-4 py-1 bg-white">
            <View className={`w-1.5 h-1.5 rounded-full ${socket.connected ? 'bg-emerald-500' : 'bg-slate2-300'}`} />
            <Text className="text-[11px] text-slate2-400">
              {socket.connected ? 'Conectado em tempo real' : 'Reconectando...'}
            </Text>
          </View>
        )}

        {/* Input de mensagem */}
        {schedule.status !== 'DONE' && schedule.status !== 'CANCELLED' && (
          <View className="flex-row items-center px-3 py-2.5 bg-white border-t border-slate2-100 gap-2">
            <TextInput
              className="flex-1 bg-slate2-50 border border-slate2-200 rounded-xl px-4 py-2.5 text-slate2-900 font-sans"
              placeholder="Escreva uma mensagem..."
              placeholderTextColor="#94A3B8"
              value={text}
              onChangeText={onChangeText}
              onSubmitEditing={sendMessage}
              returnKeyType="send"
            />
            <TouchableOpacity
              onPress={sendMessage}
              disabled={sending || !text.trim()}
              className={`w-10 h-10 rounded-xl items-center justify-center ${
                text.trim() ? 'bg-brand-700' : 'bg-slate2-200'
              }`}
            >
              <Send size={18} color={text.trim() ? '#fff' : '#94A3B8'} />
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
