import { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, SafeAreaView, Clipboard, Image,
} from 'react-native'
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

  // Verificar se já tem pagamento
  useEffect(() => {
    api.get(`/payments/order/${orderId}`).then(r => {
      const status = r.data.data?.status
      if (status === 'PAID' || status === 'RELEASED') setPaid(true)
    }).catch(() => {})
  }, [orderId])

  // Polling após gerar PIX
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
    Clipboard.setString(checkout.pix_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  if (paid) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center px-8">
        <CheckCircle size={72} color="#10b981" />
        <Text className="text-2xl font-bold text-gray-800 mt-6 mb-2">Pagamento confirmado!</Text>
        <Text className="text-gray-500 text-center mb-8">
          Seu pagamento foi recebido. O serviço está agendado.
        </Text>
        <TouchableOpacity
          onPress={() => router.replace(`/(app)/pedido/${orderId}`)}
          className="bg-blue-600 rounded-xl px-8 py-4"
        >
          <Text className="text-white font-semibold">Ver pedido</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="flex-row items-center px-4 py-3 bg-white border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <ArrowLeft size={22} color="#374151" />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-gray-800">Pagamento via PIX</Text>
      </View>

      <ScrollView contentContainerClassName="p-5 gap-5">
        {!checkout ? (
          <View className="gap-4">
            <View className="bg-white rounded-2xl p-5 items-center">
              <Text className="text-5xl mb-3">💰</Text>
              <Text className="text-lg font-bold text-gray-800 mb-1">Pagamento seguro</Text>
              <Text className="text-gray-500 text-center text-sm">
                O valor fica retido até você confirmar a conclusão do serviço (escrow).
              </Text>
            </View>

            <View className="bg-green-50 rounded-2xl p-4">
              <Text className="font-semibold text-green-800 mb-1">PIX — Taxa 1%</Text>
              <Text className="text-green-700 text-sm">Pagamento instantâneo via QR Code ou Copia e Cola</Text>
            </View>

            <TouchableOpacity
              onPress={gerarPix}
              disabled={loading}
              className={`rounded-2xl py-4 items-center ${loading ? 'bg-green-400' : 'bg-green-600'}`}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text className="text-white font-bold text-base">Gerar QR Code PIX</Text>
              }
            </TouchableOpacity>
          </View>
        ) : (
          <View className="gap-4">
            {/* Resumo de valores */}
            <View className="bg-white rounded-2xl p-4 gap-2">
              <View className="flex-row justify-between">
                <Text className="text-gray-500 text-sm">Valor do serviço</Text>
                <Text className="text-gray-800 text-sm">{formatCurrency(checkout.base_amount)}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-gray-500 text-sm">
                  Taxa PIX ({Math.round(checkout.gateway_fee_pct * 100)}%)
                </Text>
                <Text className="text-gray-500 text-sm">+ {formatCurrency(checkout.gateway_fee)}</Text>
              </View>
              <View className="flex-row justify-between border-t border-gray-100 pt-2">
                <Text className="font-bold text-gray-800">Total</Text>
                <Text className="font-bold text-green-600 text-lg">{formatCurrency(checkout.amount)}</Text>
              </View>
            </View>

            {/* QR Code */}
            <View className="bg-white rounded-2xl p-5 items-center gap-4">
              <Text className="font-semibold text-gray-800">Escaneie o QR Code</Text>
              {checkout.pix_qr_base64 && (
                <Image
                  source={{ uri: `data:image/png;base64,${checkout.pix_qr_base64}` }}
                  className="w-52 h-52 rounded-xl"
                />
              )}
              {checkout.dev_mode && (
                <View className="bg-yellow-50 rounded-xl p-3 w-full">
                  <Text className="text-yellow-800 text-xs text-center font-medium">
                    ⚠ Modo desenvolvimento — QR Code fictício
                  </Text>
                </View>
              )}
            </View>

            {/* Copia e cola */}
            {checkout.pix_code && (
              <View className="bg-white rounded-2xl p-4 gap-3">
                <Text className="font-semibold text-gray-800">Ou use Copia e Cola</Text>
                <View className="bg-gray-50 rounded-xl p-3">
                  <Text className="text-xs text-gray-500 font-mono" numberOfLines={3}>
                    {checkout.pix_code}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={copyCode}
                  className={`flex-row items-center justify-center gap-2 rounded-xl py-3 ${copied ? 'bg-green-600' : 'bg-gray-100'}`}
                >
                  {copied
                    ? <CheckCircle size={16} color="#fff" />
                    : <Copy size={16} color="#374151" />
                  }
                  <Text className={copied ? 'text-white font-semibold' : 'text-gray-700 font-medium'}>
                    {copied ? 'Código copiado!' : 'Copiar código PIX'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Status */}
            <View className="flex-row items-center justify-center gap-2 py-3">
              <View className="w-2 h-2 rounded-full bg-green-500" />
              <Text className="text-green-700 text-sm">Aguardando confirmação do pagamento…</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
