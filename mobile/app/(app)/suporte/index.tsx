import { useCallback, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useFocusEffect } from 'expo-router'
import { ArrowLeft, LifeBuoy, Plus, ChevronRight, MessageCircle, X, ChevronDown } from 'lucide-react-native'
import { api, getApiError } from '../../../src/lib/api'
import { formatRelative } from '../../../src/lib/utils'

type Category = 'PROBLEM' | 'IMPROVEMENT' | 'QUESTION' | 'PAYMENT' | 'ACCOUNT' | 'OTHER'
type Status = 'OPEN' | 'IN_PROGRESS' | 'WAITING_USER' | 'RESOLVED' | 'CLOSED'

interface Ticket {
  id: string
  subject: string
  category: Category
  status: Status
  unread_for_user: boolean
  created_at: string
  updated_at: string
}

const CATEGORY_LABEL: Record<Category, string> = {
  PROBLEM: 'Problema',
  IMPROVEMENT: 'Sugestão de melhoria',
  QUESTION: 'Dúvida',
  PAYMENT: 'Pagamento',
  ACCOUNT: 'Minha conta',
  OTHER: 'Outro assunto',
}
const STATUS_LABEL: Record<Status, string> = {
  OPEN: 'Aberto',
  IN_PROGRESS: 'Em andamento',
  WAITING_USER: 'Aguardando você',
  RESOLVED: 'Resolvido',
  CLOSED: 'Fechado',
}

export default function SuporteListScreen() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [creating, setCreating] = useState(false)
  const [subject, setSubject] = useState('')
  const [category, setCategory] = useState<Category>('OTHER')
  const [message, setMessage] = useState('')
  const [showCatPicker, setShowCatPicker] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const r = await api.get('/support/mine')
      const d = r.data.data
      setTickets(Array.isArray(d) ? d : [])
    } catch (e) {
      Alert.alert('Erro', getApiError(e))
    } finally { setLoading(false) }
  }
  useFocusEffect(useCallback(() => { load() }, []))

  const submit = async () => {
    if (subject.trim().length < 3) return Alert.alert('Assunto curto demais', 'Resuma em pelo menos 3 caracteres.')
    if (message.trim().length < 10) return Alert.alert('Descrição curta demais', 'Mín. 10 caracteres.')
    setCreating(true)
    try {
      await api.post('/support', { subject: subject.trim(), category, message: message.trim() })
      setShowForm(false); setSubject(''); setMessage(''); setCategory('OTHER')
      Alert.alert('Enviado', 'Sua mensagem foi enviada à equipe Missão Cumprida.')
      load()
    } catch (e) {
      Alert.alert('Erro', getApiError(e))
    } finally { setCreating(false) }
  }

  return (
    <SafeAreaView className="flex-1 bg-slate2-50">
      <View className="flex-row items-center gap-3 px-4 py-3 bg-white border-b border-slate2-200">
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft size={20} color="#475569" />
        </TouchableOpacity>
        <View className="flex-row items-center gap-2 flex-1">
          <LifeBuoy size={20} color="#1D4ED8" />
          <Text className="font-display-bold text-slate2-900 text-base">Falar com a equipe</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Text className="font-sans text-sm text-slate2-600">
          Reporte problemas, sugira melhorias ou tire dúvidas — a equipe responde por aqui.
        </Text>

        {!showForm && (
          <TouchableOpacity
            onPress={() => setShowForm(true)}
            className="bg-brand-600 rounded-xl py-3 flex-row items-center justify-center gap-2"
          >
            <Plus size={18} color="white" />
            <Text className="text-white font-display-semibold">Nova solicitação</Text>
          </TouchableOpacity>
        )}

        {showForm && (
          <View className="bg-white rounded-2xl p-4 border border-slate2-200 gap-3">
            <View className="flex-row items-center justify-between">
              <Text className="font-display-semibold text-slate2-900">Conte para a gente</Text>
              <TouchableOpacity onPress={() => setShowForm(false)}>
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View>
              <Text className="text-xs text-slate2-600 mb-1">Tipo de assunto</Text>
              <TouchableOpacity
                onPress={() => setShowCatPicker((v) => !v)}
                className="border border-slate2-300 rounded-xl px-3 py-3 flex-row items-center justify-between"
              >
                <Text className="text-slate2-900">{CATEGORY_LABEL[category]}</Text>
                <ChevronDown size={16} color="#64748B" />
              </TouchableOpacity>
              {showCatPicker && (
                <View className="border border-slate2-200 rounded-xl mt-2">
                  {(Object.entries(CATEGORY_LABEL) as [Category, string][]).map(([k, v]) => (
                    <TouchableOpacity
                      key={k}
                      onPress={() => { setCategory(k); setShowCatPicker(false) }}
                      className="px-3 py-2.5 border-b border-slate2-100"
                    >
                      <Text className={category === k ? 'text-brand-700 font-semibold' : 'text-slate2-800'}>{v}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            <View>
              <Text className="text-xs text-slate2-600 mb-1">Assunto</Text>
              <TextInput
                value={subject}
                onChangeText={setSubject}
                maxLength={140}
                placeholder="Resuma em uma frase"
                placeholderTextColor="#94A3B8"
                className="border border-slate2-300 rounded-xl px-3 py-3 text-slate2-900"
              />
            </View>

            <View>
              <Text className="text-xs text-slate2-600 mb-1">Descrição</Text>
              <TextInput
                value={message}
                onChangeText={setMessage}
                multiline
                numberOfLines={6}
                placeholder="Descreva com detalhes…"
                placeholderTextColor="#94A3B8"
                textAlignVertical="top"
                className="border border-slate2-300 rounded-xl px-3 py-3 text-slate2-900 min-h-[120px]"
              />
            </View>

            <TouchableOpacity
              onPress={submit}
              disabled={creating}
              className="bg-brand-600 rounded-xl py-3 items-center"
            >
              {creating ? <ActivityIndicator color="white" /> : <Text className="text-white font-display-semibold">Enviar</Text>}
            </TouchableOpacity>
          </View>
        )}

        <Text className="font-display-semibold text-slate2-900 mt-2">Minhas solicitações</Text>

        {loading ? (
          <ActivityIndicator color="#1D4ED8" />
        ) : tickets.length === 0 ? (
          <View className="bg-white border border-slate2-200 rounded-2xl p-6">
            <Text className="text-sm text-slate2-500 text-center">Você ainda não enviou nenhuma solicitação.</Text>
          </View>
        ) : (
          tickets.map((t) => (
            <TouchableOpacity
              key={t.id}
              onPress={() => router.push(`/(app)/suporte/${t.id}` as any)}
              className="bg-white border border-slate2-200 rounded-2xl p-4 flex-row items-start gap-3"
            >
              <View className="w-9 h-9 rounded-full bg-slate2-100 items-center justify-center">
                <MessageCircle size={16} color="#64748B" />
              </View>
              <View className="flex-1">
                <View className="flex-row items-center gap-2">
                  <Text className="font-display-semibold text-slate2-900 flex-shrink" numberOfLines={1}>{t.subject}</Text>
                  {t.unread_for_user && <View className="w-2 h-2 rounded-full bg-brand-500" />}
                </View>
                <Text className="text-xs text-slate2-500 mt-0.5">
                  {STATUS_LABEL[t.status]} · {CATEGORY_LABEL[t.category]} · {formatRelative(t.updated_at)}
                </Text>
              </View>
              <ChevronRight size={16} color="#94A3B8" />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
