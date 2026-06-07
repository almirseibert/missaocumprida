import { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  TextInput, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import {
  User as UserIcon, MapPin, Briefcase, ShieldCheck, Wallet, Check, ChevronDown,
} from 'lucide-react-native'
import { useAuthStore } from '../../src/store/auth'
import { api, getApiError } from '../../src/lib/api'

const TOTAL = 6

interface Cat { id: string; name: string }
interface Grp { id: string; name: string; categories: Cat[] }

export default function ComecarPrestadorScreen() {
  const { user, setUser } = useAuthStore()
  const [step, setStep] = useState((user?.onboarding_state?.provider?.step as number) ?? 0)
  const [loading, setLoading] = useState(false)

  // dados
  const [name, setName] = useState(user?.name ?? '')
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [bio, setBio] = useState(user?.bio ?? '')
  const [groups, setGroups] = useState<Grp[]>([])
  const [categoryId, setCategoryId] = useState('')
  const [years, setYears] = useState('1')
  const [radius, setRadius] = useState('20')
  const [cpf, setCpf] = useState(user?.cpf ?? '')
  const [pixKey, setPixKey] = useState(user?.pix_key ?? '')
  const [pixKeyType, setPixKeyType] = useState(user?.pix_key_type ?? 'CPF')
  const [showCatPicker, setShowCatPicker] = useState(false)
  const [showPixPicker, setShowPixPicker] = useState(false)

  useEffect(() => {
    if (step === 3 && groups.length === 0) {
      api.get('/categories/groups').then(r => setGroups(r.data.data ?? [])).catch(() => {})
    }
  }, [step, groups.length])

  async function patchState(next: number, completed = false, data?: Record<string, unknown>) {
    await api.put('/users/me/onboarding', { flow: 'provider', step: next, completed, data })
    const r = await api.get('/users/me')
    setUser(r.data.data)
  }

  async function handleSkip() {
    setLoading(true)
    try { await patchState(step, true, { skipped: true }) } catch {}
    setLoading(false)
    router.replace('/(app)/feed')
  }

  async function go(nextStep: number, completed = false, work?: () => Promise<void>) {
    setLoading(true)
    try {
      if (work) await work()
      await patchState(nextStep, completed)
      if (completed) router.replace('/(app)/feed')
      else setStep(nextStep)
    } catch (e) {
      Alert.alert('Erro', getApiError(e))
    } finally {
      setLoading(false)
    }
  }

  async function saveProfile() { await api.put('/users/me', { name, phone, bio }) }

  async function saveLocation() {
    let Location: any = null
    try { Location = require('expo-location') } catch {}
    if (!Location) throw new Error('Localização indisponível')
    const { status } = await Location.requestForegroundPermissionsAsync()
    if (status !== 'granted') throw new Error('Permissão negada')
    const pos = await Location.getCurrentPositionAsync({})
    await api.put('/users/me', { latitude: pos.coords.latitude, longitude: pos.coords.longitude })
  }

  async function addSkill() {
    if (!categoryId) throw new Error('Escolha uma categoria')
    await api.post('/users/me/skills', {
      category_id: categoryId,
      years_experience: Number(years) || 0,
      service_radius_km: Number(radius) || 20,
    })
  }

  async function saveCpf() { if (cpf) await api.put('/users/me', { cpf }) }
  async function savePix() { if (pixKey) await api.put('/payments/pix-key', { pix_key: pixKey, pix_key_type: pixKeyType }) }

  const selectedCat = groups.flatMap(g => g.categories).find(c => c.id === categoryId)

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <Progress current={step + 1} total={TOTAL} />

        {step === 0 && (
          <Shell icon={<Briefcase color="#059669" size={28} />} title="Vamos te preparar para ganhar"
                 subtitle="6 passos rápidos. Depois você cai direto no feed.">
            <Text className="text-sm text-neutral-700 mb-1">• Perfil + foto e bio</Text>
            <Text className="text-sm text-neutral-700 mb-1">• Localização para receber perto</Text>
            <Text className="text-sm text-neutral-700 mb-1">• Categorias que você atende</Text>
            <Text className="text-sm text-neutral-700 mb-4">• CPF + chave PIX para receber</Text>
            <PrimaryBtn loading={loading} onPress={() => go(1)}>Começar</PrimaryBtn>
          </Shell>
        )}

        {step === 1 && (
          <Shell icon={<UserIcon color="#1D4ED8" size={28} />} title="Seu perfil" subtitle="Mostre quem você é.">
            <Field label="Nome" value={name} onChangeText={setName} />
            <Field label="Telefone (WhatsApp)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
            <Field label="Bio" value={bio} onChangeText={setBio} multiline placeholder="Conte sobre seu trabalho..." />
            <Nav onBack={() => setStep(0)} onNext={() => go(2, false, saveProfile)} loading={loading} />
          </Shell>
        )}

        {step === 2 && (
          <Shell icon={<MapPin color="#1D4ED8" size={28} />} title="Sua localização" subtitle="Para receber pedidos perto.">
            <Text className="text-sm text-neutral-600 mb-4">
              Vamos usar sua localização atual como base de atendimento.
            </Text>
            <PrimaryBtn loading={loading} onPress={() => go(3, false, saveLocation)}>
              Usar minha localização
            </PrimaryBtn>
            <TouchableOpacity onPress={() => go(3)} disabled={loading}>
              <Text className="text-sm text-neutral-500 text-center mt-3">Pular por enquanto</Text>
            </TouchableOpacity>
          </Shell>
        )}

        {step === 3 && (
          <Shell icon={<Briefcase color="#059669" size={28} />} title="Suas habilidades" subtitle="Adicione ao menos uma categoria.">
            <Text className="text-xs text-neutral-600 mb-1 mt-2">Categoria</Text>
            <TouchableOpacity
              onPress={() => setShowCatPicker(v => !v)}
              className="border border-neutral-300 rounded-xl px-3 py-3 flex-row items-center justify-between mb-2"
            >
              <Text className={selectedCat ? 'text-neutral-900' : 'text-neutral-400'}>
                {selectedCat ? selectedCat.name : 'Selecione...'}
              </Text>
              <ChevronDown size={16} color="#64748B" />
            </TouchableOpacity>
            {showCatPicker && (
              <View className="border border-neutral-200 rounded-xl mb-3 max-h-72">
                <ScrollView>
                  {groups.map(g => (
                    <View key={g.id}>
                      <Text className="px-3 py-2 text-xs text-neutral-500 font-bold uppercase">{g.name}</Text>
                      {(g.categories ?? []).map(c => (
                        <TouchableOpacity
                          key={c.id}
                          onPress={() => { setCategoryId(c.id); setShowCatPicker(false) }}
                          className="px-3 py-2"
                        >
                          <Text className={categoryId === c.id ? 'text-brand-700 font-semibold' : 'text-neutral-800'}>
                            {c.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Field label="Anos de experiência" value={years} onChangeText={setYears} keyboardType="number-pad" />
              </View>
              <View className="flex-1">
                <Field label="Raio (km)" value={radius} onChangeText={setRadius} keyboardType="number-pad" />
              </View>
            </View>
            <View className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 mt-1 mb-1">
              <Text className="text-xs text-emerald-700">
                💡 Quanto maior o raio que você informa, mais propostas de trabalho você recebe.
                Pedidos fora do seu raio não aparecem no seu feed.
              </Text>
            </View>
            <Nav onBack={() => setStep(2)} onNext={() => go(4, false, addSkill)} loading={loading} nextLabel="Adicionar" />
          </Shell>
        )}

        {step === 4 && (
          <Shell icon={<ShieldCheck color="#1D4ED8" size={28} />} title="Verificação básica" subtitle="CPF é obrigatório para PIX.">
            <Field label="CPF" value={cpf} onChangeText={setCpf} keyboardType="number-pad" placeholder="000.000.000-00" />
            <Text className="text-xs text-neutral-500 mt-1 mb-3">
              Você pode enviar foto do RG depois em Perfil → Verificação.
            </Text>
            <Nav onBack={() => setStep(3)} onNext={() => go(5, false, saveCpf)} loading={loading} />
          </Shell>
        )}

        {step === 5 && (
          <Shell icon={<Wallet color="#059669" size={28} />} title="Chave PIX" subtitle="Onde vamos depositar seus ganhos.">
            <Text className="text-xs text-neutral-600 mb-1 mt-2">Tipo da chave</Text>
            <TouchableOpacity
              onPress={() => setShowPixPicker(v => !v)}
              className="border border-neutral-300 rounded-xl px-3 py-3 flex-row items-center justify-between mb-2"
            >
              <Text className="text-neutral-900">{pixKeyType}</Text>
              <ChevronDown size={16} color="#64748B" />
            </TouchableOpacity>
            {showPixPicker && (
              <View className="border border-neutral-200 rounded-xl mb-3">
                {['CPF', 'CNPJ', 'EMAIL', 'PHONE', 'RANDOM'].map((t) => (
                  <TouchableOpacity key={t} onPress={() => { setPixKeyType(t as any); setShowPixPicker(false) }} className="px-3 py-2">
                    <Text>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <Field label="Chave PIX" value={pixKey ?? ''} onChangeText={setPixKey} />
            <Nav onBack={() => setStep(4)} onNext={() => go(TOTAL, true, savePix)} loading={loading} nextLabel="Concluir" />
          </Shell>
        )}

        <TouchableOpacity onPress={handleSkip} disabled={loading} className="mt-6 self-center">
          <Text className="text-sm text-neutral-500">Pular por enquanto</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

function Progress({ current, total }: { current: number; total: number }) {
  const pct = Math.min(100, Math.round((current / total) * 100))
  return (
    <View className="mb-6">
      <View className="flex-row justify-between mb-2">
        <Text className="text-xs text-neutral-500">Passo {Math.min(current, total)} de {total}</Text>
        <Text className="text-xs text-neutral-500">{pct}%</Text>
      </View>
      <View className="h-2 bg-neutral-200 rounded-full overflow-hidden">
        <View style={{ width: `${pct}%` }} className="h-full bg-emerald-600" />
      </View>
    </View>
  )
}

function Shell({ icon, title, subtitle, children }: any) {
  return (
    <View className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm">
      <View className="flex-row items-center gap-3 mb-3">
        <View className="w-12 h-12 rounded-full bg-neutral-50 items-center justify-center">{icon}</View>
        <View className="flex-1">
          <Text className="text-lg font-bold">{title}</Text>
          <Text className="text-sm text-neutral-600">{subtitle}</Text>
        </View>
      </View>
      {children}
    </View>
  )
}

function Field({ label, ...props }: any) {
  return (
    <View className="mb-2">
      <Text className="text-xs text-neutral-600 mb-1">{label}</Text>
      <TextInput
        {...props}
        placeholderTextColor="#94A3B8"
        className="border border-neutral-300 rounded-xl px-3 py-3 text-neutral-900"
      />
    </View>
  )
}

function PrimaryBtn({ onPress, loading, children }: any) {
  return (
    <TouchableOpacity onPress={onPress} disabled={loading} className="bg-emerald-600 rounded-xl py-3 items-center">
      {loading ? <ActivityIndicator color="white" /> : <Text className="text-white font-semibold">{children}</Text>}
    </TouchableOpacity>
  )
}

function Nav({ onBack, onNext, loading, nextLabel = 'Continuar' }: any) {
  return (
    <View className="flex-row gap-2 mt-3">
      <TouchableOpacity onPress={onBack} disabled={loading} className="border border-neutral-300 rounded-xl py-3 px-4 items-center">
        <Text className="text-neutral-700 font-semibold">Voltar</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onNext} disabled={loading} className="flex-1 bg-emerald-600 rounded-xl py-3 items-center">
        {loading ? <ActivityIndicator color="white" /> : <Text className="text-white font-semibold">{nextLabel}</Text>}
      </TouchableOpacity>
    </View>
  )
}
