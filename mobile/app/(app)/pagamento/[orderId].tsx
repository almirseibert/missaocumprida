import { useCallback, useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Image, Linking,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Clipboard from 'expo-clipboard'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { ArrowLeft, Copy, CheckCircle, Clock, ShieldCheck, CreditCard } from 'lucide-react-native'
import { api, getApiError } from '../../../src/lib/api'
import { formatCurrency, formatDate, formatTime } from '../../../src/lib/utils'

/**
 * Taxa de Conexão (Remap 2.0) — tela do CLIENTE.
 * O cliente paga só a taxa (ex.: de 10% por 5% na promoção de lançamento).
 * O serviço em si é pago diretamente ao profissional, fora do app.
 * Depois do pagamento, aguarda o prestador pagar a taxa dele para liberar
 * telefone/endereço/chat.
 */
export default function TaxaConexaoClienteScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>()
  const [fees, setFees] = useState<any>(null)
  const [checkout, setCheckout] = useState<any>(null)
  const [loading, setLoading] = useState<'' | 'pix' | 'card'>('')
  const [copied, setCopied] = useState(false)

  const loadFees = useCallback(async () => {
    try {
      const r = await api.get(`/payments/fees/order/${orderId}`)
      setFees(r.data.data)
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
    loadFees()
    const interval = setInterval(loadFees, 5000)
    return () => clearInterval(interval)
  }, [loadFees]))

  const clientFee = fees?.client_fee
  const providerFee = fees?.provider_fee
  const unlocked = !!fees?.contacts_unlocked
  const clientPaid = clientFee && ['PAID', 'COVERED'].includes(clientFee.status)

  async function gerarPix() {
    setLoading('pix')
    try {
      const { data } = await api.post('/payments/fees/checkout', {
        order_id: orderId,
        method: 'pix',
      })
      const d = data.data
      if (d.already_paid || d.covered_by_credit) {
        await loadFees()
        return
      }
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
      if (d.already_paid || d.covered_by_credit) {
        await loadFees()
        return
      }
      if (d.init_point) {
        // Checkout Pro do Mercado Pago no navegador; o polling detecta a confirmação
        await Linking.openURL(d.init_point)
      } else if (d.dev_mode) {
        Alert.alert(
          'Modo desenvolvimento',
          'Checkout de cartão simulado — confirme pela simulação ou pelo painel.',
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

  // ---- Contato liberado: missão cumprida ----
  if (unlocked) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center px-8">
        <CheckCircle size={72} color="#059669" />
        <Text className="font-display-extrabold text-2xl text-slate2-900 mt-6 mb-2">
          Contato liberado!
        </Text>
        <Text className="font-sans text-slate2-500 text-center mb-8 leading-relaxed">
          O profissional confirmou. Telefone, endereço e chat já estão disponíveis.
          O pagamento do serviço você combina diretamente com ele.
        </Text>
        <TouchableOpacity
          onPress={() => router.replace(`/(app)/pedido/${orderId}`)}
          className="bg-accent-600 rounded-xl px-8 py-4"
        >
          <Text className="font-display-bold text-white">Ver pedido</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  // ---- Cliente pagou; aguardando o prestador pagar a taxa dele ----
  if (clientPaid) {
    return (
      <SafeAreaView className="flex-1 bg-paper">
        <View className="flex-row items-center px-4 py-3 bg-white border-b border-slate2-100">
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Voltar" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => router.back()} className="mr-3">
            <ArrowLeft size={22} color="#334155" />
          </TouchableOpacity>
          <Text className="font-display-bold text-lg text-slate2-900">Taxa de Conexão</Text>
        </View>
        <View className="flex-1 items-center justify-center px-8">
          <Clock size={64} color="#2563EB" />
          <Text className="font-display-extrabold text-xl text-slate2-900 mt-6 mb-2 text-center">
            Aguardando o profissional
          </Text>
          <Text className="font-sans text-slate2-500 text-center leading-relaxed mb-4">
            Sua taxa foi confirmada. Agora o profissional precisa pagar a taxa dele
            para o contato ser liberado dos dois lados.
          </Text>
          {fees?.provider_fee_due_at && (
            <View className="bg-white border border-slate2-200 rounded-xl px-4 py-3 mb-4">
              <Text className="font-sans text-xs text-slate2-500 text-center">
                Prazo do profissional:{' '}
                <Text className="font-sans-semibold text-slate2-800">
                  {formatDate(fees.provider_fee_due_at)} às {formatTime(fees.provider_fee_due_at)}
                </Text>
              </Text>
            </View>
          )}
          <View className="bg-trust-50 border border-trust-100 rounded-xl px-4 py-3">
            <Text className="font-sans text-xs text-trust-700 text-center leading-relaxed">
              🛡️ Garantia de Conexão: se ele não confirmar no prazo, sua taxa volta
              como crédito na hora e você escolhe outra proposta.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    )
  }

  const promo = clientFee?.promo_active
  const feeLabel = clientFee ? `${Math.round(clientFee.pct_applied * 100)}%` : ''
  const regularLabel = clientFee ? `${Math.round(clientFee.regular_pct * 100)}%` : ''

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <View className="flex-row items-center px-4 py-3 bg-white border-b border-slate2-100">
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Voltar" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => router.back()} className="mr-3">
          <ArrowLeft size={22} color="#334155" />
        </TouchableOpacity>
        <Text className="font-display-bold text-lg text-slate2-900">Taxa de Conexão</Text>
      </View>

      <ScrollView contentContainerClassName="p-5 gap-5">
        {!checkout ? (
          <View className="gap-4">
            <View className="bg-white rounded-2xl p-5 items-center border border-slate2-200">
              <Text className="text-5xl mb-3">🤝</Text>
              <Text className="font-display-extrabold text-lg text-slate2-900 mb-1">
                Falta pouco para conectar!
              </Text>
              <Text className="font-sans text-slate2-500 text-center text-sm leading-relaxed">
                Você paga apenas a taxa de conexão para liberar o contato do
                profissional. O serviço é pago diretamente a ele, do jeito que
                vocês combinarem.
              </Text>
            </View>

            {/* Breakdown com promo riscada */}
            {clientFee && (
              <View className="bg-white rounded-2xl p-4 gap-2 border border-slate2-200">
                <View className="flex-row justify-between">
                  <Text className="font-sans text-sm text-slate2-500">Valor da proposta</Text>
                  <Text className="font-sans-medium text-sm text-slate2-800">
                    {formatCurrency(fees.final_price ?? 0)}
                  </Text>
                </View>
                <View className="flex-row justify-between items-center">
                  <View className="flex-row items-center gap-2">
                    <Text className="font-sans text-sm text-slate2-500">
                      Taxa de conexão ({feeLabel})
                    </Text>
                    {promo && (
                      <View className="bg-accent-50 rounded-full px-2 py-0.5">
                        <Text className="font-sans-semibold text-[10px] text-accent-700">PROMOÇÃO</Text>
                      </View>
                    )}
                  </View>
                  <View className="items-end">
                    {promo && (
                      <Text
                        className="font-sans text-xs text-slate2-400"
                        style={{ textDecorationLine: 'line-through' }}
                      >
                        {regularLabel} = {formatCurrency(clientFee.regular_amount)}
                      </Text>
                    )}
                    <Text className="font-display-bold text-accent-700">
                      {formatCurrency(clientFee.base_amount)}
                    </Text>
                  </View>
                </View>
                <View className="flex-row justify-between border-t border-slate2-100 pt-2">
                  <Text className="font-sans text-xs text-slate2-400">
                    + repasse do meio de pagamento (1% Pix · 4% cartão) · crédito é abatido automaticamente
                  </Text>
                </View>
              </View>
            )}

            <View className="bg-trust-50 rounded-2xl p-4 border border-trust-100 flex-row gap-3 items-start">
              <ShieldCheck size={18} color="#1D4ED8" />
              <Text className="font-sans text-trust-700 text-xs flex-1 leading-relaxed">
                Garantia de Conexão: se o profissional cancelar ou não confirmar,
                sua taxa volta como crédito automaticamente.
              </Text>
            </View>

            <TouchableOpacity
              onPress={gerarPix}
              disabled={loading !== ''}
              className={`rounded-2xl py-4 items-center ${loading !== '' ? 'bg-accent-400' : 'bg-accent-600'}`}
            >
              {loading === 'pix'
                ? <ActivityIndicator color="#fff" />
                : <Text className="font-display-bold text-white text-base">Pagar taxa com Pix (+1%)</Text>
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
            {/* Resumo */}
            <View className="bg-slate2-900 rounded-2xl p-4">
              <Text className="font-display-bold text-[11px] text-white/60 uppercase tracking-wider mb-1">
                Taxa de conexão
              </Text>
              <View className="flex-row justify-between items-end mt-2">
                <View>
                  <Text className="font-sans text-xs text-white/60 mb-0.5">Total a pagar</Text>
                  <Text className="font-display-extrabold text-3xl text-white">
                    {formatCurrency(checkout.amount)}
                  </Text>
                  {checkout.promo_active && (
                    <Text
                      className="font-sans text-xs text-white/50 mt-1"
                      style={{ textDecorationLine: 'line-through' }}
                    >
                      sem promoção: {formatCurrency(checkout.regular_amount)}
                    </Text>
                  )}
                </View>
                <View className="bg-accent-600 rounded-full px-3 py-1 flex-row items-center gap-1.5">
                  <View className="w-1.5 h-1.5 rounded-full bg-white/80" />
                  <Text className="font-sans-semibold text-xs text-white">PIX</Text>
                </View>
              </View>
            </View>

            {/* Breakdown */}
            <View className="bg-white rounded-2xl p-4 gap-2 border border-slate2-200">
              <View className="flex-row justify-between">
                <Text className="font-sans text-sm text-slate2-500">Taxa de conexão</Text>
                <Text className="font-sans-medium text-sm text-slate2-800">
                  {formatCurrency(checkout.base_amount)}
                </Text>
              </View>
              {checkout.credit_used > 0 && (
                <View className="flex-row justify-between">
                  <Text className="font-sans text-sm text-accent-700">Crédito aplicado</Text>
                  <Text className="font-sans-medium text-sm text-accent-700">
                    − {formatCurrency(checkout.credit_used)}
                  </Text>
                </View>
              )}
              <View className="flex-row justify-between">
                <Text className="font-sans text-sm text-slate2-500">Repasse Pix (1%)</Text>
                <Text className="font-sans text-sm text-slate2-500">
                  + {formatCurrency(checkout.surcharge_amount)}
                </Text>
              </View>
              <View className="flex-row justify-between border-t border-slate2-100 pt-2">
                <Text className="font-display-bold text-slate2-900">Total</Text>
                <Text className="font-display-bold text-accent-700 text-lg">
                  {formatCurrency(checkout.amount)}
                </Text>
              </View>
            </View>

            {/* QR Code */}
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

            {/* Copia e cola */}
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
                Aguardando o pagamento. Assim que confirmar, avisamos o profissional
                para ele pagar a taxa dele e liberar o contato.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
