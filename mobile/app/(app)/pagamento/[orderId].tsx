import { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Image,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Clipboard from 'expo-clipboard'
import { router, useLocalSearchParams } from 'expo-router'
import { ArrowLeft, Copy, CheckCircle } from 'lucide-react-native'
import { api, getApiError } from '../../../src/lib/api'
import { formatCurrency } from '../../../src/lib/utils'

export default function PagamentoScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>()
  const [checkout, setCheckout] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [polling, setPolling] = useState(false)
  const [paid, setPaid] = useState(false)

  useEffect(() => {
    api.get(`/payments/order/${orderId}`).then(r => {
      const status = r.data.data?.status
      if (status === 'PAID' || status === 'RELEASED') setPaid(true)
    }).catch(() => {})
  }, [orderId])

  useEffect(() => {
    if (!polling) return
    const interval = setInterval(async () => {
      try {
        const r = await api.get(`/payments/order/${orderId}`)
        const status = r.data.data?.status
        if (status === 'PAID' || status === 'RELEASED') {
          setPolling(false)
          setPaid(true)
        }
      } catch {}
    }, 5000)
    return () => clearInterval(interval)
  }, [polling, orderId])

  async function gerarPix() {
    setLoading(true)
    try {
      const { data } = await api.post('/payments/create-checkout', {
        order_id: orderId,
        method: 'pix',
      })
      if (data.data.already_paid) { setPaid(true); return }
      setCheckout(data.data)
      setPolling(true)
    } catch (err) {
      Alert.alert('Erro', getApiError(err))
    } finally {
      setLoading(false)
    }
  }

  function copyCode() {
    Clipboard.setStringAsync(checkout.pix_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  if (paid) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center px-8">
        <CheckCircle size={72} color="#059669" />
        <Text className="font-display-extrabold text-2xl text-slate2-900 mt-6 mb-2">
          Pagamento confirmado!
        </Text>
        <Text className="font-sans text-slate2-500 text-center mb-8 leading-relaxed">
          Seu pagamento foi recebido. O serviço está agendado.
        </Text>
        <TouchableOpacity
          onPress={() => router.replace(`/(app)/pedido/${orderId}`)}
          className="bg-brand-700 rounded-xl px-8 py-4"
        >
          <Text className="font-display-bold text-white">Ver pedido</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-slate2-50">
      {/* Header — segue mockup "Pagamento PIX" das Telas Mobile */}
      <View className="flex-row items-center px-4 py-3 bg-white border-b border-slate2-100">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <ArrowLeft size={22} color="#334155" />
        </TouchableOpacity>
        <Text className="font-display-bold text-lg text-slate2-900">
          Pagamento via PIX
        </Text>
      </View>

      <ScrollView contentContainerClassName="p-5 gap-5">
        {!checkout ? (
          <View className="gap-4">
            <View className="bg-white rounded-2xl p-5 items-center border border-slate2-200">
              <Text className="text-5xl mb-3">💰</Text>
              <Text className="font-display-extrabold text-lg text-slate2-900 mb-1">
                Pagamento seguro
              </Text>
              <Text className="font-sans text-slate2-500 text-center text-sm leading-relaxed">
                O valor fica retido até você confirmar a conclusão do serviço (escrow).
              </Text>
            </View>

            <View className="bg-accent-50 rounded-2xl p-4 border border-accent-100">
              <Text className="font-display-semibold text-accent-700 mb-1">
                PIX — Taxa 1%
              </Text>
              <Text className="font-sans text-accent-700 text-sm">
                Pagamento instantâneo via QR Code ou Copia e Cola
              </Text>
            </View>

            <TouchableOpacity
              onPress={gerarPix}
              disabled={loading}
              className={`rounded-2xl py-4 items-center ${
                loading ? 'bg-brand-400' : 'bg-brand-700'
              }`}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text className="font-display-bold text-white text-base">Gerar QR Code PIX</Text>
              }
            </TouchableOpacity>
          </View>
        ) : (
          <View className="gap-4">
            {/* Resumo de valores (alinhado ao header escuro do mockup web) */}
            <View className="bg-brand-700 rounded-2xl p-4">
              <Text className="font-display-bold text-[11px] text-white/60 uppercase tracking-wider mb-1">
                Pagamento do pedido
              </Text>
              <View className="flex-row justify-between items-end mt-2">
                <View>
                  <Text className="font-sans text-xs text-white/60 mb-0.5">
                    Total a pagar
                  </Text>
                  <Text className="font-display-extrabold text-3xl text-white">
                    {formatCurrency(checkout.amount)}
                  </Text>
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
                <Text className="font-sans text-sm text-slate2-500">Valor do serviço</Text>
                <Text className="font-sans-medium text-sm text-slate2-800">
                  {formatCurrency(checkout.base_amount)}
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="font-sans text-sm text-slate2-500">
                  Taxa PIX ({Math.round(checkout.gateway_fee_pct * 100)}%)
                </Text>
                <Text className="font-sans text-sm text-slate2-500">
                  + {formatCurrency(checkout.gateway_fee)}
                </Text>
              </View>
              <View className="flex-row justify-between border-t border-slate2-100 pt-2">
                <Text className="font-display-bold text-slate2-900">Total</Text>
                <Text className="font-display-bold text-brand-700 text-lg">
                  {formatCurrency(checkout.amount)}
                </Text>
              </View>
            </View>

            {/* QR Code */}
            <View className="bg-white rounded-2xl p-5 items-center gap-4 border border-slate2-200">
              <Text className="font-display-bold text-slate2-900">
                Escaneie o QR Code
              </Text>
              {checkout.pix_qr_base64 && (
                <View className="bg-slate2-50 border-2 border-slate2-200 rounded-2xl p-3">
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
                <Text className="font-display-bold text-slate2-900">
                  Ou use Copia e Cola
                </Text>
                <View className="bg-slate2-50 border border-slate2-200 rounded-xl p-3">
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
                  {copied
                    ? <CheckCircle size={16} color="#fff" />
                    : <Copy size={16} color="#fff" />
                  }
                  <Text className="font-display-bold text-white">
                    {copied ? 'Código copiado!' : 'Copiar código PIX'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Status */}
            <View className="bg-accent-50 border border-accent-100 rounded-xl px-3 py-2.5 flex-row items-center gap-2">
              <View className="w-2 h-2 rounded-full bg-accent-500" />
              <Text className="font-sans text-xs text-accent-700 flex-1 leading-relaxed">
                Aguardando confirmação do pagamento. Será confirmado automaticamente.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
