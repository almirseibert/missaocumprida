import { useEffect, useState } from 'react'
import { View, Text, ScrollView, Switch, ActivityIndicator, Alert, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { ArrowLeft, BellRing } from 'lucide-react-native'
import { api, getApiError } from '../../src/lib/api'
import { useAuthStore } from '../../src/store/auth'

const CHANNELS: Array<{ key: string; title: string; desc: string }> = [
  { key: 'new_proposal', title: 'Novas propostas', desc: 'Quando alguém envia uma proposta para seu pedido' },
  { key: 'proposal_update', title: 'Resposta a propostas', desc: 'Sua proposta foi aceita ou rejeitada' },
  { key: 'chat_message', title: 'Mensagens', desc: 'Novas mensagens no chat dos agendamentos' },
  { key: 'schedule_update', title: 'Agendamentos', desc: 'Check-in, conclusão e confirmação de serviço' },
  { key: 'payment', title: 'Pagamentos', desc: 'Confirmações e liberações de saldo' },
  { key: 'urgent_orders', title: 'Pedidos urgentes', desc: 'Alertas sonoros de oportunidades urgentes na sua região' },
  { key: 'referral', title: 'Indicações', desc: 'Quando alguém usa seu código de indicação' },
  { key: 'cross_sell', title: 'Sugestões', desc: 'Sugestões de serviços complementares' },
  { key: 'general', title: 'Geral', desc: 'Outros avisos do sistema' },
]

export default function NotificacoesConfigScreen() {
  const { user, setUser } = useAuthStore()
  const [prefs, setPrefs] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    const initial: Record<string, boolean> = {}
    const stored = (user?.notification_preferences ?? {}) as Record<string, boolean>
    CHANNELS.forEach((c) => {
      initial[c.key] = stored[c.key] !== false
    })
    setPrefs(initial)
  }, [user])

  async function toggle(key: string, value: boolean) {
    const next = { ...prefs, [key]: value }
    setPrefs(next)
    setLoading(true)
    try {
      const r = await api.put('/push/preferences', next)
      if (user) setUser({ ...user, notification_preferences: r.data.data.notification_preferences })
    } catch (err) {
      Alert.alert('Erro', getApiError(err))
      setPrefs(prefs)
    } finally {
      setLoading(false)
    }
  }

  async function sendTest() {
    setTesting(true)
    try {
      await api.post('/push/test', {})
      Alert.alert('Enviado', 'Você deve receber uma notificação em instantes.')
    } catch (err) {
      Alert.alert('Erro', getApiError(err))
    } finally {
      setTesting(false)
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-row items-center px-4 py-3 border-b border-neutral-200">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <ArrowLeft size={24} color="#111" />
        </TouchableOpacity>
        <Text className="text-lg font-bold flex-1">Notificações</Text>
        {loading && <ActivityIndicator />}
      </View>

      <ScrollView className="flex-1">
        <View className="p-4 bg-brand-50 mb-2 flex-row items-start">
          <BellRing size={20} color="#1D4ED8" />
          <Text className="ml-3 flex-1 text-sm text-brand-900">
            Escolha quais tipos de aviso você quer receber. Você pode mudar a qualquer momento.
          </Text>
        </View>

        {CHANNELS.map((c) => (
          <View key={c.key} className="flex-row items-center px-4 py-3 border-b border-neutral-100">
            <View className="flex-1 pr-3">
              <Text className="text-base font-semibold text-neutral-900">{c.title}</Text>
              <Text className="text-xs text-neutral-500 mt-0.5">{c.desc}</Text>
            </View>
            <Switch
              value={prefs[c.key] !== false}
              onValueChange={(v) => toggle(c.key, v)}
            />
          </View>
        ))}

        <TouchableOpacity
          onPress={sendTest}
          disabled={testing}
          className="m-4 bg-brand-600 rounded-xl py-3 items-center"
        >
          {testing
            ? <ActivityIndicator color="white" />
            : <Text className="text-white font-semibold">Enviar teste</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}
