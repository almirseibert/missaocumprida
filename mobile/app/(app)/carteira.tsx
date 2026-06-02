import { useCallback, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  Alert, TextInput, ActivityIndicator, RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useFocusEffect } from 'expo-router'
import { ArrowLeft } from 'lucide-react-native'
import { api, getApiError } from '../../src/lib/api'
import { formatCurrency, formatDateShort } from '../../src/lib/utils'

const WITHDRAWAL_STATUS: Record<string, string> = {
  REQUESTED: 'Solicitado',
  PROCESSING: 'Em processamento',
  PAID: 'Pago',
  REJECTED: 'Rejeitado',
}

const WITHDRAWAL_COLOR: Record<string, string> = {
  REQUESTED: '#f59e0b',
  PROCESSING: '#3b82f6',
  PAID: '#10b981',
  REJECTED: '#ef4444',
}

export default function CarteiraScreen() {
  const [balance, setBalance] = useState(0)
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
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useFocusEffect(useCallback(() => { load() }, []))

  async function solicitarSaque() {
    const valor = parseFloat(saqueValor.replace(',', '.'))
    if (isNaN(valor) || valor <= 0) { Alert.alert('Valor inválido'); return }
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
      Alert.alert('Saque solicitado!', 'Processaremos em até 2 dias úteis.')
      setSaqueValor('')
      setSaqueChave('')
      await load()
    } catch (err) {
      Alert.alert('Erro', getApiError(err))
    } finally {
      setSacando(false)
    }
  }

  if (loading) return <ActivityIndicator className="flex-1 mt-20" color="#2563eb" />

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="flex-row items-center px-4 py-3 bg-white border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <ArrowLeft size={22} color="#374151" />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-gray-800">Carteira</Text>
      </View>

      <ScrollView
        contentContainerClassName="p-5 gap-4 pb-10"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} />}
      >
        {/* Saldo */}
        <View className="bg-blue-600 rounded-2xl p-6 items-center">
          <Text className="text-blue-200 text-sm">Saldo disponível</Text>
          <Text className="text-white text-4xl font-bold mt-1">{formatCurrency(balance)}</Text>
        </View>

        {/* Solicitar saque */}
        <View className="bg-white rounded-2xl p-4">
          <Text className="font-semibold text-gray-800 mb-3">Solicitar saque PIX</Text>
          <Text className="text-xs text-gray-500 mb-1">Valor (R$)</Text>
          <TextInput
            className="border border-gray-200 rounded-xl px-3 py-2.5 text-gray-800 mb-3"
            placeholder="0,00"
            keyboardType="decimal-pad"
            value={saqueValor}
            onChangeText={setSaqueValor}
          />
          <Text className="text-xs text-gray-500 mb-1">
            Chave PIX {pixKey ? `(salva: ${pixKey})` : '(nenhuma cadastrada)'}
          </Text>
          <TextInput
            className="border border-gray-200 rounded-xl px-3 py-2.5 text-gray-800 mb-3"
            placeholder={pixKey || 'CPF, e-mail, telefone ou chave aleatória'}
            value={saqueChave}
            onChangeText={setSaqueChave}
          />
          <TouchableOpacity
            onPress={solicitarSaque}
            disabled={sacando || balance <= 0}
            className={`rounded-xl py-3 items-center ${balance <= 0 ? 'bg-gray-300' : sacando ? 'bg-blue-400' : 'bg-blue-600'}`}
          >
            <Text className="text-white font-semibold">
              {sacando ? 'Solicitando…' : 'Solicitar saque'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Histórico */}
        {withdrawals.length > 0 && (
          <View className="bg-white rounded-2xl p-4">
            <Text className="font-semibold text-gray-800 mb-3">Últimos saques</Text>
            <View className="gap-3">
              {withdrawals.map((w: any) => (
                <View key={w.id} className="flex-row justify-between items-center py-2 border-b border-gray-50">
                  <View>
                    <Text className="font-medium text-gray-800">{formatCurrency(w.amount)}</Text>
                    <Text className="text-xs text-gray-400">{formatDateShort(w.created_at)}</Text>
                  </View>
                  <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: WITHDRAWAL_COLOR[w.status] + '20' }}>
                    <Text className="text-xs font-medium" style={{ color: WITHDRAWAL_COLOR[w.status] }}>
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
