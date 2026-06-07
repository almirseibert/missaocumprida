import { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  Alert, Share,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { ArrowLeft, Gift, Copy, Share2, Check, Wallet, Users } from 'lucide-react-native'
import { api, getApiError } from '../../src/lib/api'
import { formatCurrency, formatDate } from '../../src/lib/utils'

interface ReferralEvent {
  id: string
  status: 'PENDING' | 'COMPLETED' | 'EXPIRED'
  created_at: string
  completed_at: string | null
  referrer_reward: number
  referred_reward: number
  referred: { id: string; name: string; avatar: string | null }
}
interface MyCodeData {
  code: string
  share_url: string
  deep_link: string
  credit_balance: number
  stats: { pending: number; completed: number; total: number }
  events: ReferralEvent[]
}

export default function IndicarScreen() {
  const [data, setData] = useState<MyCodeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    api.get('/referrals/my-code')
      .then((r) => setData(r.data.data))
      .catch((e) => Alert.alert('Erro', getApiError(e)))
      .finally(() => setLoading(false))
  }, [])

  async function shareNative() {
    if (!data) return
    try {
      await Share.share({
        message: `Use meu código ${data.code} e ganhe R$ 20 no Missão Cumprida! ${data.share_url}`,
        url: data.share_url,
      })
    } catch {}
  }

  function copyToClipboard() {
    if (!data) return
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Clipboard = require('@react-native-clipboard/clipboard')?.default
      if (Clipboard?.setString) {
        Clipboard.setString(data.share_url)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
        return
      }
    } catch {}
    Alert.alert('Link', data.share_url, [{ text: 'OK' }])
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator color="#1D4ED8" />
      </SafeAreaView>
    )
  }
  if (!data) return null

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-row items-center px-4 py-3 border-b border-neutral-200">
        <TouchableOpacity onPress={() => router.back()} className="mr-3"><ArrowLeft size={24} color="#111" /></TouchableOpacity>
        <Text className="text-lg font-bold">Indique e ganhe</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text className="text-sm text-neutral-600 mb-4">
          Compartilhe seu código. Para cada amigo que completar o 1º serviço, você ganha <Text className="font-bold">R$ 30</Text> e ele recebe <Text className="font-bold">R$ 20</Text> de desconto.
        </Text>

        <View className="bg-emerald-50 rounded-2xl p-4 mb-3 flex-row items-center">
          <View className="w-10 h-10 rounded-full bg-emerald-100 items-center justify-center mr-3">
            <Wallet color="#047857" size={20} />
          </View>
          <View className="flex-1">
            <Text className="text-xs text-neutral-500">Seu saldo</Text>
            <Text className="text-2xl font-extrabold text-emerald-700">{formatCurrency(data.credit_balance)}</Text>
          </View>
        </View>

        <View className="bg-brand-50 rounded-2xl p-4 mb-4 flex-row items-center">
          <View className="w-10 h-10 rounded-full bg-brand-100 items-center justify-center mr-3">
            <Users color="#1D4ED8" size={20} />
          </View>
          <View className="flex-1">
            <Text className="text-xs text-neutral-500">Indicações</Text>
            <Text className="text-sm">
              <Text className="font-bold text-brand-700">{data.stats.completed}</Text> completas · <Text className="text-amber-600">{data.stats.pending}</Text> pendentes
            </Text>
          </View>
        </View>

        <View className="bg-white border border-neutral-200 rounded-2xl p-4 mb-4">
          <View className="flex-row items-center gap-3 mb-3">
            <Gift color="#1D4ED8" size={22} />
            <Text className="font-semibold">Seu código</Text>
          </View>
          <View className="bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 mb-3">
            <Text className="text-xs text-neutral-500">CÓDIGO</Text>
            <Text className="text-xl font-extrabold tracking-widest text-brand-700">{data.code}</Text>
          </View>
          <View className="flex-row gap-2">
            <TouchableOpacity onPress={copyToClipboard} className="flex-1 border border-neutral-300 rounded-xl py-3 items-center flex-row justify-center gap-2">
              {copied ? <Check size={16} color="#059669" /> : <Copy size={16} color="#0F172A" />}
              <Text className="text-neutral-700 font-semibold">{copied ? 'Copiado' : 'Copiar link'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={shareNative} className="flex-1 bg-brand-600 rounded-xl py-3 items-center flex-row justify-center gap-2">
              <Share2 size={16} color="white" />
              <Text className="text-white font-semibold">Compartilhar</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
          <Text className="px-4 py-3 font-semibold border-b border-neutral-100">Histórico</Text>
          {data.events.length === 0 && (
            <Text className="px-4 py-6 text-center text-sm text-neutral-500">Você ainda não indicou ninguém.</Text>
          )}
          {data.events.map((e) => (
            <View key={e.id} className="flex-row items-center px-4 py-3 border-b border-neutral-100">
              <View className="w-10 h-10 rounded-full bg-neutral-200 items-center justify-center mr-3">
                <Text className="font-bold text-neutral-600">{e.referred.name.slice(0, 1).toUpperCase()}</Text>
              </View>
              <View className="flex-1">
                <Text className="font-medium">{e.referred.name}</Text>
                <Text className="text-xs text-neutral-500">Indicado em {formatDate(e.created_at)}</Text>
              </View>
              {e.status === 'COMPLETED' ? (
                <Text className="text-emerald-700 font-bold">+{formatCurrency(e.referrer_reward)}</Text>
              ) : e.status === 'PENDING' ? (
                <Text className="text-amber-600 text-xs">Pendente</Text>
              ) : (
                <Text className="text-neutral-500 text-xs">Expirado</Text>
              )}
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
