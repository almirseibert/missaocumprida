import { useCallback, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  Alert, TextInput, RefreshControl, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useFocusEffect } from 'expo-router'
import { LogOut, Wallet, Star, ChevronRight, MapPin, ShieldAlert, ShieldCheck, Clock, AlertCircle, Gift, BellRing, BarChart3, Package, CalendarDays, Repeat, LifeBuoy } from 'lucide-react-native'
import { useAuthStore } from '../../src/store/auth'
import { api, getApiError } from '../../src/lib/api'

type Section = 'view' | 'basic' | 'address' | 'emergency'

const onlyDigits = (v: string) => v.replace(/\D/g, '')

export default function PerfilScreen() {
  const { user, setUser, logout } = useAuthStore()
  const [section, setSection] = useState<Section>('view')
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // Basic
  const [name, setName] = useState(user?.name ?? '')
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [bio, setBio] = useState(user?.bio ?? '')
  const [cpf, setCpf] = useState(user?.cpf ?? '')
  const [rg, setRg] = useState(user?.rg ?? '')
  const [birthDate, setBirthDate] = useState(user?.birth_date ? user.birth_date.slice(0, 10) : '')
  const [motherName, setMotherName] = useState(user?.mother_name ?? '')
  // Address
  const [zip, setZip] = useState(user?.address_zip ?? '')
  const [street, setStreet] = useState(user?.address_street ?? '')
  const [number, setNumber] = useState(user?.address_number ?? '')
  const [complement, setComplement] = useState(user?.address_complement ?? '')
  const [neighborhood, setNeighborhood] = useState(user?.address_neighborhood ?? '')
  const [city, setCity] = useState(user?.address_city ?? '')
  const [stateUf, setStateUf] = useState(user?.address_state ?? '')
  const [cepLoading, setCepLoading] = useState(false)
  // Emergency
  const [emName, setEmName] = useState(user?.emergency_contact_name ?? '')
  const [emPhone, setEmPhone] = useState(user?.emergency_contact_phone ?? '')

  useFocusEffect(useCallback(() => {
    api.get('/users/me').then(r => setUser(r.data.data)).catch(() => {})
  }, []))

  function reloadFromUser() {
    if (!user) return
    setName(user.name); setPhone(user.phone ?? ''); setBio(user.bio ?? '')
    setCpf(user.cpf ?? ''); setRg(user.rg ?? ''); setBirthDate(user.birth_date ? user.birth_date.slice(0, 10) : '')
    setMotherName(user.mother_name ?? '')
    setZip(user.address_zip ?? ''); setStreet(user.address_street ?? ''); setNumber(user.address_number ?? '')
    setComplement(user.address_complement ?? ''); setNeighborhood(user.address_neighborhood ?? '')
    setCity(user.address_city ?? ''); setStateUf(user.address_state ?? '')
    setEmName(user.emergency_contact_name ?? ''); setEmPhone(user.emergency_contact_phone ?? '')
  }

  async function lookupCep() {
    const c = onlyDigits(zip)
    if (c.length !== 8) { Alert.alert('CEP inválido', 'O CEP deve ter 8 dígitos'); return }
    setCepLoading(true)
    try {
      const r = await fetch(`https://viacep.com.br/ws/${c}/json/`)
      const d = await r.json()
      if (d.erro) { Alert.alert('CEP não encontrado'); return }
      setStreet(d.logradouro ?? ''); setNeighborhood(d.bairro ?? '')
      setCity(d.localidade ?? ''); setStateUf(d.uf ?? '')
    } catch {
      Alert.alert('Erro', 'Falha ao consultar CEP')
    } finally {
      setCepLoading(false)
    }
  }

  async function save(which: Section) {
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {}
      if (which === 'basic') {
        Object.assign(payload, {
          name, phone: phone || undefined, bio: bio || undefined,
          cpf: cpf ? onlyDigits(cpf) : undefined, rg: rg || undefined,
          birth_date: birthDate ? new Date(birthDate + 'T00:00:00Z').toISOString() : undefined,
          mother_name: motherName || undefined,
        })
      } else if (which === 'address') {
        Object.assign(payload, {
          address_zip: zip ? onlyDigits(zip) : undefined,
          address_street: street || undefined,
          address_number: number || undefined,
          address_complement: complement || undefined,
          address_neighborhood: neighborhood || undefined,
          address_city: city || undefined,
          address_state: stateUf ? stateUf.toUpperCase() : undefined,
        })
      } else if (which === 'emergency') {
        Object.assign(payload, {
          emergency_contact_name: emName || undefined,
          emergency_contact_phone: emPhone || undefined,
        })
      }
      const { data } = await api.put('/users/me', payload)
      setUser(data.data)
      Alert.alert('Salvo', 'Dados atualizados com sucesso.')
      setSection('view')
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
  const profileComplete = !!(user.cpf && user.address_zip && user.address_street && user.emergency_contact_name)

  // Estilos para o card de verificação por status
  const verStyles = {
    APPROVED: { bg: 'bg-accent-50', border: 'border-accent-100',  title: 'text-accent-700', body: 'text-accent-700', icon: '#059669', Icon: ShieldCheck,  label: 'Conta verificada',      desc: 'Você pode usar todas as funcionalidades.' },
    PENDING:  { bg: 'bg-brand-50',  border: 'border-brand-100',   title: 'text-brand-700',  body: 'text-brand-700',  icon: '#1D4ED8', Icon: Clock,         label: 'Em análise',            desc: 'Aguarde até 48h pela análise.' },
    REJECTED: { bg: 'bg-red-50',    border: 'border-red-200',     title: 'text-red-700',    body: 'text-red-700',    icon: '#DC2626', Icon: AlertCircle,   label: 'Verificação recusada',  desc: user.document_rejection_reason || 'Toque para reenviar.' },
    UNSENT:   { bg: 'bg-amber-50',  border: 'border-amber-200',   title: 'text-amber-800',  body: 'text-amber-800',  icon: '#D97706', Icon: ShieldAlert,   label: 'Verificação pendente',  desc: 'Envie documento e selfie para criar pedidos e propostas.' },
  } as const
  const verKey = (user.document_verification_status as keyof typeof verStyles | undefined) ?? 'UNSENT'
  const ver = verStyles[verKey in verStyles ? verKey : 'UNSENT']
  const VerIcon = ver.Icon

  return (
    <SafeAreaView className="flex-1 bg-slate2-50">
      <ScrollView
        contentContainerClassName="pb-10"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {
          setRefreshing(true)
          api.get('/users/me').then(r => setUser(r.data.data)).finally(() => setRefreshing(false))
        }} />}
      >
        {/* Header — gradiente do guia (160deg, p900→p700) */}
        <View className="bg-brand-700 px-5 pt-8 pb-10 items-center">
          <View className="w-20 h-20 rounded-full bg-brand-400 items-center justify-center mb-3 border-[3px] border-white/30">
            <Text className="font-display-extrabold text-white text-3xl">
              {user.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text className="font-display-extrabold text-white text-xl">{user.name}</Text>
          <Text className="font-sans text-white/75 text-sm mt-0.5">{user.email}</Text>
          <View className="flex-row gap-4 mt-3">
            <View className="items-center">
              <Text className="font-display-extrabold text-white text-lg">
                {(user.rating_avg ?? 0).toFixed(1)}
              </Text>
              <Text className="font-sans text-white/70 text-xs">Avaliação</Text>
            </View>
            <View className="w-px bg-white/30" />
            <View className="items-center">
              <Text className="font-display-extrabold text-white text-lg">
                {user.rating_count ?? 0}
              </Text>
              <Text className="font-sans text-white/70 text-xs">Avaliações</Text>
            </View>
          </View>
        </View>

        <View className="px-5 -mt-5 gap-4">
          {/* Card de verificação */}
          {user.role !== 'ADMIN' && (
            <TouchableOpacity
              onPress={() => router.push('/(app)/verificacao')}
              className={`rounded-2xl p-4 flex-row items-center gap-3 border ${ver.bg} ${ver.border}`}
            >
              <VerIcon size={20} color={ver.icon} />
              <View className="flex-1">
                <Text className={`font-display-semibold text-sm ${ver.title}`}>
                  {ver.label}
                </Text>
                <Text className={`font-sans text-xs mt-0.5 ${ver.body}`}>
                  {ver.desc}
                </Text>
              </View>
              <ChevronRight size={16} color="#94A3B8" />
            </TouchableOpacity>
          )}

          {!profileComplete && (
            <View className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex-row items-start gap-3">
              <ShieldAlert size={18} color="#D97706" />
              <View className="flex-1">
                <Text className="font-display-semibold text-amber-900 text-sm">
                  Complete seu cadastro
                </Text>
                <Text className="font-sans text-xs text-amber-800 mt-0.5 leading-relaxed">
                  Para aumentar a confiança da comunidade e habilitar verificações,
                  informe CPF, endereço completo e contato de emergência.
                </Text>
              </View>
            </View>
          )}

          {/* SEÇÃO: Dados básicos */}
          <Card>
            <Header title="Dados pessoais" editing={section === 'basic'} onEdit={() => { reloadFromUser(); setSection('basic') }} onCancel={() => setSection('view')} />
            {section === 'basic' ? (
              <View className="gap-3 mt-1">
                <Field label="Nome completo *" value={name} onChange={setName} />
                <Field label="Telefone *" value={phone} onChange={setPhone} keyboardType="phone-pad" />
                <Field label="CPF / CNPJ *" value={cpf} onChange={setCpf} keyboardType="number-pad" />
                <Field label="RG *" value={rg} onChange={setRg} />
                <Field label="Data de nascimento (AAAA-MM-DD) *" value={birthDate} onChange={setBirthDate} placeholder="2000-01-31" />
                <Field label="Nome da mãe *" value={motherName} onChange={setMotherName} />
                <Field label="Bio" value={bio} onChange={setBio} multiline />
                <SaveBtn loading={saving} onPress={() => save('basic')} />
              </View>
            ) : (
              <View className="mt-1">
                <InfoRow label="Telefone" value={user.phone || '—'} />
                <InfoRow label="CPF" value={user.cpf || '—'} />
                <InfoRow label="RG" value={user.rg || '—'} />
                <InfoRow label="Nascimento" value={user.birth_date ? user.birth_date.slice(0, 10) : '—'} />
                <InfoRow label="Mãe" value={user.mother_name || '—'} />
                <InfoRow label="Tipo de conta" value={
                  user.role === 'CLIENT' ? 'Cliente' :
                  user.role === 'PROVIDER' ? 'Prestador' :
                  user.role === 'BOTH' ? 'Cliente e Prestador' : 'Admin'
                } />
              </View>
            )}
          </Card>

          {/* SEÇÃO: Endereço */}
          <Card>
            <Header
              title="Endereço"
              editing={section === 'address'}
              onEdit={() => { reloadFromUser(); setSection('address') }}
              onCancel={() => setSection('view')}
            />
            {section === 'address' ? (
              <View className="gap-3 mt-1">
                <View className="flex-row gap-2 items-end">
                  <View className="flex-1">
                    <Field label="CEP *" value={zip} onChange={setZip} keyboardType="number-pad" placeholder="00000-000" />
                  </View>
                  <TouchableOpacity
                    onPress={lookupCep}
                    disabled={cepLoading}
                    className="bg-brand-700 rounded-xl px-4 py-2.5 items-center justify-center h-[42px]"
                  >
                    {cepLoading
                      ? <ActivityIndicator color="#fff" />
                      : <Text className="font-display-bold text-white text-sm">Buscar</Text>}
                  </TouchableOpacity>
                </View>
                <Field label="Logradouro *" value={street} onChange={setStreet} />
                <View className="flex-row gap-3">
                  <View className="flex-1"><Field label="Número *" value={number} onChange={setNumber} /></View>
                  <View className="flex-1"><Field label="Complemento" value={complement} onChange={setComplement} /></View>
                </View>
                <Field label="Bairro *" value={neighborhood} onChange={setNeighborhood} />
                <View className="flex-row gap-3">
                  <View className="flex-1"><Field label="Cidade *" value={city} onChange={setCity} /></View>
                  <View className="w-20"><Field label="UF *" value={stateUf} onChange={(t) => setStateUf(t.toUpperCase())} /></View>
                </View>
                <SaveBtn loading={saving} onPress={() => save('address')} />
              </View>
            ) : (
              <View className="mt-1 flex-row gap-2 items-start">
                <MapPin size={14} color="#64748B" style={{ marginTop: 4 }} />
                <Text className="font-sans text-sm text-slate2-700 flex-1 leading-snug">
                  {user.address_street
                    ? `${user.address_street}, ${user.address_number ?? 's/n'}${user.address_complement ? ' — ' + user.address_complement : ''}\n${user.address_neighborhood ?? ''}${user.address_neighborhood && user.address_city ? ' · ' : ''}${user.address_city ?? ''}${user.address_state ? '/' + user.address_state : ''}\nCEP: ${user.address_zip ?? '—'}`
                    : 'Nenhum endereço cadastrado'}
                </Text>
              </View>
            )}
          </Card>

          {/* SEÇÃO: Contato de emergência */}
          <Card>
            <Header
              title="Contato de emergência"
              editing={section === 'emergency'}
              onEdit={() => { reloadFromUser(); setSection('emergency') }}
              onCancel={() => setSection('view')}
            />
            {section === 'emergency' ? (
              <View className="gap-3 mt-1">
                <Field label="Nome do contato *" value={emName} onChange={setEmName} />
                <Field label="Telefone do contato *" value={emPhone} onChange={setEmPhone} keyboardType="phone-pad" />
                <SaveBtn loading={saving} onPress={() => save('emergency')} />
              </View>
            ) : (
              <View className="mt-1">
                <InfoRow label="Nome" value={user.emergency_contact_name || '—'} />
                <InfoRow label="Telefone" value={user.emergency_contact_phone || '—'} />
              </View>
            )}
          </Card>

          {/* Carteira (prestador) */}
          {isProvider && (
            <TouchableOpacity
              onPress={() => router.push('/(app)/carteira')}
              className="bg-white rounded-2xl p-4 flex-row items-center justify-between border border-slate2-200"
            >
              <View className="flex-row items-center gap-3">
                <View className="w-10 h-10 rounded-full bg-accent-50 items-center justify-center">
                  <Wallet size={20} color="#059669" />
                </View>
                <View>
                  <Text className="font-display-semibold text-slate2-900">Carteira</Text>
                  <Text className="font-sans text-xs text-slate2-500">
                    Saldo: R$ {(user.provider_balance ?? 0).toFixed(2)}
                  </Text>
                </View>
              </View>
              <ChevronRight size={18} color="#94A3B8" />
            </TouchableOpacity>
          )}

          {/* Dashboard (prestador) */}
          {isProvider && (
            <TouchableOpacity
              onPress={() => router.push('/(app)/dashboard' as any)}
              className="bg-white rounded-2xl p-4 flex-row items-center justify-between border border-slate2-200"
            >
              <View className="flex-row items-center gap-3">
                <View className="w-10 h-10 rounded-full bg-violet-50 items-center justify-center">
                  <BarChart3 size={20} color="#7C3AED" />
                </View>
                <View>
                  <Text className="font-display-semibold text-slate2-900">Dashboard</Text>
                  <Text className="font-sans text-xs text-slate2-500">Ganhos, propostas e desempenho</Text>
                </View>
              </View>
              <ChevronRight size={18} color="#94A3B8" />
            </TouchableOpacity>
          )}

          {/* Verificado Pro (prestador) */}
          {isProvider && (
            <TouchableOpacity
              onPress={() => router.push('/(app)/verificar-pro' as any)}
              className={`rounded-2xl p-4 flex-row items-center justify-between border-2 ${user.is_verified_pro ? 'border-blue-300 bg-blue-50' : 'border-slate2-200 bg-white'}`}
            >
              <View className="flex-row items-center gap-3">
                <View className="w-10 h-10 rounded-full bg-blue-100 items-center justify-center">
                  <ShieldCheck size={20} color="#2563EB" />
                </View>
                <View>
                  <Text className="font-display-semibold text-slate2-900">
                    {user.is_verified_pro ? 'Verificado Pro ✓' : 'Tornar-se Verificado Pro'}
                  </Text>
                  <Text className="font-sans text-xs text-slate2-500">
                    {user.is_verified_pro ? 'Selo ativo' : 'Selo + boost grátis · R$ 29,90/mês'}
                  </Text>
                </View>
              </View>
              <ChevronRight size={18} color="#94A3B8" />
            </TouchableOpacity>
          )}

          {/* Minha agenda (prestador) */}
          {isProvider && (
            <TouchableOpacity
              onPress={() => router.push('/(app)/agenda-config' as any)}
              className="bg-white rounded-2xl p-4 flex-row items-center justify-between border border-slate2-200"
            >
              <View className="flex-row items-center gap-3">
                <View className="w-10 h-10 rounded-full bg-violet-50 items-center justify-center">
                  <CalendarDays size={20} color="#7C3AED" />
                </View>
                <View>
                  <Text className="font-display-semibold text-slate2-900">Minha agenda</Text>
                  <Text className="font-sans text-xs text-slate2-500">Horários disponíveis e dias bloqueados</Text>
                </View>
              </View>
              <ChevronRight size={18} color="#94A3B8" />
            </TouchableOpacity>
          )}

          {/* Assinaturas */}
          <TouchableOpacity
            onPress={() => router.push('/(app)/assinaturas' as any)}
            className="bg-white rounded-2xl p-4 flex-row items-center justify-between border border-slate2-200"
          >
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-full bg-indigo-50 items-center justify-center">
                <Repeat size={20} color="#4338CA" />
              </View>
              <View>
                <Text className="font-display-semibold text-slate2-900">Assinaturas</Text>
                <Text className="font-sans text-xs text-slate2-500">Serviços recorrentes com desconto</Text>
              </View>
            </View>
            <ChevronRight size={18} color="#94A3B8" />
          </TouchableOpacity>

          {/* Meus Pacotes (prestador) */}
          {isProvider && (
            <TouchableOpacity
              onPress={() => router.push('/(app)/perfil-pacotes' as any)}
              className="bg-white rounded-2xl p-4 flex-row items-center justify-between border border-slate2-200"
            >
              <View className="flex-row items-center gap-3">
                <View className="w-10 h-10 rounded-full bg-amber-50 items-center justify-center">
                  <Package size={20} color="#B45309" />
                </View>
                <View>
                  <Text className="font-display-semibold text-slate2-900">Meus Pacotes</Text>
                  <Text className="font-sans text-xs text-slate2-500">Ofertas pré-precificadas em 1 clique</Text>
                </View>
              </View>
              <ChevronRight size={18} color="#94A3B8" />
            </TouchableOpacity>
          )}

          {/* Indique e ganhe */}
          <TouchableOpacity
            onPress={() => router.push('/(app)/indicar' as any)}
            className="bg-emerald-50 rounded-2xl p-4 flex-row items-center justify-between border border-emerald-200"
          >
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-full bg-emerald-100 items-center justify-center">
                <Gift size={20} color="#047857" />
              </View>
              <View>
                <Text className="font-display-semibold text-emerald-900">Indique e ganhe R$ 30</Text>
                <Text className="font-sans text-xs text-emerald-700">
                  {user.credit_balance && user.credit_balance > 0
                    ? `Seu saldo: R$ ${user.credit_balance.toFixed(2)}`
                    : 'Convide amigos e ganhe crédito'}
                </Text>
              </View>
            </View>
            <ChevronRight size={18} color="#047857" />
          </TouchableOpacity>

          {/* Notificações */}
          <TouchableOpacity
            onPress={() => router.push('/(app)/notificacoes-config' as any)}
            className="bg-white rounded-2xl p-4 flex-row items-center justify-between border border-slate2-200"
          >
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-full bg-brand-50 items-center justify-center">
                <BellRing size={20} color="#1D4ED8" />
              </View>
              <View>
                <Text className="font-display-semibold text-slate2-900">Notificações</Text>
                <Text className="font-sans text-xs text-slate2-500">Canais e preferências</Text>
              </View>
            </View>
            <ChevronRight size={18} color="#94A3B8" />
          </TouchableOpacity>

          {/* Suporte */}
          <TouchableOpacity
            onPress={() => router.push('/(app)/suporte' as any)}
            className="bg-white rounded-2xl p-4 flex-row items-center justify-between border border-slate2-200"
          >
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-full bg-brand-50 items-center justify-center">
                <LifeBuoy size={20} color="#1D4ED8" />
              </View>
              <View>
                <Text className="font-display-semibold text-slate2-900">Falar com a equipe</Text>
                <Text className="font-sans text-xs text-slate2-500">Problemas, sugestões e dúvidas</Text>
              </View>
            </View>
            <ChevronRight size={18} color="#94A3B8" />
          </TouchableOpacity>

          {/* Avaliações */}
          {(user.rating_count ?? 0) > 0 && (
            <Card>
              <View className="flex-row items-center gap-2 mb-1">
                <Star size={18} color="#F59E0B" fill="#F59E0B" />
                <Text className="font-display-semibold text-slate2-900">
                  {(user.rating_avg ?? 0).toFixed(1)} · {user.rating_count ?? 0} avaliações
                </Text>
              </View>
            </Card>
          )}

          {/* Sair */}
          <TouchableOpacity
            onPress={handleLogout}
            className="bg-red-50 rounded-2xl p-4 flex-row items-center gap-3 border border-red-100"
          >
            <LogOut size={20} color="#DC2626" />
            <Text className="font-display-semibold text-red-600">Sair da conta</Text>
          </TouchableOpacity>

          <Text className="font-sans text-[10px] text-slate2-400 text-center mt-2 px-4 leading-relaxed">
            * Campos obrigatórios. Os dados podem ser usados para consultas de antecedentes
            conforme nossos termos de uso.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

// ---------------------------------------------------------------------------
function Card({ children }: { children: React.ReactNode }) {
  return (
    <View className="bg-white rounded-2xl p-4 border border-slate2-200">
      {children}
    </View>
  )
}

function Header({ title, editing, onEdit, onCancel }: { title: string; editing: boolean; onEdit: () => void; onCancel: () => void }) {
  return (
    <View className="flex-row justify-between items-center mb-2">
      <Text className="font-display-semibold text-slate2-900">{title}</Text>
      {editing ? (
        <TouchableOpacity onPress={onCancel}>
          <Text className="font-sans-medium text-slate2-500 text-sm">Cancelar</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity onPress={onEdit}>
          <Text className="font-sans-semibold text-brand-700 text-sm">Editar</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

function Field({ label, value, onChange, placeholder, keyboardType, multiline }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; keyboardType?: 'default' | 'phone-pad' | 'number-pad' | 'decimal-pad' | 'email-address';
  multiline?: boolean;
}) {
  const [focused, setFocused] = useState(false)
  return (
    <View>
      <Text className="font-sans text-xs text-slate2-500 mb-1">{label}</Text>
      <TextInput
        className={`bg-white border rounded-xl px-3 py-2.5 text-slate2-900 font-sans ${
          focused ? 'border-brand-500' : 'border-slate2-200'
        }`}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        keyboardType={keyboardType}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
    </View>
  )
}

function SaveBtn({ loading, onPress }: { loading: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={loading}
      className={`rounded-xl py-3 items-center mt-1 ${loading ? 'bg-brand-400' : 'bg-brand-700'}`}
    >
      <Text className="font-display-bold text-white">
        {loading ? 'Salvando…' : 'Salvar'}
      </Text>
    </TouchableOpacity>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between py-1.5 border-b border-slate2-100">
      <Text className="font-sans text-sm text-slate2-500">{label}</Text>
      <Text className="font-sans-medium text-sm text-slate2-800 flex-1 text-right ml-4" numberOfLines={2}>
        {value}
      </Text>
    </View>
  )
}
