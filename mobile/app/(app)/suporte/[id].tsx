import { useCallback, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { ArrowLeft, Send, ShieldCheck } from 'lucide-react-native'
import { api, getApiError } from '../../../src/lib/api'
import { formatRelative } from '../../../src/lib/utils'

type Status = 'OPEN' | 'IN_PROGRESS' | 'WAITING_USER' | 'RESOLVED' | 'CLOSED'

interface Message {
  id: string
  content: string
  from_admin: boolean
  created_at: string
  sender?: { id: string; name: string; avatar?: string; role: string }
}
interface Ticket {
  id: string
  subject: string
  status: Status
  created_at: string
  messages: Message[]
}

const STATUS_LABEL: Record<Status, string> = {
  OPEN: 'Aberto', IN_PROGRESS: 'Em andamento', WAITING_USER: 'Aguardando você', RESOLVED: 'Resolvido', CLOSED: 'Fechado',
}

export default function SuporteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [loading, setLoading] = useState(true)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)

  const load = async () => {
    try {
      const r = await api.get(`/support/${id}`)
      setTicket(r.data.data)
    } catch (e) {
      Alert.alert('Erro', getApiError(e))
      router.back()
    } finally { setLoading(false) }
  }
  useFocusEffect(useCallback(() => { load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]))

  const send = async () => {
    if (reply.trim().length === 0) return
    setSending(true)
    try {
      await api.post(`/support/${id}/reply`, { content: reply.trim() })
      setReply('')
      await load()
    } catch (e) {
      Alert.alert('Erro', getApiError(e))
    } finally { setSending(false) }
  }

  if (loading || !ticket) {
    return (
      <SafeAreaView className="flex-1 bg-slate2-50 items-center justify-center">
        <ActivityIndicator color="#1D4ED8" />
      </SafeAreaView>
    )
  }

  const closed = ticket.status === 'CLOSED'

  return (
    <SafeAreaView className="flex-1 bg-slate2-50">
      <View className="flex-row items-center gap-3 px-4 py-3 bg-white border-b border-slate2-200">
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft size={20} color="#475569" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="font-display-bold text-slate2-900 text-base" numberOfLines={1}>{ticket.subject}</Text>
          <Text className="text-xs text-slate2-500">{STATUS_LABEL[ticket.status]} · {formatRelative(ticket.created_at)}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
        {ticket.messages.map((m) => (
          <View key={m.id} className={`flex-row gap-2 ${m.from_admin ? '' : 'flex-row-reverse'}`}>
            <View className="w-8 h-8 rounded-full bg-brand-100 items-center justify-center">
              {m.from_admin
                ? <ShieldCheck size={14} color="#1D4ED8" />
                : <Text className="text-xs font-bold text-brand-700">{(m.sender?.name ?? 'V')[0]}</Text>}
            </View>
            <View className={`max-w-[80%] rounded-2xl px-3 py-2 ${m.from_admin ? 'bg-brand-50 border border-brand-100' : 'bg-white border border-slate2-200'}`}>
              <Text className="text-[11px] text-slate2-500 mb-0.5">
                {m.from_admin ? 'Equipe Missão Cumprida' : (m.sender?.name ?? 'Você')} · {formatRelative(m.created_at)}
              </Text>
              <Text className="text-sm text-slate2-800">{m.content}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      {closed ? (
        <View className="p-4 bg-slate2-50 border-t border-slate2-200">
          <Text className="text-sm text-slate2-500 text-center">Este ticket foi fechado.</Text>
        </View>
      ) : (
        <View className="p-3 bg-white border-t border-slate2-200 flex-row items-end gap-2">
          <TextInput
            value={reply}
            onChangeText={setReply}
            multiline
            placeholder="Escreva sua resposta…"
            placeholderTextColor="#94A3B8"
            className="flex-1 border border-slate2-300 rounded-xl px-3 py-2 text-slate2-900 max-h-[120px]"
          />
          <TouchableOpacity
            onPress={send}
            disabled={sending || reply.trim().length === 0}
            className="bg-brand-600 rounded-xl px-4 py-3 items-center justify-center disabled:opacity-50"
          >
            {sending ? <ActivityIndicator color="white" /> : <Send size={18} color="white" />}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  )
}
