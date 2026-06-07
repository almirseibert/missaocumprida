import { useState } from 'react'
import {
  View, Text, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform, Alert,
} from 'react-native'
import { router } from 'expo-router'
import { api, getApiError } from '../../src/lib/api'
import { useAuthStore } from '../../src/store/auth'
import { Logo } from '../../src/components/Logo'
import { Button, Input } from '../../src/components/ui'

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
      className="flex-1 bg-slate2-50"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerClassName="flex-grow justify-center px-6 py-12">
        <View className="items-center mb-10">
          <View className="mb-4"><Logo size={64} /></View>
          <Text className="font-display-extrabold text-2xl text-slate2-900">
            Missão Cumprida
          </Text>
          <Text className="font-sans text-slate2-500 mt-1">
            Sua missão, cumprida.
          </Text>
        </View>

        <View className="gap-4">
          <Input
            label="E-mail"
            placeholder="seu@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
          <Input
            label="Senha"
            placeholder="••••••••"
            secureTextEntry={!showPass}
            value={password}
            onChangeText={setPassword}
            rightSlot={
              <TouchableOpacity onPress={() => setShowPass(!showPass)}>
                <Text className="font-sans-semibold text-brand-700 text-sm">
                  {showPass ? 'Ocultar' : 'Ver'}
                </Text>
              </TouchableOpacity>
            }
          />
          <Button
            variant="primary"
            size="lg"
            fullWidth
            loading={loading}
            onPress={handleLogin}
            style={{ marginTop: 8 }}
          >
            {loading ? 'Entrando…' : 'Entrar'}
          </Button>
        </View>

        <View className="flex-row justify-center mt-8">
          <Text className="font-sans text-slate2-500">Não tem conta? </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
            <Text className="font-sans-semibold text-brand-700">Cadastre-se</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
