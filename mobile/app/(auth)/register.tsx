import { useEffect, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  View, Text, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform, Alert,
} from 'react-native'
import { router } from 'expo-router'
import { api, getApiError } from '../../src/lib/api'
import { useAuthStore } from '../../src/store/auth'
import { Button, Input } from '../../src/components/ui'

type Role = 'CLIENT' | 'PROVIDER' | 'BOTH'

export default function RegisterScreen() {
  const { setTokens, fetchMe } = useAuthStore()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [referralCode, setReferralCode] = useState('')

  useEffect(() => {
    AsyncStorage.getItem('@mc:pending-referral').then((c) => {
      if (c) {
        setReferralCode(c)
        AsyncStorage.removeItem('@mc:pending-referral').catch(() => {})
      }
    })
  }, [])
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
      const { data } = await api.post('/auth/register', {
        name, email, phone, password, role,
        referral_code: referralCode.trim() ? referralCode.trim().toUpperCase() : undefined,
      })
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
      className="flex-1 bg-slate2-50"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerClassName="px-6 py-12">
        <TouchableOpacity onPress={() => router.back()} className="mb-6">
          <Text className="font-sans-semibold text-brand-700">← Voltar</Text>
        </TouchableOpacity>
        <Text className="font-display-extrabold text-2xl text-slate2-900 mb-1">
          Criar conta
        </Text>
        <Text className="font-sans text-slate2-500 mb-8">
          Junte-se à Missão Cumprida
        </Text>

        <Text className="font-sans-medium text-sm text-slate2-700 mb-2">
          Tipo de conta
        </Text>
        <View className="flex-row gap-2 mb-5">
          {roles.map((r) => {
            const active = role === r.value
            return (
              <TouchableOpacity
                key={r.value}
                onPress={() => setRole(r.value)}
                className={`flex-1 rounded-xl border-2 p-3 items-center ${
                  active ? 'border-brand-700 bg-brand-50' : 'border-slate2-200 bg-white'
                }`}
              >
                <Text
                  className={`font-display-semibold text-sm ${
                    active ? 'text-brand-700' : 'text-slate2-600'
                  }`}
                >
                  {r.label}
                </Text>
                <Text
                  className={`font-sans text-xs mt-0.5 ${
                    active ? 'text-brand-500' : 'text-slate2-400'
                  }`}
                >
                  {r.desc}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>

        <View className="gap-4">
          <Input label="Nome completo" placeholder="Seu nome" value={name} onChangeText={setName} autoCapitalize="words" />
          <Input label="E-mail" placeholder="seu@email.com" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />
          <Input label="Telefone (opcional)" placeholder="(51) 99999-9999" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
          <Input label="Senha" placeholder="Mínimo 6 caracteres" secureTextEntry value={password} onChangeText={setPassword} />
          <Input
            label="Código de indicação (opcional)"
            placeholder="Ex: JOAOX42K"
            autoCapitalize="characters"
            value={referralCode}
            onChangeText={setReferralCode}
          />

          <Button
            variant="primary"
            size="lg"
            fullWidth
            loading={loading}
            onPress={handleRegister}
            style={{ marginTop: 8 }}
          >
            {loading ? 'Criando conta…' : 'Criar conta'}
          </Button>
        </View>

        <View className="flex-row justify-center mt-6">
          <Text className="font-sans text-slate2-500">Já tem conta? </Text>
          <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
            <Text className="font-sans-semibold text-brand-700">Entrar</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
