import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform, Alert,
} from 'react-native'
import { router } from 'expo-router'
import { api, getApiError } from '../../src/lib/api'
import { useAuthStore } from '../../src/store/auth'

type Role = 'CLIENT' | 'PROVIDER' | 'BOTH'

export default function RegisterScreen() {
  const { setTokens, fetchMe } = useAuthStore()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('CLIENT')
  const [loading, setLoading] = useState(false)

  const roles: { value: Role; label: string; desc: string }[] = [
    { value: 'CLIENT', label: 'Cliente', desc: 'Contratar serviços' },
    { value: 'PROVIDER', label: 'Prestador', desc: 'Oferecer serviços' },
    { value: 'BOTH', label: 'Ambos', desc: 'Cliente e Prestador' },
  ]

  async function handleRegister() {
    if (!name || !email || !password) {
      Alert.alert('Atenção', 'Preencha nome, e-mail e senha.')
      return
    }
    setLoading(true)
    try {
      const { data } = await api.post('/auth/register', { name, email, phone, password, role })
      await setTokens(data.data.accessToken, data.data.refreshToken)
      await fetchMe()
      router.replace('/(app)/home')
    } catch (err) {
      Alert.alert('Erro no cadastro', getApiError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerClassName="px-6 py-12">
        {/* Header */}
        <TouchableOpacity onPress={() => router.back()} className="mb-6">
          <Text className="text-blue-600">← Voltar</Text>
        </TouchableOpacity>
        <Text className="text-2xl font-bold text-gray-800 mb-1">Criar conta</Text>
        <Text className="text-gray-500 mb-8">Junte-se à Missão Cumprida</Text>

        {/* Tipo de conta */}
        <Text className="text-sm font-medium text-gray-700 mb-2">Tipo de conta</Text>
        <View className="flex-row gap-2 mb-5">
          {roles.map((r) => (
            <TouchableOpacity
              key={r.value}
              onPress={() => setRole(r.value)}
              className={`flex-1 rounded-xl border-2 p-3 items-center ${
                role === r.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
              }`}
            >
              <Text className={`font-semibold text-sm ${role === r.value ? 'text-blue-700' : 'text-gray-600'}`}>
                {r.label}
              </Text>
              <Text className={`text-xs mt-0.5 ${role === r.value ? 'text-blue-500' : 'text-gray-400'}`}>
                {r.desc}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Campos */}
        <View className="gap-4">
          {[
            { label: 'Nome completo', value: name, setter: setName, placeholder: 'Seu nome', keyboard: 'default' as const },
            { label: 'E-mail', value: email, setter: setEmail, placeholder: 'seu@email.com', keyboard: 'email-address' as const },
            { label: 'Telefone (opcional)', value: phone, setter: setPhone, placeholder: '(51) 99999-9999', keyboard: 'phone-pad' as const },
          ].map(({ label, value, setter, placeholder, keyboard }) => (
            <View key={label}>
              <Text className="text-sm font-medium text-gray-700 mb-1">{label}</Text>
              <TextInput
                className="border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-800 bg-gray-50"
                placeholder={placeholder}
                keyboardType={keyboard}
                autoCapitalize={keyboard === 'email-address' ? 'none' : 'words'}
                value={value}
                onChangeText={setter}
              />
            </View>
          ))}

          <View>
            <Text className="text-sm font-medium text-gray-700 mb-1">Senha</Text>
            <TextInput
              className="border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-800 bg-gray-50"
              placeholder="Mínimo 6 caracteres"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>

          <TouchableOpacity
            onPress={handleRegister}
            disabled={loading}
            className={`rounded-xl py-4 items-center mt-2 ${loading ? 'bg-blue-400' : 'bg-blue-600'}`}
          >
            <Text className="text-white font-semibold text-base">
              {loading ? 'Criando conta…' : 'Criar conta'}
            </Text>
          </TouchableOpacity>
        </View>

        <View className="flex-row justify-center mt-6">
          <Text className="text-gray-500">Já tem conta? </Text>
          <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
            <Text className="text-blue-600 font-medium">Entrar</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
