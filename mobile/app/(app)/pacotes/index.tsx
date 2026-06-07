import { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  TextInput, Image,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Package, Clock, MapPin, Star, Search, ShieldCheck } from 'lucide-react-native'
import { api } from '../../../src/lib/api'
import { useAuthStore } from '../../../src/store/auth'
import { formatCurrency } from '../../../src/lib/utils'
import { ServicePackage } from '../../../src/types'

export default function PacotesIndexScreen() {
  const { user } = useAuthStore()
  const [packages, setPackages] = useState<ServicePackage[]>([])
  const [search, setSearch] = useState('')
  const [verifiedOnly, setVerifiedOnly] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const params: string[] = []
    if (user?.latitude && user?.longitude) {
      params.push(`lat=${user.latitude}`, `lng=${user.longitude}`, 'radius=50')
    }
    if (verifiedOnly) params.push('verified_only=1')
    const qs = params.length ? '?' + params.join('&') : ''
    api.get(`/packages${qs}`)
      .then((r) => setPackages(r.data.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user?.latitude, user?.longitude, verifiedOnly])

  const filtered = search
    ? packages.filter((p) =>
        (p.title + ' ' + p.category.name + ' ' + p.provider.name).toLowerCase().includes(search.toLowerCase())
      )
    : packages

  return (
    <SafeAreaView className="flex-1 bg-slate2-50">
      <View className="px-4 py-3 bg-white border-b border-slate2-100">
        <Text className="text-xl font-bold flex-row items-center text-slate2-900">📦 Pacotes</Text>
        <Text className="text-xs text-slate2-500 mt-0.5">Serviços com preço fixo · contratação direta</Text>
        <View className="flex-row items-center bg-slate2-50 border border-slate2-200 rounded-xl mt-3 px-3 py-2">
          <Search size={16} color="#64748B" />
          <TextInput
            placeholder="Buscar pacote ou categoria..."
            placeholderTextColor="#94A3B8"
            value={search}
            onChangeText={setSearch}
            className="flex-1 ml-2 text-slate2-900"
          />
        </View>
        <TouchableOpacity
          onPress={() => setVerifiedOnly((v) => !v)}
          className={`flex-row items-center gap-1.5 self-start mt-2 px-3 py-1.5 rounded-lg border ${
            verifiedOnly
              ? 'bg-blue-50 border-blue-300'
              : 'bg-white border-slate2-300'
          }`}
        >
          <ShieldCheck size={14} color={verifiedOnly ? '#2563EB' : '#64748B'} fill={verifiedOnly ? '#2563EB' : 'transparent'} />
          <Text className={`text-xs ${verifiedOnly ? 'text-blue-700' : 'text-slate2-600'}`}>
            Apenas verificados
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center"><ActivityIndicator color="#1D4ED8" /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          {filtered.length === 0 && (
            <View className="bg-white rounded-2xl p-8 items-center border border-slate2-200">
              <Package size={32} color="#94A3B8" />
              <Text className="text-slate2-700 font-bold mt-2">Nenhum pacote disponível</Text>
              <Text className="text-xs text-slate2-500 text-center mt-1">
                Quando prestadores criarem pacotes, eles aparecerão aqui.
              </Text>
            </View>
          )}
          {filtered.map((p) => (
            <TouchableOpacity
              key={p.id}
              onPress={() => router.push(`/(app)/pacotes/${p.id}` as any)}
              className={`bg-white rounded-2xl overflow-hidden ${p.is_pro_highlighted ? 'border-2 border-blue-300' : 'border border-slate2-200'}`}
            >
              {p.is_pro_highlighted && (
                <View className="bg-blue-600 px-3 py-1">
                  <Text className="text-white text-[10px] font-bold uppercase tracking-wider text-center">
                    ⭐ Destaque Pro · Novo
                  </Text>
                </View>
              )}
              {p.photos[0] && (
                <Image source={{ uri: p.photos[0] }} style={{ width: '100%', height: 140 }} />
              )}
              <View className="p-4">
                <Text className="text-xs text-brand-700 font-semibold uppercase">
                  {p.category.icon} {p.category.name}
                </Text>
                <Text className="font-bold text-slate2-900 mt-1" numberOfLines={2}>{p.title}</Text>
                <View className="flex-row items-center gap-3 mt-2">
                  <View className="flex-row items-center gap-1">
                    <Clock size={12} color="#64748B" />
                    <Text className="text-xs text-slate2-500">{p.duration_min} min</Text>
                  </View>
                  {p.distance_km != null && (
                    <View className="flex-row items-center gap-1">
                      <MapPin size={12} color="#64748B" />
                      <Text className="text-xs text-slate2-500">{p.distance_km.toFixed(1)} km</Text>
                    </View>
                  )}
                </View>
                <View className="flex-row items-center mt-3 pt-3 border-t border-slate2-100">
                  <View className="w-7 h-7 rounded-full bg-slate2-200 items-center justify-center mr-2">
                    <Text className="text-xs font-bold text-slate2-600">{p.provider.name.slice(0, 1).toUpperCase()}</Text>
                  </View>
                  <View className="flex-1 min-w-0">
                    <View className="flex-row items-center gap-1">
                      <Text className="text-sm font-medium flex-shrink" numberOfLines={1}>{p.provider.name}</Text>
                      {p.provider.is_verified_pro && (
                        <ShieldCheck size={12} color="#2563EB" fill="#2563EB" />
                      )}
                    </View>
                    {p.provider.rating_count > 0 && (
                      <View className="flex-row items-center gap-1 mt-0.5">
                        <Star size={10} color="#B45309" fill="#B45309" />
                        <Text className="text-xs text-amber-700">{p.provider.rating_avg.toFixed(1)} ({p.provider.rating_count})</Text>
                      </View>
                    )}
                  </View>
                  <Text className="text-xl font-extrabold text-emerald-700">{formatCurrency(p.price)}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}
