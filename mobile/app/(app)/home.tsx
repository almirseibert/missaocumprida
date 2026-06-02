import { useEffect, useState } from 'react'
import {
  View, Text, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Search } from 'lucide-react-native'
import { api } from '../../src/lib/api'
import { useAuthStore } from '../../src/store/auth'
import { ServiceGroup, Category } from '../../src/types'

export default function HomeScreen() {
  const { user } = useAuthStore()
  const [groups, setGroups] = useState<ServiceGroup[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/categories/groups')
      .then(r => setGroups(r.data.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = search.trim()
    ? groups.flatMap(g => g.categories).filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase())
      )
    : null

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-blue-600 px-5 pt-6 pb-8">
        <Text className="text-white text-sm">Olá, {user?.name.split(' ')[0]} 👋</Text>
        <Text className="text-white text-xl font-bold mt-1">O que você precisa hoje?</Text>
        <View className="flex-row items-center bg-white rounded-xl mt-4 px-3">
          <Search size={18} color="#9ca3af" />
          <TextInput
            className="flex-1 py-3 px-2 text-gray-700"
            placeholder="Buscar serviço…"
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      {loading ? (
        <ActivityIndicator className="mt-10" color="#2563eb" />
      ) : filtered ? (
        <FlatList
          data={filtered}
          keyExtractor={i => i.id}
          contentContainerClassName="p-4 gap-3"
          renderItem={({ item }) => <CategoryCard cat={item} />}
          ListEmptyComponent={
            <Text className="text-center text-gray-400 mt-10">Nenhum serviço encontrado</Text>
          }
        />
      ) : (
        <FlatList
          data={groups}
          keyExtractor={g => g.id}
          contentContainerClassName="pb-6"
          renderItem={({ item: group }) => (
            <View className="mt-5">
              <Text className="text-base font-bold text-gray-700 px-5 mb-3">
                {group.icon} {group.name}
              </Text>
              <FlatList
                data={group.categories}
                keyExtractor={c => c.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerClassName="px-5 gap-3"
                renderItem={({ item }) => <CategoryCard cat={item} />}
              />
            </View>
          )}
        />
      )}
    </SafeAreaView>
  )
}

function CategoryCard({ cat }: { cat: Category }) {
  return (
    <TouchableOpacity
      onPress={() => router.push(`/(app)/pedido/novo/${cat.slug}`)}
      className="bg-white rounded-2xl p-4 w-36 shadow-sm border border-gray-100"
    >
      <Text className="text-3xl mb-2">{cat.icon}</Text>
      <Text className="text-sm font-semibold text-gray-800" numberOfLines={2}>{cat.name}</Text>
      <Text className="text-xs text-gray-400 mt-1">
        A partir de R$ {cat.base_price_min.toFixed(0)}
      </Text>
    </TouchableOpacity>
  )
}
