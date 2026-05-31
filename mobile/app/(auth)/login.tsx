import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform, Alert,
} from 'react-native'
import { router } from 'expo-router'
import { api, getApiError } from '../../src/lib/api'
import { useAuthStore } from '../../src/store/auth'

export default function LoginScreen() {
  const { setTokens, fetchMe } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert('Atenção', 'Preencha e-mail e senha.')
      return
    }
    setLoading(true)
    try {
      const { data } = await api.post('/auth/login', { email, password })
      await setTokens(data.data.accessToken, data.data.refreshToken)
      await fetchMe()
      router.replace('/(app)/home')
    } catch (err) {
      Alert.alert('Erro ao entrar', getApiError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerClassName="flex-grow justify-center px-6 py-12">
        {/* Logo */}
        <View className="items-center mb-10">
          <View className="w-16 h-16 rounded-2xl bg-blue-600 items-center justify-center mb-4">
            <Text className="text-white text-3xl font-bold">M</Text>
          </View>
          <Text className="text-2xl font-bold text-gray-800">Missão Cumprida</Text>
          <Text className="text-gray-500 mt-1">Serviços para o seu dia a dia</Text>
        </View>

        {/* Campos */}
        <View className="gap-4">
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-1">E-mail</Text>
            <TextInput
              className="border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-800 bg-gray-50"
              placeholder="seu@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View>
            <Text className="text-sm font-medium text-gray-700 mb-1">Senha</Text>
            <View className="flex-row items-center border border-gray-300 rounded-xl bg-gray-50">
              <TextInput
                className="flex-1 px-4 py-3 text-base text-gray-800"
                placeholder="••••••••"
                secureTextEntry={!showPass}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity onPress={() => setShowPass(!showPass)} className="px-4">
                <Text className="text-blue-600 text-sm">{showPass ? 'Ocultar' : 'Ver'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            onPress={handleLogin}
            disabled={loading}
            className={`rounded-xl py-4 items-center mt-2 ${loading ? 'bg-blue-400' : 'bg-blue-600'}`}
          >
            <Text className="text-white font-semibold text-base">
              {loading ? 'Entrando…' : 'Entrar'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Registro */}
        <View className="flex-row justify-center mt-8">
          <Text className="text-gray-500">Não tem conta? </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
            <Text className="text-blue-600 font-medium">Cadastre-se</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
