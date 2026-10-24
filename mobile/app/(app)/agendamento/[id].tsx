import { useEffect, useRef, useState } from 'react'
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Image, Linking,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { ArrowLeft, Send, Phone, Navigation } from 'lucide-react-native'
import * as Location from 'expo-location'
import { PhotoStrip } from '../../../src/components/PhotoStrip'
import { PickedPhoto, photosFormData } from '../../../src/lib/photos'
import { usePublicConfig } from '../../../src/lib/config'
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
  const config = usePublicConfig()
  // Check-in / conclusão: fotos (ao menos 1) + localização do aparelho
  const [stagePhotos, setStagePhotos] = useState<PickedPhoto[]>([])
  const [stageOpen, setStageOpen] = useState<'checkin' | 'complete' | null>(null)
  const [stageSending, setStageSending] = useState(false)

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

  async function currentCoords(): Promise<{ lat: number; lng: number } | null> {
    try {
      const perm = await Location.requestForegroundPermissionsAsync()
      if (!perm.granted) return null
      const pos = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 12000)),
      ])
      return pos ? { lat: pos.coords.latitude, lng: pos.coords.longitude } : null
    } catch {
      return null
    }
  }

  // Check-in / conclusão com fotos (prova do serviço) e GPS do aparelho
  async function sendStage() {
    if (!stageOpen) return
    if (stagePhotos.length === 0) {
      Alert.alert('Foto obrigatória', 'Tire ao menos uma foto do serviço para registrar esta etapa.')
      return
    }
    setStageSending(true)
    try {
      const coords = await currentCoords()
      const fd = photosFormData(stagePhotos, 'photos', coords ? { lat: String(coords.lat), lng: String(coords.lng) } : undefined)
      await api.post(`/schedules/${id}/${stageOpen}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      })
      const label = stageOpen === 'checkin' ? 'Check-in realizado' : 'Serviço marcado como concluído'
      setStageOpen(null)
      setStagePhotos([])
      await load()
      Alert.alert('Pronto', label)
    } catch (err) {
      Alert.alert('Erro', getApiError(err))
    } finally {
      setStageSending(false)
    }
  }

  async function confirmService() {
    Alert.alert('Confirmar conclusão', 'Confirma que o serviço foi realizado?', [
      { text: 'Voltar', style: 'cancel' },
      {
        text: 'Confirmar',
        onPress: async () => {
          try {
            await api.post(`/schedules/${id}/confirm`)
            await load()
            Alert.alert('Serviço confirmado', 'Agora avalie o profissional.')
          } catch (err) {
            Alert.alert('Erro', getApiError(err))
          }
        },
      },
    ])
  }

  function cancelSchedule(unlocked: boolean) {
    const warning = unlocked
      ? 'Os contatos já foram liberados. Pelos Termos de Uso, cancelar agora leva ao BANIMENTO da sua conta e a taxa da outra parte volta como crédito para ela.'
      : 'A conexão ainda não foi concluída: cancelar agora não tem penalidade. Taxas já pagas voltam como crédito.'
    Alert.alert('Cancelar agendamento', warning, [
      { text: 'Voltar', style: 'cancel' },
      {
        text: unlocked ? 'Cancelar mesmo assim' : 'Cancelar',
        style: 'destructive',
        onPress: async () => {
          try {
            const r = await api.post(`/schedules/${id}/cancel`)
            Alert.alert('Agendamento cancelado', r.data.message ?? '')
            router.back()
          } catch (err) {
            Alert.alert('Erro', getApiError(err))
          }
        },
      },
    ])
  }

  function reportNoShow() {
    Alert.alert(
      'O profissional não compareceu?',
      'Sua taxa volta como crédito, o pedido reabre para outras propostas e o profissional é suspenso para análise.',
      [
        { text: 'Voltar', style: 'cancel' },
        {
          text: 'Confirmar',
          style: 'destructive',
          onPress: async () => {
            try {
              const r = await api.post(`/schedules/${id}/report-no-show`)
              Alert.alert('Registrado', r.data.message ?? '')
              router.back()
            } catch (err) {
              Alert.alert('Erro', getApiError(err))
            }
          },
        },
      ],
    )
  }

  if (loading) return <ActivityIndicator className="flex-1 mt-20" color="#059669" />
  if (!schedule) return null

  const isProvider = user?.id === schedule.provider_id
  const isClient = user?.id === schedule.client_id
  const counterpart = isClient ? schedule.provider : schedule.client
  const counterpartPhone = (counterpart as any)?.phone as string | null | undefined
  const order = schedule.order as any
  const unlocked = !!counterpartPhone || ['SCHEDULED', 'IN_PROGRESS', 'DONE', 'RATED'].includes(order?.status)
  const servicePhotos = ((schedule as any).service_photos ?? []) as Array<{ id: string; stage: string; url: string }>
  const awaitingConfirm = isClient && schedule.status === 'IN_PROGRESS' && !!(schedule as any).done_at
  const scheduledPassed = new Date(schedule.scheduled_at).getTime() < Date.now()
  const addressLine = order
    ? [[order.address, order.address_number].filter(Boolean).join(', '), order.address_complement, order.neighborhood, order.city]
        .filter(Boolean).join(' · ')
    : ''

  return (
    <SafeAreaView className="flex-1 bg-paper">
      {/* Header — segue mockup "Chat / Agendamento" das Telas Mobile */}
      <View className="flex-row items-center px-4 py-3 bg-white border-b border-slate2-100">
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Voltar" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => router.back()} className="mr-3">
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
                {config.recurring_enabled && <MakeRecurringButton schedule={schedule} />}
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

          {/* Contato e local (liberados após as duas taxas) */}
          {unlocked && (
            <View className="bg-white rounded-2xl p-4 mb-2 border border-brand-200 gap-2.5">
              <Text className="font-display-bold text-slate2-900">
                {isClient ? 'Contato do profissional' : 'Contato e local do cliente'}
              </Text>
              {isProvider && addressLine ? <Text className="font-sans text-sm text-slate2-700">📍 {addressLine}</Text> : null}
              {counterpartPhone ? (
                <View className="flex-row gap-2.5">
                  <TouchableOpacity onPress={() => Linking.openURL(`tel:${counterpartPhone}`)} className="flex-1 flex-row items-center justify-center gap-2 py-3 rounded-xl bg-brand-700">
                    <Phone size={16} color="#fff" />
                    <Text className="font-display-bold text-white text-sm">Ligar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => Linking.openURL(`https://wa.me/55${counterpartPhone.replace(/\D/g, '').replace(/^55/, '')}`)}
                    className="flex-1 items-center justify-center py-3 rounded-xl border-2 border-brand-600"
                  >
                    <Text className="font-display-bold text-brand-700 text-sm">WhatsApp</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
              {isProvider && order?.latitude != null && order?.longitude != null && (
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

          {/* Fotos do serviço (check-in e conclusão) */}
          {servicePhotos.length > 0 && (
            <View className="bg-white rounded-2xl p-4 mb-2 border border-slate2-200 gap-2">
              <Text className="font-display-bold text-slate2-900">Fotos do serviço</Text>
              {(['CHECKIN', 'COMPLETION'] as const).map((stage) => {
                const list = servicePhotos.filter((p) => p.stage === stage)
                if (!list.length) return null
                return (
                  <View key={stage}>
                    <Text className="font-sans text-xs text-slate2-500 mb-1.5">{stage === 'CHECKIN' ? 'Início (check-in)' : 'Conclusão'}</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
                      {list.map((p) => (
                        <TouchableOpacity key={p.id} onPress={() => Linking.openURL(p.url)}>
                          <Image source={{ uri: p.url }} style={{ width: 80, height: 80, borderRadius: 10 }} />
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )
              })}
            </View>
          )}

          {/* Check-in / conclusão com fotos */}
          {isProvider && ((schedule.status === 'CONFIRMED' && unlocked) || (schedule.status === 'IN_PROGRESS' && !(schedule as any).done_at)) && (
            stageOpen ? (
              <View className="bg-white rounded-2xl p-4 mb-2 border-2 border-brand-600 gap-3">
                <Text className="font-display-bold text-slate2-900">
                  {stageOpen === 'checkin' ? 'Check-in: fotos do início do serviço' : 'Conclusão: fotos do serviço pronto'}
                </Text>
                <Text className="font-sans text-xs text-slate2-500">
                  Tire ao menos 1 foto (até {config.max_service_photos}). A localização do celular é registrada junto, como prova.
                </Text>
                <PhotoStrip photos={stagePhotos} onChange={setStagePhotos} max={config.max_service_photos} />
                <View className="flex-row gap-2.5">
                  <TouchableOpacity
                    onPress={sendStage}
                    disabled={stageSending}
                    className={`flex-1 rounded-xl py-3 items-center ${stageSending ? 'bg-brand-400' : 'bg-brand-700'}`}
                  >
                    <Text className="font-display-bold text-white">{stageSending ? 'Enviando…' : 'Enviar'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setStageOpen(null); setStagePhotos([]) }} className="px-4 rounded-xl py-3 items-center bg-slate2-100">
                    <Text className="font-display-semibold text-slate2-700">Voltar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => setStageOpen(schedule.status === 'CONFIRMED' ? 'checkin' : 'complete')}
                className={`${schedule.status === 'CONFIRMED' ? 'bg-brand-700' : 'bg-accent-600'} rounded-xl py-3 items-center mb-2`}
              >
                <Text className="font-display-bold text-white">
                  {schedule.status === 'CONFIRMED' ? 'Fazer check-in (com fotos)' : '✓ Marcar como concluído (com fotos)'}
                </Text>
              </TouchableOpacity>
            )
          )}
          {isProvider && schedule.status === 'IN_PROGRESS' && !!(schedule as any).done_at && (
            <Text className="font-sans text-sm text-slate2-600 text-center mb-2">Aguardando o cliente confirmar a conclusão.</Text>
          )}
          {awaitingConfirm && (
            <TouchableOpacity onPress={confirmService} className="bg-accent-600 rounded-xl py-3 items-center mb-2">
              <Text className="font-display-bold text-white">✓ Confirmar que o serviço foi feito</Text>
            </TouchableOpacity>
          )}
          {schedule.status === 'CONFIRMED' && (
            <View className="flex-row gap-2.5 mb-2">
              {isClient && unlocked && scheduledPassed && (
                <TouchableOpacity onPress={reportNoShow} className="flex-1 rounded-xl py-2.5 items-center border border-amber-300 bg-amber-50">
                  <Text className="font-display-semibold text-amber-800 text-sm">Profissional não veio</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => cancelSchedule(unlocked)} className="flex-1 rounded-xl py-2.5 items-center border border-red-200 bg-white">
                <Text className="font-display-semibold text-red-600 text-sm">Cancelar agendamento</Text>
              </TouchableOpacity>
            </View>
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
              className="flex-1 bg-paper border border-slate2-200 rounded-xl px-4 py-2.5 text-slate2-900 font-sans"
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
