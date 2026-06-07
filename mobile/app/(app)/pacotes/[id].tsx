import { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  Image, Alert, TextInput,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { ArrowLeft, Clock, MapPin, Star, Check } from 'lucide-react-native'
import { api, getApiError } from '../../../src/lib/api'
import { useAuthStore } from '../../../src/store/auth'
import { formatCurrency } from '../../../src/lib/utils'
import { ServicePackage } from '../../../src/types'

export default function PackageDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { user } = useAuthStore()
  const [pkg, setPkg] = useState<ServicePackage | null>(null)
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [city, setCity] = useState('')
  const [stateUf, setStateUf] = useState('SP')
  const [neighborhood, setNeighborhood] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    api.get(`/packages/${id}`).then((r) => setPkg(r.data.data))
      .catch(() => router.back())
      .finally(() => setLoading(false))
  }, [id])

  async function purchase() {
    if (!city.trim()) { Alert.alert('Atenção', 'Informe a cidade'); return }
    setPurchasing(true)
    try {
      const r = await api.post(`/packages/${id}/purchase`, {
        city: city.trim(), state: stateUf.trim() || 'SP', neighborhood, notes,
        latitude: user?.latitude ?? undefined,
        longitude: user?.longitude ?? undefined,
      })
      Alert.alert('Pacote contratado!', 'Realize o pagamento para confirmar.', [
        { text: 'Pagar agora', onPress: () => router.replace(`/(app)/pagamento/${r.data.data.order_id}` as any) },
      ])
    } catch (e) {
      Alert.alert('Erro', getApiError(e))
    } finally {
      setPurchasing(false)
    }
  }

  if (loading) {
    return <SafeAreaView className="flex-1 bg-slate2-50 items-center justify-center"><ActivityIndicator /></SafeAreaView>
  }
  if (!pkg) return null

  const isOwn = pkg.provider.id === user?.id

  return (
    <SafeAreaView className="flex-1 bg-slate2-50">
      <View className="flex-row items-center px-4 py-3 bg-white border-b border-slate2-100">
        <TouchableOpacity onPress={() => router.back()} className="mr-2">
          <ArrowLeft size={22} color="#334155" />
        </TouchableOpacity>
        <Text className="text-lg font-bold flex-1">Pacote</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        {pkg.photos[0] && (
          <Image source={{ uri: pkg.photos[0] }} style={{ width: '100%', height: 200, borderRadius: 16 }} />
        )}

        <View>
          <Text className="text-xs text-brand-700 font-semibold uppercase">{pkg.category.icon} {pkg.category.name}</Text>
          <Text className="text-2xl font-bold text-slate2-900 mt-1">{pkg.title}</Text>
          <View className="flex-row items-center gap-3 mt-2">
            <View className="flex-row items-center gap-1">
              <Clock size={14} color="#64748B" />
              <Text className="text-xs text-slate2-500">{pkg.duration_min} min</Text>
            </View>
            {pkg.distance_km != null && (
              <View className="flex-row items-center gap-1">
                <MapPin size={14} color="#64748B" />
                <Text className="text-xs text-slate2-500">{pkg.distance_km.toFixed(1)} km</Text>
              </View>
            )}
            <Text className="text-xs text-slate2-500">{pkg.purchases_count} contratações</Text>
          </View>
        </View>

        <View className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
          <Text className="text-xs text-emerald-700 uppercase font-semibold">Preço fixo</Text>
          <Text className="text-3xl font-extrabold text-emerald-700 mt-1">{formatCurrency(pkg.price)}</Text>
        </View>

        <View className="bg-white rounded-2xl border border-slate2-200 p-4">
          <Text className="font-semibold mb-2">O que está incluso</Text>
          {pkg.includes.length === 0 ? (
            <Text className="text-sm text-slate2-500">Nenhum item específico listado.</Text>
          ) : (
            pkg.includes.map((i, idx) => (
              <View key={idx} className="flex-row items-start mb-1.5">
                <Check size={14} color="#059669" />
                <Text className="text-sm text-slate2-700 ml-2 flex-1">{i}</Text>
              </View>
            ))
          )}
        </View>

        <View className="bg-white rounded-2xl border border-slate2-200 p-4">
          <Text className="font-semibold mb-2">Descrição</Text>
          <Text className="text-sm text-slate2-700">{pkg.description}</Text>
        </View>

        <View className="bg-white rounded-2xl border border-slate2-200 p-4">
          <Text className="font-semibold mb-3">Prestador</Text>
          <View className="flex-row items-center">
            <View className="w-12 h-12 rounded-full bg-slate2-200 items-center justify-center mr-3">
              <Text className="font-bold text-slate2-600">{pkg.provider.name.slice(0, 1).toUpperCase()}</Text>
            </View>
            <View className="flex-1">
              <Text className="font-bold">{pkg.provider.name}</Text>
              {pkg.provider.rating_count > 0 && (
                <View className="flex-row items-center gap-1 mt-0.5">
                  <Star size={12} color="#B45309" fill="#B45309" />
                  <Text className="text-xs text-amber-700">{pkg.provider.rating_avg.toFixed(1)} ({pkg.provider.rating_count})</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {isOwn ? (
          <View className="bg-slate2-100 rounded-2xl p-4 items-center">
            <Text className="text-sm text-slate2-600">Este é o seu pacote.</Text>
          </View>
        ) : !showForm ? (
          <TouchableOpacity onPress={() => setShowForm(true)} className="bg-emerald-600 rounded-2xl py-4 items-center">
            <Text className="text-white font-bold">Contratar agora — {formatCurrency(pkg.price)}</Text>
          </TouchableOpacity>
        ) : (
          <View className="bg-white rounded-2xl border border-slate2-200 p-4">
            <Text className="font-bold mb-3">Dados do serviço</Text>
            <Field label="Cidade *" value={city} onChangeText={setCity} />
            <Field label="UF" value={stateUf} onChangeText={(v: string) => setStateUf(v.toUpperCase().slice(0, 2))} />
            <Field label="Bairro" value={neighborhood} onChangeText={setNeighborhood} />
            <Field label="Observações" value={notes} onChangeText={setNotes} multiline />
            <View className="flex-row gap-2 mt-2">
              <TouchableOpacity onPress={() => setShowForm(false)} className="border border-slate2-300 rounded-xl py-3 px-4">
                <Text className="text-slate2-700">Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={purchase}
                disabled={purchasing}
                className="flex-1 bg-emerald-600 rounded-xl py-3 items-center"
              >
                {purchasing
                  ? <ActivityIndicator color="white" />
                  : <Text className="text-white font-bold">Contratar — {formatCurrency(pkg.price)}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function Field({ label, ...props }: any) {
  return (
    <View className="mb-2">
      <Text className="text-xs text-slate2-600 mb-1">{label}</Text>
      <TextInput
        {...props}
        placeholderTextColor="#94A3B8"
        className="border border-slate2-300 rounded-xl px-3 py-3 text-slate2-900"
      />
    </View>
  )
}
