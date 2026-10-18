import { useCallback, useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Image, Linking,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Clipboard from 'expo-clipboard'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { ArrowLeft, Copy, CheckCircle, Clock, Wallet, CreditCard } from 'lucide-react-native'
import { api, getApiError } from '../../../src/lib/api'
import { formatCurrency, formatDate, formatTime } from '../../../src/lib/utils'

/**
 * Taxa de Conexão (Remap 2.0) — tela do PRESTADOR.
 * Depois que o cliente paga a taxa dele, o prestador paga a sua (com saldo
 * interno ou Pix) dentro do prazo para liberar o contato e garantir o serviço.
 */
export default function TaxaConexaoPrestadorScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>()
  const [fees, setFees] = useState<any>(null)
  const [balance, setBalance] = useState<number>(0)
  const [checkout, setCheckout] = useState<any>(null)
  const [loading, setLoading] = useState<'' | 'balance' | 'pix' | 'card'>('')
  const [copied, setCopied] = useState(false)

  const loadAll = useCallback(async () => {
    try {
      const r = await api.get(`/payments/fees/order/${orderId}`)
      setFees(r.data.data)
    } catch {}
    try {
      const b = await api.get('/payments/my-balance')
      setBalance(b.data.data?.available_balance ?? 0)
    } catch {}
  }, [orderId])

  // A tela fica montada ao navegar (abas): ao trocar de pedido, descarta o
  // estado do anterior para não exibir o Pix/taxas de outro pedido.
  useEffect(() => {
    setFees(null)
    setCheckout(null)
    setCopied(false)
  }, [orderId])

  // Polling só enquanto a tela está em foco: acompanha o Pix/cartão e a
  // confirmação da outra parte sem gastar bateria/dados em segundo plano.
  useFocusEffect(useCallback(() => {
    loadAll()
    const interval = setInterval(loadAll, 5000)
    return () => clearInterval(interval)
  }, [loadAll]))

  const providerFee = fees?.provider_fee
  const clientPaid = fees?.client_fee && ['PAID', 'COVERED'].includes(fees.client_fee.status)
  const unlocked = !!fees?.contacts_unlocked
  const feePaid = providerFee && ['PAID', 'COVERED'].includes(providerFee.status)

  async function pagarComSaldo() {
    setLoading('balance')
    try {
      await api.post('/payments/fees/pay-with-balance', { order_id: orderId })
      await loadAll()
    } catch (err) {
      Alert.alert('Erro', getApiError(err))
    } finally {
      setLoading('')
    }
  }

  async function pagarComPix() {
    setLoading('pix')
    try {
      const { data } = await api.post('/payments/fees/checkout', {
        order_id: orderId,
        method: 'pix',
      })
      const d = data.data
      if (d.already_paid || d.covered_by_credit) { await loadAll(); return }
      setCheckout(d)
    } catch (err) {
      Alert.alert('Erro', getApiError(err))
    } finally {
      setLoading('')
    }
  }

  async function pagarComCartao() {
    setLoading('card')
    try {
      const { data } = await api.post('/payments/fees/checkout', {
        order_id: orderId,
        method: 'card',
      })
      const d = data.data
      if (d.already_paid || d.covered_by_credit) { await loadAll(); return }
      if (d.init_point) {
        // Checkout Pro do Mercado Pago no navegador; o polling detecta a confirmação
        await Linking.openURL(d.init_point)
      } else if (d.dev_mode) {
        Alert.alert(
          'Modo desenvolvimento',
          'Checkout de cartão simulado — confirme pelo botão de simulação ou pelo painel.',
        )
      }
    } catch (err) {
      Alert.alert('Erro', getApiError(err))
    } finally {
      setLoading('')
    }
  }

  function copyCode() {
    Clipboard.setStringAsync(checkout.pix_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  if (unlocked || feePaid) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center px-8">
        <CheckCircle size={72} color="#059669" />
        <Text className="font-display-extrabold text-2xl text-slate2-900 mt-6 mb-2">
          Serviço garantido!
        </Text>
        <Text className="font-sans text-slate2-500 text-center mb-8 leading-relaxed">
          Taxa confirmada. Os dados do cliente foram liberados — combine os
          detalhes e o pagamento do serviço diretamente com ele.
        </Text>
        <TouchableOpacity
          onPress={() => {
            if (fees?.schedule_id) router.replace(`/(app)/agendamento/${fees.schedule_id}`)
            else router.replace('/(app)/agendamentos')
          }}
          className="bg-accent-600 rounded-xl px-8 py-4"
        >
          <Text className="font-display-bold text-white">Ver agendamento</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <View className="flex-row items-center px-4 py-3 bg-white border-b border-slate2-100">
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Voltar" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => router.back()} className="mr-3">
          <ArrowLeft size={22} color="#334155" />
        </TouchableOpacity>
        <Text className="font-display-bold text-lg text-slate2-900">Confirmar serviço</Text>
      </View>

      <ScrollView contentContainerClassName="p-5 gap-4">
        {!clientPaid ? (
          <View className="bg-white rounded-2xl p-5 items-center border border-slate2-200">
            <Clock size={48} color="#2563EB" />
            <Text className="font-display-bold text-slate2-900 mt-3 mb-1">
              Aguardando o cliente
            </Text>
            <Text className="font-sans text-slate2-500 text-center text-sm leading-relaxed">
              O cliente aceitou sua proposta. Assim que ele pagar a taxa de
              conexão dele, você paga a sua e o contato é liberado.
            </Text>
          </View>
        ) : !checkout ? (
          <View className="gap-4">
            <View className="bg-white rounded-2xl p-5 items-center border border-slate2-200">
              <Text className="text-5xl mb-3">🚀</Text>
              <Text className="font-display-extrabold text-lg text-slate2-900 mb-1">
                O cliente já pagou — falta você!
              </Text>
              <Text className="font-sans text-slate2-500 text-center text-sm leading-relaxed">
                Pague sua taxa de conexão para receber o telefone e o endereço do
                cliente. O valor do serviço você recebe diretamente dele.
              </Text>
            </View>

            {providerFee && (
              <View className="bg-white rounded-2xl p-4 gap-2 border border-slate2-200">
                <View className="flex-row justify-between items-center">
                  <View className="flex-row items-center gap-2">
                    <Text className="font-sans text-sm text-slate2-500">
                      Sua taxa ({Math.round(providerFee.pct_applied * 100)}%)
                    </Text>
                    {providerFee.promo_active && (
                      <View className="bg-accent-50 rounded-full px-2 py-0.5">
                        <Text className="font-sans-semibold text-[10px] text-accent-700">PROMOÇÃO</Text>
                      </View>
                    )}
                  </View>
                  <View className="items-end">
                    {providerFee.promo_active && (
                      <Text
                        className="font-sans text-xs text-slate2-400"
                        style={{ textDecorationLine: 'line-through' }}
                      >
                        {Math.round(providerFee.regular_pct * 100)}% = {formatCurrency(providerFee.regular_amount)}
                      </Text>
                    )}
                    <Text className="font-display-bold text-accent-700 text-lg">
                      {formatCurrency(providerFee.base_amount)}
                    </Text>
                  </View>
                </View>
                {providerFee.expires_at && (
                  <View className="border-t border-slate2-100 pt-2">
                    <Text className="font-sans text-xs text-red-600">
                      ⏳ Prazo: {formatDate(providerFee.expires_at)} às {formatTime(providerFee.expires_at)} —
                      depois disso o pedido volta para a fila
                    </Text>
                  </View>
                )}
              </View>
            )}

            <TouchableOpacity
              onPress={pagarComSaldo}
              disabled={loading !== '' || !providerFee || balance < providerFee.base_amount}
              className={`rounded-2xl py-4 items-center flex-row justify-center gap-2 ${
                providerFee && balance >= providerFee.base_amount && loading === ''
                  ? 'bg-accent-600'
                  : 'bg-slate2-300'
              }`}
            >
              {loading === 'balance'
                ? <ActivityIndicator color="#fff" />
                : (
                  <>
                    <Wallet size={18} color="#fff" />
                    <Text className="font-display-bold text-white text-base">
                      Pagar com saldo ({formatCurrency(balance)})
                    </Text>
                  </>
                )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={pagarComPix}
              disabled={loading !== ''}
              className="rounded-2xl py-4 items-center border-2 border-accent-600 bg-white"
            >
              {loading === 'pix'
                ? <ActivityIndicator color="#059669" />
                : <Text className="font-display-bold text-accent-700 text-base">Pagar com Pix (+1%)</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity
              onPress={pagarComCartao}
              disabled={loading !== ''}
              accessibilityRole="button"
              accessibilityLabel="Pagar taxa com cartão"
              className="rounded-2xl py-4 items-center border-2 border-slate2-300 bg-white flex-row justify-center gap-2"
            >
              {loading === 'card'
                ? <ActivityIndicator color="#334155" />
                : (
                  <>
                    <CreditCard size={18} color="#334155" />
                    <Text className="font-display-bold text-slate2-700 text-base">Pagar com cartão (+4%)</Text>
                  </>
                )}
            </TouchableOpacity>
          </View>
        ) : (
          <View className="gap-4">
            <View className="bg-slate2-900 rounded-2xl p-4">
              <Text className="font-display-bold text-[11px] text-white/60 uppercase tracking-wider mb-1">
                Taxa de conexão
              </Text>
              <Text className="font-display-extrabold text-3xl text-white mt-1">
                {formatCurrency(checkout.amount)}
              </Text>
            </View>

            <View className="bg-white rounded-2xl p-5 items-center gap-4 border border-slate2-200">
              <Text className="font-display-bold text-slate2-900">Escaneie o QR Code</Text>
              {checkout.pix_qr_base64 && (
                <View className="bg-paper border-2 border-slate2-200 rounded-2xl p-3">
                  <Image
                    source={{ uri: `data:image/png;base64,${checkout.pix_qr_base64}` }}
                    className="w-48 h-48"
                  />
                </View>
              )}
              {checkout.dev_mode && (
                <View className="bg-amber-50 border border-amber-200 rounded-xl p-3 w-full">
                  <Text className="font-sans-medium text-amber-800 text-xs text-center">
                    ⚠ Modo desenvolvimento — QR Code fictício
                  </Text>
                </View>
              )}
            </View>

            {checkout.pix_code && (
              <View className="bg-white rounded-2xl p-4 gap-3 border border-slate2-200">
                <Text className="font-display-bold text-slate2-900">Ou use Copia e Cola</Text>
                <View className="bg-paper border border-slate2-200 rounded-xl p-3">
                  <Text
                    className="text-xs text-slate2-600"
                    style={{ fontFamily: 'monospace' }}
                    numberOfLines={3}
                  >
                    {checkout.pix_code}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={copyCode}
                  className={`flex-row items-center justify-center gap-2 rounded-xl py-3 ${
                    copied ? 'bg-accent-600' : 'bg-brand-700'
                  }`}
                >
                  {copied ? <CheckCircle size={16} color="#fff" /> : <Copy size={16} color="#fff" />}
                  <Text className="font-display-bold text-white">
                    {copied ? 'Código copiado!' : 'Copiar código PIX'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <View className="bg-accent-50 border border-accent-100 rounded-xl px-3 py-2.5 flex-row items-center gap-2">
              <View className="w-2 h-2 rounded-full bg-accent-500" />
              <Text className="font-sans text-xs text-accent-700 flex-1 leading-relaxed">
                Aguardando o pagamento. Assim que confirmar, o contato é liberado
                dos dois lados.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
