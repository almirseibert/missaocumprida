import { useCallback, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  SafeAreaView, Alert, TextInput, RefreshControl,
} from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { LogOut, Wallet, Star, ChevronRight } from 'lucide-react-native'
import { useAuthStore } from '../../src/store/auth'
import { api, getApiError } from '../../src/lib/api'

export default function PerfilScreen() {
  const { user, setUser, logout } = useAuthStore()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(user?.name ?? '')
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [bio, setBio] = useState(user?.bio ?? '')
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  useFocusEffect(useCallback(() => {
    api.get('/users/me').then(r => setUser(r.data.data)).catch(() => {})
  }, []))

  async function save() {
    setSaving(true)
    try {
      const { data } = await api.put('/users/me', { name, phone, bio })
      setUser(data.data)
      setEditing(false)
      Alert.alert('Salvo!', 'Perfil atualizado com sucesso.')
    } catch (err) {
      Alert.alert('Erro', getApiError(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleLogout() {
    Alert.alert('Sair', 'Deseja sair da sua conta?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: async () => { await logout(); router.replace('/(auth)/login') } },
    ])
  }

  if (!user) return null

  const isProvider = user.role === 'PROVIDER' || user.role === 'BOTH'

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView
        contentContainerClassName="pb-10"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {
          setRefreshing(true)
          api.get('/users/me').then(r => setUser(r.data.data)).finally(() => setRefreshing(false))
        }} />}
      >
        {/* Header */}
        <View className="bg-blue-600 px-5 pt-8 pb-10 items-center">
          <View className="w-20 h-20 rounded-full bg-blue-400 items-center justify-center mb-3">
            <Text className="text-white text-3xl font-bold">{user.name.charAt(0).toUpperCase()}</Text>
          </View>
          <Text className="text-white text-xl font-bold">{user.name}</Text>
          <Text className="text-blue-200 text-sm mt-0.5">{user.email}</Text>
          <View className="flex-row gap-4 mt-3">
            <View className="items-center">
              <Text className="text-white font-bold text-lg">{user.rating_avg.toFixed(1)}</Text>
              <Text className="text-blue-200 text-xs">Avaliação</Text>
            </View>
            <View className="w-px bg-blue-400" />
            <View className="items-center">
              <Text className="text-white font-bold text-lg">{user.rating_count}</Text>
              <Text className="text-blue-200 text-xs">Avaliações</Text>
            </View>
          </View>
        </View>

        <View className="px-5 -mt-5 gap-4">
          {/* Card de edição */}
          <View className="bg-white rounded-2xl p-4 shadow-sm">
            {editing ? (
              <View className="gap-3">
                <View>
                  <Text className="text-xs text-gray-500 mb-1">Nome</Text>
                  <TextInput
                    className="border border-gray-200 rounded-xl px-3 py-2.5 text-gray-800"
                    value={name} onChangeText={setName}
                  />
                </View>
                <View>
                  <Text className="text-xs text-gray-500 mb-1">Telefone</Text>
                  <TextInput
                    className="border border-gray-200 rounded-xl px-3 py-2.5 text-gray-800"
                    value={phone} onChangeText={setPhone} keyboardType="phone-pad"
                  />
                </View>
                <View>
                  <Text className="text-xs text-gray-500 mb-1">Bio</Text>
                  <TextInput
                    className="border border-gray-200 rounded-xl px-3 py-2.5 text-gray-800"
                    value={bio} onChangeText={setBio} multiline numberOfLines={3}
                  />
                </View>
                <View className="flex-row gap-2">
                  <TouchableOpacity onPress={() => setEditing(false)} className="flex-1 border border-gray-300 rounded-xl py-3 items-center">
                    <Text className="text-gray-600">Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={save} disabled={saving} className="flex-1 bg-blue-600 rounded-xl py-3 items-center">
                    <Text className="text-white font-semibold">{saving ? 'Salvando…' : 'Salvar'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <>
                <View className="flex-row justify-between items-center mb-3">
                  <Text className="font-semibold text-gray-800">Dados pessoais</Text>
                  <TouchableOpacity onPress={() => setEditing(true)}>
                    <Text className="text-blue-600 text-sm">Editar</Text>
                  </TouchableOpacity>
                </View>
                {user.phone && <InfoRow label="Telefone" value={user.phone} />}
                {user.bio && <InfoRow label="Bio" value={user.bio} />}
                <InfoRow label="Tipo de conta" value={
                  user.role === 'CLIENT' ? 'Cliente' : user.role === 'PROVIDER' ? 'Prestador' : 'Cliente e Prestador'
                } />
              </>
            )}
          </View>

          {/* Carteira (prestador) */}
          {isProvider && (
            <TouchableOpacity
              onPress={() => router.push('/(app)/carteira')}
              className="bg-white rounded-2xl p-4 shadow-sm flex-row items-center justify-between"
            >
              <View className="flex-row items-center gap-3">
                <View className="w-10 h-10 rounded-full bg-green-100 items-center justify-center">
                  <Wallet size={20} color="#16a34a" />
                </View>
                <View>
                  <Text className="font-semibold text-gray-800">Carteira</Text>
                  <Text className="text-xs text-gray-500">
                    Saldo: R$ {(user.provider_balance ?? 0).toFixed(2)}
                  </Text>
                </View>
              </View>
              <ChevronRight size={18} color="#9ca3af" />
            </TouchableOpacity>
          )}

          {/* Avaliações */}
          {user.rating_count > 0 && (
            <View className="bg-white rounded-2xl p-4 shadow-sm">
              <View className="flex-row items-center gap-2 mb-2">
                <Star size={18} color="#f59e0b" fill="#f59e0b" />
                <Text className="font-semibold text-gray-800">
                  {user.rating_avg.toFixed(1)} · {user.rating_count} avaliações
                </Text>
              </View>
            </View>
          )}

          {/* Sair */}
          <TouchableOpacity
            onPress={handleLogout}
            className="bg-red-50 rounded-2xl p-4 flex-row items-center gap-3"
          >
            <LogOut size={20} color="#ef4444" />
            <Text className="text-red-600 font-medium">Sair da conta</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between py-1.5 border-b border-gray-50">
      <Text className="text-sm text-gray-500">{label}</Text>
      <Text className="text-sm text-gray-800 flex-1 text-right ml-4" numberOfLines={2}>{value}</Text>
    </View>
  )
}
