import { useCallback, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useFocusEffect } from 'expo-router'
import { ArrowLeft } from 'lucide-react-native'
import { api, getApiError } from '../../src/lib/api'
import { formatCurrency, formatDateShort } from '../../src/lib/utils'
import { Input } from '../../src/components/ui/Input'

const WITHDRAWAL_STATUS: Record<string, string> = {
  REQUESTED: 'Solicitado',
  PROCESSING: 'Em processamento',
  PAID: 'Pago',
  REJECTED: 'Rejeitado',
}

// Status semânticos alinhados aos tokens da Identidade Visual
const WITHDRAWAL_COLOR: Record<string, string> = {
  REQUESTED: '#D97706', // amber/warning
  PROCESSING: '#1D4ED8', // brand-700
  PAID: '#059669', // accent-600 (success)
  REJECTED: '#DC2626', // error
}

export default function CarteiraScreen() {
  const [balance, setBalance] = useState(0)
  const [creditBalance, setCreditBalance] = useState(0)
  const [pixKey, setPixKey] = useState('')
  const [pixKeyType, setPixKeyType] = useState('')
  const [withdrawals, setWithdrawals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [saqueValor, setSaqueValor] = useState('')
  const [saqueChave, setSaqueChave] = useState('')
  const [sacando, setSacando] = useState(false)

  async function load() {
    try {
      const r = await api.get('/payments/my-balance')
      const d = r.data.data
      setBalance(d.available_balance ?? 0)
      setPixKey(d.pix_key ?? '')
      setPixKeyType(d.pix_key_type ?? '')
      setWithdrawals(d.recent_withdrawals ?? [])
      // Créditos da plataforma (taxa devolvida, indicação) vêm do perfil
      try {
        const me = await api.get('/users/me')
        setCreditBalance(me.data.data?.credit_balance ?? 0)
      } catch {}
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useFocusEffect(useCallback(() => { load() }, []))

  async function solicitarSaque() {
    const valor = parseFloat(saqueValor.replace(',', '.'))
    if (isNaN(valor) || valor < 10) { Alert.alert('Valor inválido', 'Valor mínimo para saque: R$ 10,00'); return }
    if (valor > balance) { Alert.alert('Saldo insuficiente'); return }
    const chave = saqueChave || pixKey
    if (!chave) { Alert.alert('Informe uma chave PIX'); return }

    setSacando(true)
    try {
      await api.post('/payments/withdrawal', {
        amount: valor,
        pix_key: chave,
        pix_key_type: pixKeyType || 'EMAIL',
      })
      Alert.alert('Saque solicitado!', 'Processaremos em até 7 dias úteis.')
      setSaqueValor('')
      setSaqueChave('')
      await load()
    } catch (err) {
      Alert.alert('Erro', getApiError(err))
    } finally {
      setSacando(false)
    }
  }

  if (loading) return <ActivityIndicator className="flex-1 mt-20" color="#059669" />

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <View className="flex-row items-center px-4 py-3 bg-white border-b border-slate2-100">
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Voltar" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => router.back()} className="mr-3">
          <ArrowLeft size={22} color="#334155" />
        </TouchableOpacity>
        <Text className="font-display-bold text-lg text-slate2-900">Carteira</Text>
      </View>

      <ScrollView
        contentContainerClassName="p-5 gap-4 pb-10"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} />}
      >
        {/* Saldo */}
        <View className="bg-brand-700 rounded-2xl p-6 items-center">
          <Text className="font-sans text-brand-100 text-sm">Saldo disponível</Text>
          <Text className="font-display-extrabold text-white text-4xl mt-1">
            {formatCurrency(balance)}
          </Text>
          <Text className="font-sans text-brand-100 text-[11px] mt-2 text-center">
            Usado para taxas de conexão e boosts · sacável via PIX
          </Text>
        </View>

        {/* Créditos da plataforma (taxas devolvidas / indicações) */}
        {creditBalance > 0 && (
          <View className="bg-accent-50 border border-accent-100 rounded-2xl p-4 flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text className="font-display-semibold text-accent-700">Créditos da plataforma</Text>
              <Text className="font-sans text-xs text-accent-700/80 mt-0.5">
                Abatidos automaticamente na sua próxima taxa de conexão
              </Text>
            </View>
            <Text className="font-display-extrabold text-accent-700 text-xl">
              {formatCurrency(creditBalance)}
            </Text>
          </View>
        )}

        {/* Solicitar saque */}
        <View className="bg-white rounded-2xl p-4 border border-slate2-200">
          <Text className="font-display-semibold text-slate2-900 mb-3">
            Solicitar saque PIX
          </Text>
          <View className="flex-row items-center justify-between mb-1">
            <Text className="font-sans text-xs text-slate2-500">Valor (R$)</Text>
            {balance > 0 && (
              <TouchableOpacity onPress={() => setSaqueValor(balance.toFixed(2).replace('.', ','))}>
                <Text className="font-sans-semibold text-xs text-brand-700">Usar saldo total</Text>
              </TouchableOpacity>
            )}
          </View>
          <View className="mb-3">
            <Input
              placeholder="0,00"
              keyboardType="decimal-pad"
              value={saqueValor}
              onChangeText={setSaqueValor}
            />
          </View>
          <Text className="font-sans text-xs text-slate2-500 mb-1">
            Chave PIX {pixKey ? `(salva: ${pixKey})` : '(nenhuma cadastrada)'}
          </Text>
          <View className="mb-3">
            <Input
              placeholder={pixKey || 'CPF, e-mail, telefone ou chave aleatória'}
              value={saqueChave}
              onChangeText={setSaqueChave}
            />
          </View>
          <TouchableOpacity
            onPress={solicitarSaque}
            disabled={sacando || balance < 10}
            className={`rounded-xl py-3 items-center ${
              balance < 10 ? 'bg-slate2-300'
              : sacando ? 'bg-brand-400'
              : 'bg-brand-700'
            }`}
          >
            <Text className="font-display-bold text-white">
              {sacando ? 'Solicitando…' : 'Solicitar saque'}
            </Text>
          </TouchableOpacity>
          <Text className="font-sans text-xs text-slate2-400 mt-2 text-center">
            Saques são processados em até 7 dias úteis. Valor mínimo: R$ 10,00.
          </Text>
        </View>

        {/* Histórico */}
        {withdrawals.length > 0 && (
          <View className="bg-white rounded-2xl p-4 border border-slate2-200">
            <Text className="font-display-semibold text-slate2-900 mb-3">
              Últimos saques
            </Text>
            <View className="gap-3">
              {withdrawals.map((w: any) => (
                <View key={w.id} className="flex-row justify-between items-center py-2 border-b border-slate2-100">
                  <View>
                    <Text className="font-sans-medium text-slate2-900">{formatCurrency(w.amount)}</Text>
                    <Text className="font-sans text-xs text-slate2-400">{formatDateShort(w.created_at)}</Text>
                  </View>
                  <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: WITHDRAWAL_COLOR[w.status] + '20' }}>
                    <Text className="font-sans-semibold text-xs" style={{ color: WITHDRAWAL_COLOR[w.status] }}>
                      {WITHDRAWAL_STATUS[w.status]}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
