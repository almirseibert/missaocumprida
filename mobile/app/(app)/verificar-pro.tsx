import { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  Alert, TextInput,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { ArrowLeft, ShieldCheck, Check, Star, TrendingUp, Award, X } from 'lucide-react-native'
import { api, getApiError } from '../../src/lib/api'

const BENEFITS = [
  { icon: ShieldCheck, title: 'Selo Verificado ✓ azul', desc: 'Em perfil, propostas e cards.' },
  { icon: Star, title: 'Boost grátis nível 1', desc: 'Destaque automático nas propostas.' },
  { icon: TrendingUp, title: '1.3x na busca', desc: 'Mais visibilidade orgânica.' },
  { icon: Award, title: 'Antecedentes verificados', desc: 'Mais confiança, mais contratações.' },
]

type Step = 'landing' | 'form' | 'subscribe'

export default function VerificarProScreen() {
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<any>(null)
  const [step, setStep] = useState<Step>('landing')
  const [fullName, setFullName] = useState('')
  const [docNumber, setDocNumber] = useState('')
  const [consent, setConsent] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const res = await api.get('/verification/me')
      setStatus(res.data.data)
      if (res.data.data?.verification_data && !res.data.data?.active_subscription) setStep('subscribe')
    } catch {} finally {
      setLoading(false)
    }
  }

  async function submitData() {
    if (!consent) return Alert.alert('Atenção', 'É necessário consentir com a checagem de antecedentes')
    setSubmitting(true)
    try {
      await api.post('/verification/start', {
        full_name: fullName, document_number: docNumber, background_check_consent: consent,
      })
      Alert.alert('Sucesso', 'Dados recebidos. Ative sua assinatura.')
      setStep('subscribe')
      await load()
    } catch (err) {
      Alert.alert('Erro', getApiError(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function activate() {
    setSubmitting(true)
    try {
      await api.post('/verification/subscribe', { payment_method: 'PIX' })
      Alert.alert('Sucesso', 'Selo Verificado Pro ativado!')
      await load()
    } catch (err) {
      Alert.alert('Erro', getApiError(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function cancel() {
    Alert.alert('Cancelar Verificado Pro?', 'O selo será removido imediatamente.', [
      { text: 'Não', style: 'cancel' },
      {
        text: 'Cancelar assinatura', style: 'destructive',
        onPress: async () => {
          try { await api.post('/verification/cancel', {}); await load() }
          catch (err) { Alert.alert('Erro', getApiError(err)) }
        },
      },
    ])
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-slate2-50 items-center justify-center">
        <ActivityIndicator color="#1D4ED8" />
      </SafeAreaView>
    )
  }

  const isPro = status?.is_verified_pro && status?.active_subscription

  return (
    <SafeAreaView className="flex-1 bg-slate2-50" edges={['top']}>
      <View className="flex-row items-center px-4 py-3 bg-white border-b border-slate2-100 gap-2">
        <TouchableOpacity onPress={() => router.back()} className="p-1">
          <ArrowLeft size={22} color="#0F172A" />
        </TouchableOpacity>
        <ShieldCheck size={20} color="#2563EB" />
        <Text className="text-lg font-semibold text-slate2-900">Verificado Pro</Text>
      </View>

      <ScrollView className="flex-1 p-4">
        <View className="items-center py-4">
          <View className="w-20 h-20 rounded-full bg-blue-600 items-center justify-center mb-3">
            <ShieldCheck size={48} color="#fff" />
          </View>
          <Text className="text-2xl font-bold text-slate2-900">Profissional Verificado</Text>
          <Text className="text-sm text-slate2-600 mt-1">Conquiste mais clientes</Text>
          <Text className="text-2xl font-bold text-blue-600 mt-2">
            R$ 29,90<Text className="text-sm text-slate2-500">/mês</Text>
          </Text>
        </View>

        {isPro ? (
          <View className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-4 mb-4 flex-row items-center gap-3">
            <ShieldCheck size={40} color="#059669" />
            <View className="flex-1">
              <Text className="font-bold text-emerald-900">Você é Verificado Pro ✓</Text>
              <Text className="text-xs text-emerald-700">
                Ativo até {new Date(status.active_subscription.current_period_end).toLocaleDateString('pt-BR')}
              </Text>
            </View>
            <TouchableOpacity onPress={cancel} disabled={submitting} className="p-2">
              <X size={20} color="#E11D48" />
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View className="bg-white rounded-2xl p-4 mb-4">
              <Text className="font-bold mb-3 text-slate2-900">Benefícios inclusos</Text>
              {BENEFITS.map((b, i) => (
                <View key={i} className="flex-row items-start gap-3 mb-3">
                  <View className="w-10 h-10 rounded-full bg-blue-100 items-center justify-center">
                    <b.icon size={20} color="#1D4ED8" />
                  </View>
                  <View className="flex-1">
                    <Text className="font-semibold text-sm text-slate2-900">{b.title}</Text>
                    <Text className="text-xs text-slate2-600">{b.desc}</Text>
                  </View>
                </View>
              ))}
            </View>

            {step === 'landing' && (
              <TouchableOpacity onPress={() => setStep('form')} className="bg-blue-600 py-4 rounded-2xl items-center">
                <Text className="text-white font-bold text-base">Quero ser Verificado Pro</Text>
              </TouchableOpacity>
            )}

            {step === 'form' && (
              <View className="bg-white rounded-2xl p-4 space-y-3">
                <Text className="font-bold text-slate2-900">Dados para verificação</Text>
                <View>
                  <Text className="text-xs text-slate2-600 mb-1">Nome completo</Text>
                  <TextInput
                    value={fullName}
                    onChangeText={setFullName}
                    className="border border-slate2-200 rounded-xl px-3 py-2.5 bg-white"
                  />
                </View>
                <View>
                  <Text className="text-xs text-slate2-600 mb-1">CPF</Text>
                  <TextInput
                    value={docNumber}
                    onChangeText={setDocNumber}
                    keyboardType="numeric"
                    placeholder="000.000.000-00"
                    className="border border-slate2-200 rounded-xl px-3 py-2.5 bg-white"
                  />
                </View>
                <TouchableOpacity onPress={() => setConsent(!consent)} className="flex-row items-start gap-2 mt-2">
                  <View className={`w-5 h-5 rounded border-2 items-center justify-center ${consent ? 'bg-blue-600 border-blue-600' : 'border-slate2-300'}`}>
                    {consent && <Text className="text-white text-xs">✓</Text>}
                  </View>
                  <Text className="text-sm text-slate2-700 flex-1">
                    Autorizo consultar meus antecedentes cíveis e criminais.
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={submitData}
                  disabled={submitting || !fullName || !docNumber}
                  className="bg-blue-600 py-3 rounded-xl items-center mt-3 disabled:opacity-50"
                >
                  {submitting ? <ActivityIndicator color="#fff" /> : (
                    <Text className="text-white font-bold">Enviar dados</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {step === 'subscribe' && (
              <View className="bg-white rounded-2xl p-4 items-center space-y-3">
                <Check size={40} color="#059669" />
                <Text className="font-bold text-slate2-900">Dados recebidos!</Text>
                <Text className="text-sm text-slate2-600 text-center">
                  Ative agora sua assinatura mensal de R$ 29,90.
                </Text>
                <TouchableOpacity
                  onPress={activate}
                  disabled={submitting}
                  className="bg-blue-600 py-4 rounded-2xl items-center w-full"
                >
                  {submitting ? <ActivityIndicator color="#fff" /> : (
                    <Text className="text-white font-bold">Ativar — R$ 29,90/mês</Text>
                  )}
                </TouchableOpacity>
                <Text className="text-[11px] text-slate2-500 text-center">
                  Cobrança mensal. Cancele a qualquer momento.
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
