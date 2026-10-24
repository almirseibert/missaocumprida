import { useCallback, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Linking } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useFocusEffect } from 'expo-router'
import { ArrowLeft, ShieldCheck, Check, AlertTriangle, RefreshCw } from 'lucide-react-native'
import type { PurchasesPackage } from 'react-native-purchases'
import { api, getApiError } from '../../src/lib/api'
import { formatCurrency, formatDateShort } from '../../src/lib/utils'
import { useAuthStore } from '../../src/store/auth'
import {
  getCurrentOffering, purchasePackage, isPurchasesReady, restorePurchases,
  loginPurchases, getManagementUrl,
} from '../../src/lib/purchases'

/**
 * Assinaturas — central da assinatura Pro (clientes e prestadores).
 * Compra pela Google Play (RevenueCat). Depois de comprar/restaurar, o app
 * pede ao servidor para conferir a assinatura direto na RevenueCat
 * (/verification/sync) — o selo nunca é concedido só pelo que o aparelho diz.
 */
type ProStatus = {
  role: string
  pro: {
    active: boolean
    expires_at: string | null
    source: 'PLAY' | 'ADMIN' | null
    will_renew: boolean
    billing_issue: boolean
  }
  eligible: boolean
  ineligible_reason: string | null
  monthly_value: number
  benefits: { client: string[]; provider: string[] }
}

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL || 'https://missaocumprida-front.oehpg2.easypanel.host'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export default function AssinaturasScreen() {
  const user = useAuthStore((s) => s.user)
  const fetchMe = useAuthStore((s) => s.fetchMe)
  const [status, setStatus] = useState<ProStatus | null>(null)
  const [pkg, setPkg] = useState<PurchasesPackage | null>(null)
  const [storeError, setStoreError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await api.get('/verification/me')
      setStatus(res.data.data)
    } catch (err) {
      Alert.alert('Erro', getApiError(err))
    } finally {
      setLoading(false)
    }
    if (!isPurchasesReady()) {
      setStoreError('A compra pela Google Play não está disponível nesta versão do app.')
      return
    }
    try {
      const offering = await getCurrentOffering()
      const p = offering?.monthly ?? offering?.availablePackages?.[0] ?? null
      setPkg(p)
      setStoreError(p ? null : 'O plano ainda não está disponível na loja. Tente novamente mais tarde.')
    } catch (err: any) {
      setStoreError(`Não foi possível carregar o plano da loja${err?.code ? ` (código ${err.code})` : ''}.`)
    }
  }, [])

  useFocusEffect(useCallback(() => { load() }, [load]))

  /** Confere com a RevenueCat pelo servidor (tenta algumas vezes: a loja pode demorar). */
  async function syncWithStore(expectActive: boolean): Promise<boolean> {
    for (let i = 0; i < 4; i++) {
      try {
        const r = await api.post('/verification/sync')
        setStatus(r.data.data)
        if (!expectActive || r.data.data?.pro?.active) return !!r.data.data?.pro?.active
      } catch { /* tenta de novo */ }
      await sleep(2000)
    }
    return false
  }

  async function subscribe() {
    if (!pkg) { Alert.alert('Indisponível', storeError ?? 'Plano indisponível.'); return }
    if (!user?.id) return
    setBusy('buy')
    try {
      // A compra precisa ficar no id do nosso cadastro, senão o selo não é concedido
      if (!(await loginPurchases(user.id))) {
        Alert.alert('Erro', 'Não foi possível conectar à loja. Verifique sua internet e tente novamente.')
        return
      }
      await purchasePackage(pkg)
      const active = await syncWithStore(true)
      await fetchMe?.()
      Alert.alert(
        active ? 'Assinatura ativa ✓' : 'Compra recebida',
        active ? 'Seu selo Pro já está ativo.' : 'Estamos confirmando com a Google Play. Em alguns minutos o selo aparece — toque em "Atualizar status".',
      )
    } catch (err: any) {
      if (!err?.userCancelled) Alert.alert('Erro', err?.message || getApiError(err))
    } finally {
      setBusy(null)
    }
  }

  async function restore() {
    if (!isPurchasesReady()) { Alert.alert('Indisponível', 'A loja não está disponível nesta versão do app.'); return }
    setBusy('restore')
    try {
      if (user?.id) await loginPurchases(user.id)
      await restorePurchases()
      const active = await syncWithStore(true)
      await fetchMe?.()
      Alert.alert(active ? 'Assinatura restaurada ✓' : 'Nenhuma assinatura ativa encontrada nesta conta da Google Play.')
    } catch (err: any) {
      Alert.alert('Erro', err?.message || getApiError(err))
    } finally {
      setBusy(null)
    }
  }

  async function refresh() {
    setBusy('sync')
    try {
      await syncWithStore(false)
      await fetchMe?.()
    } finally {
      setBusy(null)
    }
  }

  async function manage() {
    try { await Linking.openURL(await getManagementUrl()) }
    catch { Alert.alert('Erro', 'Não foi possível abrir a Google Play.') }
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-paper items-center justify-center">
        <ActivityIndicator color="#059669" />
      </SafeAreaView>
    )
  }

  const isProvider = status?.role === 'PROVIDER' || status?.role === 'BOTH' || user?.role === 'PROVIDER' || user?.role === 'BOTH'
  const pro = status?.pro
  const benefits = (isProvider ? status?.benefits.provider : status?.benefits.client) ?? []
  const price = pkg?.product?.priceString ?? (status ? `${formatCurrency(status.monthly_value)}` : '')

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top']}>
      <View className="flex-row items-center px-4 py-3 bg-white border-b border-slate2-100 gap-2">
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Voltar" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => router.back()} className="p-1">
          <ArrowLeft size={22} color="#0F172A" />
        </TouchableOpacity>
        <ShieldCheck size={20} color="#2563EB" />
        <Text className="font-display-bold text-lg text-slate2-900">Assinatura Pro</Text>
      </View>

      <ScrollView contentContainerClassName="p-5 gap-4">
        {/* Status */}
        <View className={`rounded-2xl p-4 border ${pro?.active ? 'border-blue-200 bg-blue-50' : 'border-slate2-200 bg-white'}`}>
          {pro?.active ? (
            <>
              <View className="flex-row items-center gap-2">
                <Check size={18} color="#1D4ED8" />
                <Text className="font-display-bold text-blue-900">Você é Pro</Text>
              </View>
              <Text className="font-sans text-sm text-blue-800 mt-1">
                {pro.source === 'ADMIN'
                  ? `Selo concedido pela equipe${pro.expires_at ? ` até ${formatDateShort(pro.expires_at)}` : ''}.`
                  : pro.will_renew
                    ? `Renova automaticamente${pro.expires_at ? ` em ${formatDateShort(pro.expires_at)}` : ''}.`
                    : `Renovação cancelada — ativo até ${pro.expires_at ? formatDateShort(pro.expires_at) : 'o fim do período pago'}.`}
              </Text>
              {pro.billing_issue && (
                <View className="flex-row gap-2 mt-2">
                  <AlertTriangle size={16} color="#B45309" />
                  <Text className="font-sans text-sm text-amber-800 flex-1">
                    Não conseguimos cobrar a renovação. Atualize a forma de pagamento na Google Play.
                  </Text>
                </View>
              )}
            </>
          ) : (
            <>
              <Text className="font-display-bold text-slate2-900">Você ainda não é Pro</Text>
              <Text className="font-sans text-sm text-slate2-600 mt-1">{price}/mês · cancele quando quiser</Text>
            </>
          )}
        </View>

        {/* Benefícios */}
        <View className="bg-white rounded-2xl p-4 border border-slate2-200 gap-2.5">
          <Text className="font-display-bold text-slate2-900">O que você ganha</Text>
          {benefits.map((b) => (
            <View key={b} className="flex-row gap-2">
              <Check size={16} color="#059669" />
              <Text className="font-sans text-sm text-slate2-700 flex-1">{b}</Text>
            </View>
          ))}
          {!isProvider && (
            <Text className="font-sans text-xs text-slate2-500 mt-1">
              Também oferece serviços? Ative o perfil de prestador no seu perfil para ter os benefícios de profissional.
            </Text>
          )}
        </View>

        {/* Ações */}
        {!pro?.active && status && !status.eligible && (
          <TouchableOpacity onPress={() => router.push('/(app)/verificacao' as any)} className="rounded-xl p-3 border border-amber-200 bg-amber-50">
            <Text className="font-sans text-sm text-amber-800">
              {status.ineligible_reason ?? 'Verifique sua conta antes de assinar.'} Toque para enviar seus documentos.
            </Text>
          </TouchableOpacity>
        )}

        {!pro?.active && (
          <TouchableOpacity
            onPress={subscribe}
            disabled={!!busy || !pkg || (status ? !status.eligible : true)}
            className={`rounded-2xl py-4 items-center ${!busy && pkg && status?.eligible ? 'bg-blue-600' : 'bg-slate2-300'}`}
          >
            {busy === 'buy' ? <ActivityIndicator color="#fff" /> : (
              <Text className="font-display-bold text-white text-base">Assinar por {price}/mês</Text>
            )}
          </TouchableOpacity>
        )}
        {storeError && !pro?.active && (
          <Text className="font-sans text-xs text-slate2-500 text-center">{storeError}</Text>
        )}

        <View className="flex-row gap-2.5">
          <TouchableOpacity onPress={restore} disabled={!!busy} className="flex-1 rounded-xl py-3 items-center border border-slate2-300 bg-white">
            {busy === 'restore' ? <ActivityIndicator color="#059669" /> : <Text className="font-display-semibold text-slate2-800 text-sm">Restaurar compras</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={refresh} disabled={!!busy} className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl py-3 border border-slate2-300 bg-white">
            {busy === 'sync' ? <ActivityIndicator color="#059669" /> : (
              <>
                <RefreshCw size={14} color="#334155" />
                <Text className="font-display-semibold text-slate2-800 text-sm">Atualizar status</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {pro?.active && pro.source !== 'ADMIN' && (
          <TouchableOpacity onPress={manage} className="rounded-xl py-3 items-center border border-red-200 bg-white">
            <Text className="font-display-semibold text-red-600 text-sm">Gerenciar ou cancelar na Google Play</Text>
          </TouchableOpacity>
        )}

        <Text className="font-sans text-xs text-slate2-400 leading-relaxed">
          Assinatura mensal renovada automaticamente pela Google Play até você cancelar. O cancelamento vale ao fim do período pago.
          Ao assinar você concorda com os{' '}
          <Text className="underline" onPress={() => Linking.openURL(`${WEB_URL}/termos`)}>Termos de Uso</Text>
          {' '}e a{' '}
          <Text className="underline" onPress={() => Linking.openURL(`${WEB_URL}/privacidade`)}>Política de Privacidade</Text>.
        </Text>
      </ScrollView>
    </SafeAreaView>
  )
}
