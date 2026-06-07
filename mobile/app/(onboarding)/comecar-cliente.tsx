import { useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  Alert, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Search, ShoppingBag, Star, MapPin, Check } from 'lucide-react-native'
import { useAuthStore } from '../../src/store/auth'
import { api, getApiError } from '../../src/lib/api'

const TOTAL = 3

export default function ComecarClienteScreen() {
  const { user, setUser } = useAuthStore()
  const [step, setStep] = useState((user?.onboarding_state?.client?.step as number) ?? 0)
  const [loading, setLoading] = useState(false)

  async function patchState(next: number, completed = false, data?: Record<string, unknown>) {
    const r = await api.put('/users/me/onboarding', { flow: 'client', step: next, completed, data })
    if (user) setUser({ ...user, onboarding_state: r.data.data.onboarding_state })
  }

  async function handleSkip() {
    setLoading(true)
    try { await patchState(step, true, { skipped: true }) } catch {}
    setLoading(false)
    router.replace('/(app)/home')
  }

  async function advance() {
    setLoading(true)
    try {
      if (step >= TOTAL - 1) {
        await patchState(TOTAL, true)
        router.replace('/(app)/home')
      } else {
        await patchState(step + 1)
        setStep(step + 1)
      }
    } catch (e) {
      Alert.alert('Erro', getApiError(e))
    } finally {
      setLoading(false)
    }
  }

  async function useLocation() {
    setLoading(true)
    try {
      // expo-location não está garantidamente importável aqui; pedimos via web fallback de placeholder.
      // Tentativa progressiva com expo-location dinâmico:
      let Location: any = null
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        Location = require('expo-location')
      } catch {}
      if (!Location) {
        Alert.alert('Localização', 'Pulamos por enquanto — você pode liberar depois em Perfil.')
        return advance()
      }
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permissão negada')
        return setLoading(false)
      }
      const pos = await Location.getCurrentPositionAsync({})
      await api.put('/users/me', { latitude: pos.coords.latitude, longitude: pos.coords.longitude })
      await advance()
    } catch (e) {
      Alert.alert('Erro', getApiError(e))
      setLoading(false)
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <Progress current={step + 1} total={TOTAL} />

        {step === 0 && (
          <Shell
            icon={<ShoppingBag color="#1D4ED8" size={28} />}
            title="Como funciona"
            subtitle="3 passos para resolver seu serviço."
          >
            <Item icon={<Search size={18} color="#1D4ED8" />} title="1. Peça" desc="Escolha o serviço e descreva o que precisa." />
            <Item icon={<ShoppingBag size={18} color="#1D4ED8" />} title="2. Receba propostas" desc="Prestadores próximos enviam orçamentos." />
            <Item icon={<Star size={18} color="#1D4ED8" />} title="3. Avalie" desc="Pague seguro pelo app e avalie no fim." />
            <PrimaryButton onPress={advance} loading={loading}>Continuar</PrimaryButton>
          </Shell>
        )}

        {step === 1 && (
          <Shell
            icon={<MapPin color="#1D4ED8" size={28} />}
            title="Sua localização"
            subtitle="Para encontrar prestadores perto."
          >
            <Text className="text-sm text-neutral-600 mb-4">
              Libere a localização para o app recomendar profissionais qualificados no seu raio.
            </Text>
            <PrimaryButton onPress={useLocation} loading={loading}>Usar minha localização</PrimaryButton>
            <SecondaryButton onPress={advance}>Pular</SecondaryButton>
          </Shell>
        )}

        {step === 2 && (
          <Shell
            icon={<Check color="#059669" size={28} />}
            title="Pronto!"
            subtitle="Você já pode pedir seu primeiro serviço."
          >
            <Text className="text-sm text-neutral-600 mb-6">
              Comece pela tela inicial — ali estão todas as categorias.
            </Text>
            <PrimaryButton onPress={advance} loading={loading}>Ir para o início</PrimaryButton>
          </Shell>
        )}

        <TouchableOpacity onPress={handleSkip} disabled={loading} className="mt-6 self-center">
          <Text className="text-sm text-neutral-500">Pular por enquanto</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

function Progress({ current, total }: { current: number; total: number }) {
  const pct = Math.min(100, Math.round((current / total) * 100))
  return (
    <View className="mb-6">
      <View className="flex-row justify-between mb-2">
        <Text className="text-xs text-neutral-500">Passo {Math.min(current, total)} de {total}</Text>
        <Text className="text-xs text-neutral-500">{pct}%</Text>
      </View>
      <View className="h-2 bg-neutral-200 rounded-full overflow-hidden">
        <View style={{ width: `${pct}%` }} className="h-full bg-brand-600" />
      </View>
    </View>
  )
}

function Shell({ icon, title, subtitle, children }: any) {
  return (
    <View className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm">
      <View className="flex-row items-center gap-3 mb-3">
        <View className="w-12 h-12 rounded-full bg-brand-50 items-center justify-center">
          {icon}
        </View>
        <View className="flex-1">
          <Text className="text-lg font-bold">{title}</Text>
          <Text className="text-sm text-neutral-600">{subtitle}</Text>
        </View>
      </View>
      {children}
    </View>
  )
}

function Item({ icon, title, desc }: any) {
  return (
    <View className="flex-row items-start gap-3 mb-3">
      <View className="w-8 h-8 rounded-full bg-brand-100 items-center justify-center">{icon}</View>
      <View className="flex-1">
        <Text className="font-semibold text-sm">{title}</Text>
        <Text className="text-xs text-neutral-600">{desc}</Text>
      </View>
    </View>
  )
}

function PrimaryButton({ onPress, loading, children }: any) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={loading}
      className="bg-brand-600 rounded-xl py-3 items-center mt-2"
    >
      {loading ? <ActivityIndicator color="white" /> : <Text className="text-white font-semibold">{children}</Text>}
    </TouchableOpacity>
  )
}

function SecondaryButton({ onPress, children }: any) {
  return (
    <TouchableOpacity onPress={onPress} className="border border-neutral-300 rounded-xl py-3 items-center mt-2">
      <Text className="text-neutral-700 font-semibold">{children}</Text>
    </TouchableOpacity>
  )
}
