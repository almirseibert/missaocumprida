import { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, Image, TextInput,
  ActivityIndicator, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import {
  ArrowLeft, Camera, FileCheck, ShieldCheck, AlertCircle, Clock,
  Check, UserCheck, MapPin, PhoneCall,
} from 'lucide-react-native'
import { api, getApiError } from '../../src/lib/api'
import { formatDate } from '../../src/lib/utils'
import { useAuthStore } from '../../src/store/auth'

interface VerificationData {
  document_photo_url: string | null
  selfie_photo_url: string | null
  document_submitted_at: string | null
  document_verification_status: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED'
  document_rejection_reason: string | null
  document_reviewed_at: string | null
  profile_complete: boolean
  missing_labels: string[]
}

type LocalAsset = { uri: string; name: string; type: string }
const onlyDigits = (v: string) => v.replace(/\D/g, '')

export default function VerificacaoScreen() {
  const { user, fetchMe } = useAuthStore()
  const [status, setStatus] = useState<VerificationData | null>(null)
  const [loading, setLoading] = useState(true)

  const [profile, setProfile] = useState({
    cpf: '', rg: '', birth_date: '', mother_name: '',
    address_zip: '', address_street: '', address_number: '', address_complement: '',
    address_neighborhood: '', address_city: '', address_state: '',
    emergency_contact_name: '', emergency_contact_phone: '',
  })
  const [cepLoading, setCepLoading] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)

  const [doc, setDoc] = useState<LocalAsset | null>(null)
  const [selfie, setSelfie] = useState<LocalAsset | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function load() {
    try {
      const r = await api.get('/users/me/verification')
      setStatus(r.data.data)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  useEffect(() => {
    if (!user) return
    setProfile({
      cpf: user.cpf ?? '',
      rg: user.rg ?? '',
      birth_date: user.birth_date ? user.birth_date.slice(0, 10) : '',
      mother_name: user.mother_name ?? '',
      address_zip: user.address_zip ?? '',
      address_street: user.address_street ?? '',
      address_number: user.address_number ?? '',
      address_complement: user.address_complement ?? '',
      address_neighborhood: user.address_neighborhood ?? '',
      address_city: user.address_city ?? '',
      address_state: user.address_state ?? '',
      emergency_contact_name: user.emergency_contact_name ?? '',
      emergency_contact_phone: user.emergency_contact_phone ?? '',
    })
  }, [user])

  function up<K extends keyof typeof profile>(k: K, v: string) {
    setProfile((p) => ({ ...p, [k]: v }))
  }

  async function lookupCep() {
    const c = onlyDigits(profile.address_zip)
    if (c.length !== 8) { Alert.alert('CEP inválido', 'Deve ter 8 dígitos'); return }
    setCepLoading(true)
    try {
      const r = await fetch(`https://viacep.com.br/ws/${c}/json/`)
      const d = await r.json()
      if (d.erro) { Alert.alert('CEP não encontrado'); return }
      setProfile((p) => ({
        ...p,
        address_street: d.logradouro || p.address_street,
        address_neighborhood: d.bairro || p.address_neighborhood,
        address_city: d.localidade || p.address_city,
        address_state: d.uf || p.address_state,
      }))
    } catch {
      Alert.alert('Erro', 'Falha ao consultar CEP')
    } finally {
      setCepLoading(false)
    }
  }

  async function saveProfile() {
    setProfileSaving(true)
    try {
      const payload: Record<string, unknown> = {
        cpf: profile.cpf ? onlyDigits(profile.cpf) : undefined,
        rg: profile.rg || undefined,
        birth_date: profile.birth_date ? new Date(profile.birth_date + 'T00:00:00Z').toISOString() : undefined,
        mother_name: profile.mother_name || undefined,
        address_zip: profile.address_zip ? onlyDigits(profile.address_zip) : undefined,
        address_street: profile.address_street || undefined,
        address_number: profile.address_number || undefined,
        address_complement: profile.address_complement || undefined,
        address_neighborhood: profile.address_neighborhood || undefined,
        address_city: profile.address_city || undefined,
        address_state: profile.address_state ? profile.address_state.toUpperCase() : undefined,
        emergency_contact_name: profile.emergency_contact_name || undefined,
        emergency_contact_phone: profile.emergency_contact_phone || undefined,
      }
      await api.put('/users/me', payload)
      await fetchMe()
      await load()
      Alert.alert('Salvo', 'Dados atualizados.')
    } catch (err) {
      Alert.alert('Erro', getApiError(err))
    } finally {
      setProfileSaving(false)
    }
  }

  function toAsset(a: ImagePicker.ImagePickerAsset): LocalAsset {
    const ext = (a.fileName?.split('.').pop() || 'jpg').toLowerCase()
    return {
      uri: a.uri,
      name: a.fileName || `upload-${Date.now()}.${ext}`,
      type: a.mimeType || `image/${ext === 'png' ? 'png' : 'jpeg'}`,
    }
  }

  async function pickDocument() {
    const choice = await new Promise<'camera' | 'library' | 'cancel'>((resolve) => {
      Alert.alert('Foto do documento', 'Tirar foto agora ou escolher da galeria?', [
        { text: 'Câmera', onPress: () => resolve('camera') },
        { text: 'Galeria', onPress: () => resolve('library') },
        { text: 'Cancelar', style: 'cancel', onPress: () => resolve('cancel') },
      ])
    })
    if (choice === 'cancel') return
    const perm = choice === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) { Alert.alert('Permissão necessária'); return }
    const res = choice === 'camera'
      ? await ImagePicker.launchCameraAsync({ quality: 0.85, mediaTypes: ImagePicker.MediaTypeOptions.Images })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.85, mediaTypes: ImagePicker.MediaTypeOptions.Images })
    if (res.canceled || !res.assets?.[0]) return
    setDoc(toAsset(res.assets[0]))
  }

  async function takeSelfie() {
    const perm = await ImagePicker.requestCameraPermissionsAsync()
    if (!perm.granted) { Alert.alert('Permissão necessária'); return }
    const res = await ImagePicker.launchCameraAsync({
      quality: 0.85,
      cameraType: ImagePicker.CameraType.front,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    })
    if (res.canceled || !res.assets?.[0]) return
    setSelfie(toAsset(res.assets[0]))
  }

  async function submit() {
    if (!status?.profile_complete) {
      Alert.alert('Cadastro incompleto', 'Preencha todos os dados antes de enviar para análise.')
      return
    }
    if (!doc || !selfie) {
      Alert.alert('Atenção', 'Envie documento e selfie antes de continuar.')
      return
    }
    setSubmitting(true)
    try {
      const fd = new FormData()
      // @ts-expect-error RN FormData
      fd.append('document', { uri: doc.uri, name: doc.name, type: doc.type })
      // @ts-expect-error RN FormData
      fd.append('selfie', { uri: selfie.uri, name: selfie.name, type: selfie.type })
      await api.post('/users/me/verification', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      Alert.alert('Enviado!', 'Cadastro em análise. Resposta em até 48h úteis.')
      setDoc(null); setSelfie(null)
      await load(); await fetchMe()
    } catch (err) {
      Alert.alert('Erro', getApiError(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading || !status) {
    return <ActivityIndicator className="flex-1 mt-20" color="#1D4ED8" />
  }

  const isApproved = status.document_verification_status === 'APPROVED'
  const isPending  = status.document_verification_status === 'PENDING'
  const isRejected = status.document_verification_status === 'REJECTED'

  const step1Done = status.profile_complete
  const step2Done = !!doc || (isPending && !!status.document_photo_url)
  const step3Done = !!selfie || (isPending && !!status.selfie_photo_url)
  const canSubmit = step1Done && step2Done && step3Done && !isApproved && !isPending

  return (
    <SafeAreaView className="flex-1 bg-slate2-50">
      <View className="flex-row items-center px-4 py-3 bg-white border-b border-slate2-100">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <ArrowLeft size={22} color="#334155" />
        </TouchableOpacity>
        <View className="flex-row items-center gap-2 flex-1">
          <ShieldCheck size={20} color="#1D4ED8" />
          <Text className="font-display-bold text-lg text-slate2-900">
            Verificação de identidade
          </Text>
        </View>
      </View>

      <ScrollView contentContainerClassName="p-5 gap-4 pb-20">
        {isApproved && (
          <Banner color="accent" iconNode={<FileCheck size={20} color="#059669" />} title="Conta verificada">
            Aprovado em {status.document_reviewed_at ? formatDate(status.document_reviewed_at) : '—'}.
          </Banner>
        )}
        {isPending && (
          <Banner color="amber" iconNode={<Clock size={20} color="#D97706" />} title="Em análise">
            Enviado em {status.document_submitted_at ? formatDate(status.document_submitted_at) : '—'}. Resposta em até 48h úteis.
          </Banner>
        )}
        {isRejected && (
          <Banner color="red" iconNode={<AlertCircle size={20} color="#DC2626" />} title="Verificação recusada">
            {status.document_rejection_reason || 'Não foi possível confirmar sua identidade.'} Revise abaixo e reenvie.
          </Banner>
        )}

        {!isApproved && !isPending && (
          <View className="flex-row items-center gap-1">
            <StepPill n={1} label="Dados" done={step1Done} active={!step1Done} />
            <View className="flex-1 h-px bg-slate2-200" />
            <StepPill n={2} label="Documento" done={step2Done} active={step1Done && !step2Done} />
            <View className="flex-1 h-px bg-slate2-200" />
            <StepPill n={3} label="Selfie" done={step3Done} active={step1Done && step2Done && !step3Done} />
          </View>
        )}

        {/* Etapa 1 — dados */}
        {!isApproved && !isPending && (
          <SectionCard number="1" title="Complete seu cadastro" done={step1Done}>
            {step1Done ? (
              <View className="bg-accent-50 border border-accent-100 rounded-xl p-3 flex-row items-center gap-2">
                <Check size={16} color="#059669" />
                <Text className="font-sans text-sm text-accent-700 flex-1">
                  Todos os dados estão preenchidos.
                </Text>
              </View>
            ) : (
              <View className="gap-3">
                {status.missing_labels.length > 0 && (
                  <View className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <Text className="font-display-semibold text-xs text-amber-900 mb-1">
                      Faltam {status.missing_labels.length} campo(s):
                    </Text>
                    <Text className="font-sans text-xs text-amber-800">
                      {status.missing_labels.join(' · ')}
                    </Text>
                  </View>
                )}

                <SubHeader icon={<UserCheck size={14} color="#1D4ED8" />} title="Identificação" />
                <Field label="CPF *" value={profile.cpf} onChange={(v) => up('cpf', v)} keyboardType="number-pad" />
                <View className="flex-row gap-3">
                  <View className="flex-1"><Field label="RG *" value={profile.rg} onChange={(v) => up('rg', v)} /></View>
                  <View className="flex-1"><Field label="Nascimento (AAAA-MM-DD) *" value={profile.birth_date} onChange={(v) => up('birth_date', v)} placeholder="2000-01-31" /></View>
                </View>
                <Field label="Nome da mãe *" value={profile.mother_name} onChange={(v) => up('mother_name', v)} />

                <SubHeader icon={<MapPin size={14} color="#1D4ED8" />} title="Endereço" />
                <View className="flex-row gap-2 items-end">
                  <View className="flex-1"><Field label="CEP *" value={profile.address_zip} onChange={(v) => up('address_zip', v)} keyboardType="number-pad" /></View>
                  <TouchableOpacity
                    onPress={lookupCep}
                    disabled={cepLoading}
                    className="bg-brand-700 rounded-xl px-3 py-2.5 h-[42px] items-center justify-center"
                  >
                    {cepLoading
                      ? <ActivityIndicator color="#fff" />
                      : <Text className="font-display-bold text-white text-sm">Buscar</Text>}
                  </TouchableOpacity>
                </View>
                <Field label="Logradouro *" value={profile.address_street} onChange={(v) => up('address_street', v)} />
                <View className="flex-row gap-3">
                  <View className="flex-1"><Field label="Número *" value={profile.address_number} onChange={(v) => up('address_number', v)} /></View>
                  <View className="flex-1"><Field label="Complemento" value={profile.address_complement} onChange={(v) => up('address_complement', v)} /></View>
                </View>
                <Field label="Bairro *" value={profile.address_neighborhood} onChange={(v) => up('address_neighborhood', v)} />
                <View className="flex-row gap-3">
                  <View className="flex-1"><Field label="Cidade *" value={profile.address_city} onChange={(v) => up('address_city', v)} /></View>
                  <View className="w-20"><Field label="UF *" value={profile.address_state} onChange={(v) => up('address_state', v.toUpperCase())} /></View>
                </View>

                <SubHeader icon={<PhoneCall size={14} color="#1D4ED8" />} title="Contato de emergência" />
                <Field label="Nome *" value={profile.emergency_contact_name} onChange={(v) => up('emergency_contact_name', v)} />
                <Field label="Telefone *" value={profile.emergency_contact_phone} onChange={(v) => up('emergency_contact_phone', v)} keyboardType="phone-pad" />

                <TouchableOpacity
                  onPress={saveProfile}
                  disabled={profileSaving}
                  className={`rounded-xl py-3 items-center mt-1 ${
                    profileSaving ? 'bg-brand-400' : 'bg-brand-700'
                  }`}
                >
                  <Text className="font-display-bold text-white">
                    {profileSaving ? 'Salvando…' : 'Salvar dados'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </SectionCard>
        )}

        {/* Etapa 2 — documento */}
        {!isApproved && (
          <SectionCard
            number="2"
            title="Foto do documento"
            done={step2Done}
            disabled={!step1Done}
            description="RG, CNH, passaporte ou CTPS digital. Nítido, sem reflexo, com dados visíveis."
          >
            <UploadTile
              uri={doc?.uri ?? (isPending || isRejected ? status.document_photo_url : null) ?? null}
              icon="document"
              label="Selecionar foto do documento"
              disabled={!step1Done}
              onPress={pickDocument}
            />
          </SectionCard>
        )}

        {/* Etapa 3 — selfie */}
        {!isApproved && (
          <SectionCard
            number="3"
            title="Selfie"
            done={step3Done}
            disabled={!step1Done || !step2Done}
            description="Em ambiente bem iluminado, segurando o documento ao lado do rosto."
          >
            <UploadTile
              uri={selfie?.uri ?? (isPending || isRejected ? status.selfie_photo_url : null) ?? null}
              icon="camera"
              label="Tirar selfie"
              disabled={!step1Done || !step2Done}
              onPress={takeSelfie}
            />
          </SectionCard>
        )}

        {!isApproved && !isPending && (
          <View className="bg-brand-50 border border-brand-100 rounded-2xl p-4">
            <Text className="font-display-semibold text-brand-700 text-sm mb-1">
              Tratamento de dados (LGPD)
            </Text>
            <Text className="font-sans text-xs text-brand-700 leading-relaxed">
              Os dados, documento e selfie serão usados apenas para confirmar identidade
              e prevenir fraudes. Não são compartilhados com outros usuários.
            </Text>
          </View>
        )}

        {!isApproved && !isPending && (
          <TouchableOpacity
            onPress={submit}
            disabled={!canSubmit || submitting}
            className={`rounded-xl py-4 items-center ${
              !canSubmit || submitting ? 'bg-brand-400' : 'bg-brand-700'
            }`}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="font-display-bold text-white text-base">
                Enviar para análise
              </Text>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

// ---------------------------------------------------------------------------
function SectionCard({
  number, title, done, disabled, description, children,
}: {
  number: string; title: string; done?: boolean; disabled?: boolean;
  description?: string; children: React.ReactNode
}) {
  const borderCls = disabled
    ? 'border-slate2-200 opacity-60'
    : done
    ? 'border-accent-300'
    : 'border-slate2-200'
  const badgeCls = done
    ? 'bg-accent-600'
    : disabled
    ? 'bg-slate2-300'
    : 'bg-brand-700'
  return (
    <View className={`bg-white rounded-2xl p-4 border ${borderCls}`}>
      <View className="flex-row gap-3 mb-3">
        <View className={`w-7 h-7 rounded-full items-center justify-center ${badgeCls}`}>
          {done
            ? <Check size={14} color="#fff" />
            : <Text className="font-display-bold text-white text-sm">{number}</Text>}
        </View>
        <View className="flex-1">
          <Text className="font-display-semibold text-slate2-900">{title}</Text>
          {description && (
            <Text className="font-sans text-xs text-slate2-500 mt-0.5 leading-relaxed">
              {description}
            </Text>
          )}
        </View>
      </View>
      {children}
    </View>
  )
}

function Field({ label, value, onChange, placeholder, keyboardType }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; keyboardType?: 'default' | 'phone-pad' | 'number-pad' | 'decimal-pad' | 'email-address';
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
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
    </View>
  )
}

function SubHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <View className="flex-row items-center gap-2 mt-1 mb-0.5">
      {icon}
      <Text className="font-display-semibold text-[11px] uppercase tracking-wider text-slate2-500">
        {title}
      </Text>
    </View>
  )
}

function UploadTile({ uri, icon, label, disabled, onPress }: {
  uri: string | null; icon: 'document' | 'camera'; label: string;
  disabled?: boolean; onPress: () => void
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      className={`aspect-[3/2] rounded-xl border-2 border-dashed overflow-hidden items-center justify-center bg-slate2-50 ${
        disabled ? 'border-slate2-200' : 'border-slate2-300'
      }`}
    >
      {uri ? (
        <Image source={{ uri }} className="w-full h-full" resizeMode="cover" />
      ) : (
        <View className="items-center gap-2">
          {icon === 'document'
            ? <FileCheck size={32} color="#94A3B8" />
            : <Camera size={32} color="#94A3B8" />}
          <Text className="font-sans-medium text-sm text-slate2-500">{label}</Text>
          <Text className="font-sans text-[10px] text-slate2-400">
            JPG, PNG ou WebP · até 10 MB
          </Text>
        </View>
      )}
    </TouchableOpacity>
  )
}

function StepPill({ n, label, done, active }: { n: number; label: string; done: boolean; active: boolean }) {
  const bg = done ? 'bg-accent-50' : active ? 'bg-brand-50' : 'bg-slate2-100'
  const txt = done ? 'text-accent-700' : active ? 'text-brand-700' : 'text-slate2-500'
  const dot = done ? 'bg-accent-600' : active ? 'bg-brand-700' : 'bg-slate2-300'
  return (
    <View className={`flex-row items-center gap-1 px-2 py-1 rounded-full ${bg}`}>
      <View className={`w-4 h-4 rounded-full items-center justify-center ${dot}`}>
        <Text className="text-white text-[9px]" style={{ fontFamily: 'PlusJakartaSans_700Bold' }}>
          {done ? '✓' : n}
        </Text>
      </View>
      <Text className={`font-sans-semibold text-[10px] ${txt}`}>{label}</Text>
    </View>
  )
}

function Banner({ color, iconNode, title, children }: {
  color: 'accent' | 'amber' | 'red'; iconNode: React.ReactNode; title: string; children: React.ReactNode
}) {
  const cls = color === 'accent'
    ? 'bg-accent-50 border-accent-100'
    : color === 'amber'
    ? 'bg-amber-50 border-amber-200'
    : 'bg-red-50 border-red-200'
  const titleCls = color === 'accent'
    ? 'text-accent-700'
    : color === 'amber'
    ? 'text-amber-800'
    : 'text-red-700'
  const textCls = color === 'accent'
    ? 'text-accent-700'
    : color === 'amber'
    ? 'text-amber-700'
    : 'text-red-700'
  return (
    <View className={`border rounded-2xl p-4 flex-row gap-3 ${cls}`}>
      {iconNode}
      <View className="flex-1">
        <Text className={`font-display-semibold ${titleCls}`}>{title}</Text>
        <Text className={`font-sans text-sm mt-0.5 leading-relaxed ${textCls}`}>
          {children}
        </Text>
      </View>
    </View>
  )
}
