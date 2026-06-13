'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, FileCheck, Upload, ShieldCheck, AlertCircle, Loader2, Check, MapPinned, PhoneCall, UserCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import { api, getApiErrorMessage } from '@/lib/api'
import { authFileUrl } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PageSpinner } from '@/components/ui/Spinner'

interface VerificationData {
  document_photo_url: string | null
  selfie_photo_url: string | null
  document_submitted_at: string | null
  document_verification_status: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED'
  document_rejection_reason: string | null
  document_reviewed_at: string | null
  profile_complete: boolean
  missing_fields: string[]
  missing_labels: string[]
}

const onlyDigits = (v: string) => v.replace(/\D/g, '')

export default function VerificacaoPage() {
  const router = useRouter()
  const { user, fetchMe } = useAuthStore()
  const [status, setStatus] = useState<VerificationData | null>(null)
  const [loading, setLoading] = useState(true)

  // Etapa 1 — dados pessoais
  const [profileSaving, setProfileSaving] = useState(false)
  const [profile, setProfile] = useState({
    cpf: '', rg: '', birth_date: '', mother_name: '',
    address_zip: '', address_street: '', address_number: '', address_complement: '',
    address_neighborhood: '', address_city: '', address_state: '',
    emergency_contact_name: '', emergency_contact_phone: '',
  })
  const [cepLoading, setCepLoading] = useState(false)

  // Etapas 2 e 3 — arquivos
  const [docFile, setDocFile] = useState<File | null>(null)
  const [selfieFile, setSelfieFile] = useState<File | null>(null)
  const [docPreview, setDocPreview] = useState<string | null>(null)
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null)
  const docInputRef = useRef<HTMLInputElement>(null)
  const selfieInputRef = useRef<HTMLInputElement>(null)
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

  // Pré-popula form com dados já existentes do user
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
    const cep = onlyDigits(profile.address_zip)
    if (cep.length !== 8) { toast.error('CEP deve ter 8 dígitos'); return }
    setCepLoading(true)
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
      const d = await r.json()
      if (d.erro) { toast.error('CEP não encontrado'); return }
      setProfile((p) => ({
        ...p,
        address_street: d.logradouro || p.address_street,
        address_neighborhood: d.bairro || p.address_neighborhood,
        address_city: d.localidade || p.address_city,
        address_state: d.uf || p.address_state,
      }))
      toast.success('Endereço preenchido pelo CEP')
    } catch {
      toast.error('Falha ao consultar CEP')
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
      toast.success('Dados salvos!')
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setProfileSaving(false)
    }
  }

  function handleFile(kind: 'doc' | 'selfie') {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      if (file.size > 10 * 1024 * 1024) { toast.error('Imagem maior que 10 MB'); return }
      const preview = URL.createObjectURL(file)
      if (kind === 'doc') {
        setDocFile(file)
        if (docPreview) URL.revokeObjectURL(docPreview)
        setDocPreview(preview)
      } else {
        setSelfieFile(file)
        if (selfiePreview) URL.revokeObjectURL(selfiePreview)
        setSelfiePreview(preview)
      }
    }
  }

  async function submit() {
    if (!status?.profile_complete) {
      toast.error('Complete seus dados antes de enviar para análise')
      return
    }
    if (!docFile || !selfieFile) {
      toast.error('Envie o documento E a selfie antes de continuar')
      return
    }
    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('document', docFile)
      fd.append('selfie', selfieFile)
      await api.post('/users/me/verification', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      toast.success('Cadastro enviado para análise! Resposta em até 48h úteis.')
      setDocFile(null); setSelfieFile(null)
      setDocPreview(null); setSelfiePreview(null)
      await load()
      await fetchMe()
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading || !status) return <PageSpinner />

  const isApproved = status.document_verification_status === 'APPROVED'
  const isPending = status.document_verification_status === 'PENDING'
  const isRejected = status.document_verification_status === 'REJECTED'

  // Estado das etapas
  const step1Done = status.profile_complete
  const step2Done = !!docFile || (isPending && !!status.document_photo_url)
  const step3Done = !!selfieFile || (isPending && !!status.selfie_photo_url)
  const canSubmit = step1Done && step2Done && step3Done && !isApproved && !isPending

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate2-900 flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-brand-500" /> Verificação de identidade
        </h1>
        <p className="text-sm text-slate2-600 mt-1">
          Obrigatória para criar pedidos e enviar propostas. Complete os 3 passos abaixo.
        </p>
      </div>

      {/* Banner de status */}
      {isApproved && (
        <Banner color="green" icon={<FileCheck className="w-5 h-5 text-green-600 mt-0.5" />} title="Conta verificada">
          Aprovado em {status.document_reviewed_at ? new Date(status.document_reviewed_at).toLocaleString('pt-BR') : '—'}.
          Você pode usar todas as funcionalidades.
        </Banner>
      )}
      {isPending && (
        <Banner color="amber" icon={<Loader2 className="w-5 h-5 text-amber-600 mt-0.5 animate-spin" />} title="Em análise">
          Recebemos seu cadastro em {status.document_submitted_at ? new Date(status.document_submitted_at).toLocaleString('pt-BR') : '—'}.
          Resposta em até 48 horas úteis.
        </Banner>
      )}
      {isRejected && (
        <Banner color="red" icon={<AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />} title="Verificação recusada">
          {status.document_rejection_reason || 'Não foi possível confirmar sua identidade.'} Revise os dados e reenvie abaixo.
        </Banner>
      )}

      {/* Progresso visual */}
      {!isApproved && !isPending && (
        <div className="flex items-center gap-2 text-xs">
          <StepPill n={1} label="Dados" done={step1Done} active={!step1Done} />
          <Connector />
          <StepPill n={2} label="Documento" done={step2Done} active={step1Done && !step2Done} />
          <Connector />
          <StepPill n={3} label="Selfie" done={step3Done} active={step1Done && step2Done && !step3Done} />
        </div>
      )}

      {/* Etapa 1 — Dados pessoais */}
      {!isApproved && !isPending && (
        <Section number="1" title="Complete seu cadastro" icon={<UserCheck className="w-4 h-4" />} done={step1Done}>
          {step1Done ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2 text-sm text-green-800">
              <Check className="w-4 h-4" /> Todos os dados necessários estão preenchidos.
              <button className="ml-auto text-xs underline" onClick={() => router.push('/perfil/editar')}>
                Editar
              </button>
            </div>
          ) : (
            <>
              {status.missing_labels.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900">
                  <p className="font-medium mb-1">Faltam {status.missing_labels.length} campo(s) obrigatório(s):</p>
                  <p>{status.missing_labels.join(' · ')}</p>
                </div>
              )}

              <div className="space-y-3 mt-3">
                <Sub icon={<UserCheck className="w-3.5 h-3.5" />} title="Identificação" />
                <Input label="CPF *" placeholder="000.000.000-00" value={profile.cpf} onChange={(e) => up('cpf', e.target.value)} />
                <div className="grid sm:grid-cols-2 gap-3">
                  <Input label="RG *" value={profile.rg} onChange={(e) => up('rg', e.target.value)} />
                  <Input label="Data de nascimento *" type="date" value={profile.birth_date} onChange={(e) => up('birth_date', e.target.value)} />
                </div>
                <Input label="Nome da mãe *" value={profile.mother_name} onChange={(e) => up('mother_name', e.target.value)} />

                <Sub icon={<MapPinned className="w-3.5 h-3.5" />} title="Endereço" />
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Input label="CEP *" placeholder="00000-000" value={profile.address_zip} onChange={(e) => up('address_zip', e.target.value)} />
                  </div>
                  <Button type="button" variant="outline" onClick={lookupCep} disabled={cepLoading}>
                    {cepLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Buscar'}
                  </Button>
                </div>
                <Input label="Logradouro *" value={profile.address_street} onChange={(e) => up('address_street', e.target.value)} />
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <Input label="Número *" value={profile.address_number} onChange={(e) => up('address_number', e.target.value)} />
                  <Input label="Complemento" className="col-span-1 sm:col-span-2" value={profile.address_complement} onChange={(e) => up('address_complement', e.target.value)} />
                </div>
                <div className="grid sm:grid-cols-3 gap-3">
                  <Input label="Bairro *" value={profile.address_neighborhood} onChange={(e) => up('address_neighborhood', e.target.value)} />
                  <Input label="Cidade *" value={profile.address_city} onChange={(e) => up('address_city', e.target.value)} />
                  <Input label="UF *" maxLength={2} value={profile.address_state} onChange={(e) => up('address_state', e.target.value.toUpperCase())} />
                </div>

                <Sub icon={<PhoneCall className="w-3.5 h-3.5" />} title="Contato de emergência" />
                <div className="grid sm:grid-cols-2 gap-3">
                  <Input label="Nome *" value={profile.emergency_contact_name} onChange={(e) => up('emergency_contact_name', e.target.value)} />
                  <Input label="Telefone *" value={profile.emergency_contact_phone} onChange={(e) => up('emergency_contact_phone', e.target.value)} />
                </div>

                <Button onClick={saveProfile} isLoading={profileSaving}>Salvar dados</Button>
              </div>
            </>
          )}
        </Section>
      )}

      {/* Etapa 2 — Documento */}
      {!isApproved && (
        <Section
          number="2"
          title="Foto do documento"
          icon={<FileCheck className="w-4 h-4" />}
          done={step2Done}
          disabled={!step1Done}
          description="RG, CNH, passaporte ou Carteira de Trabalho digital. Nítido, sem reflexo, com todos os dados visíveis."
        >
          <UploadCard
            preview={docPreview}
            existingUrl={!docPreview && (isPending || isRejected) ? (authFileUrl(status.document_photo_url) ?? null) : null}
            icon={<FileCheck className="w-8 h-8 text-slate2-400" />}
            label="Selecionar foto do documento"
            disabled={!step1Done}
            onClick={() => docInputRef.current?.click()}
          />
          <input ref={docInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFile('doc')} />
        </Section>
      )}

      {/* Etapa 3 — Selfie */}
      {!isApproved && (
        <Section
          number="3"
          title="Selfie"
          icon={<Camera className="w-4 h-4" />}
          done={step3Done}
          disabled={!step1Done || !step2Done}
          description="Selfie em tempo real, em ambiente bem iluminado, segurando o documento ao lado do rosto. Sem óculos escuros ou máscara."
        >
          <UploadCard
            preview={selfiePreview}
            existingUrl={!selfiePreview && (isPending || isRejected) ? (authFileUrl(status.selfie_photo_url) ?? null) : null}
            icon={<Camera className="w-8 h-8 text-slate2-400" />}
            label="Tirar selfie"
            disabled={!step1Done || !step2Done}
            onClick={() => selfieInputRef.current?.click()}
          />
          <input ref={selfieInputRef} type="file" accept="image/jpeg,image/png,image/webp" capture="user" className="hidden" onChange={handleFile('selfie')} />
        </Section>
      )}

      {/* LGPD */}
      {!isApproved && !isPending && (
        <div className="bg-brand-50 border border-brand-200 rounded-2xl p-4 text-sm text-brand-900">
          <p className="font-semibold mb-1">Tratamento de dados (LGPD)</p>
          <p className="leading-relaxed text-xs">
            Os dados, imagens do documento e selfie serão usados apenas para confirmar sua identidade
            e prevenir fraudes, conforme nossos Termos. Não são exibidos a outros usuários da
            plataforma. Você pode solicitar exclusão pelos canais oficiais, ressalvadas obrigações
            legais de retenção.
          </p>
        </div>
      )}

      {/* Submit */}
      {!isApproved && !isPending && (
        <div className="flex gap-3 flex-wrap">
          <Button onClick={submit} isLoading={submitting} disabled={!canSubmit} size="lg">
            <Upload className="w-4 h-4" /> Enviar para análise
          </Button>
          <Button variant="outline" onClick={() => router.back()}>Voltar</Button>
        </div>
      )}

      {isApproved && (
        <div className="bg-white rounded-2xl border border-slate2-200 p-5">
          <p className="text-sm text-slate2-600">
            Caso precise atualizar seus documentos (renovação de RG, mudança de CNH etc.),
            atualize seus dados em Perfil e reenvie aqui.
          </p>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
function Section({
  number, title, icon, done, disabled, description, children,
}: {
  number: string
  title: string
  icon: React.ReactNode
  done?: boolean
  disabled?: boolean
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className={`bg-white rounded-2xl border p-5 ${disabled ? 'border-slate2-200 opacity-60' : done ? 'border-green-300' : 'border-slate2-200'}`}>
      <div className="flex items-start gap-3 mb-3">
        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${done ? 'bg-green-500 text-white' : disabled ? 'bg-slate2-200 text-slate2-500' : 'bg-brand-500 text-white'}`}>
          {done ? <Check className="w-4 h-4" /> : number}
        </span>
        <div className="flex-1">
          <h3 className="font-semibold text-slate2-900 flex items-center gap-2">
            <span className="text-brand-500">{icon}</span> {title}
          </h3>
          {description && <p className="text-xs text-slate2-500 mt-0.5">{description}</p>}
        </div>
      </div>
      {children}
    </div>
  )
}

function Sub({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mt-2 mb-1">
      <span className="text-brand-500">{icon}</span>
      <span className="text-xs font-semibold uppercase tracking-wide text-slate2-500">{title}</span>
    </div>
  )
}

function UploadCard({
  preview, existingUrl, icon, label, onClick, disabled,
}: {
  preview: string | null
  existingUrl: string | null
  icon: React.ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
}) {
  const display = preview || existingUrl
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full aspect-[3/2] rounded-xl border-2 border-dashed transition-colors flex items-center justify-center overflow-hidden bg-slate2-50 ${disabled ? 'border-slate2-200 cursor-not-allowed' : 'border-slate2-300 hover:border-brand-400'}`}
    >
      {display ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={display} alt="" className="w-full h-full object-cover" />
      ) : (
        <div className="flex flex-col items-center gap-2 text-slate2-500">
          {icon}
          <span className="text-sm font-medium">{label}</span>
          <span className="text-xs">JPG, PNG ou WebP · até 10 MB</span>
        </div>
      )}
    </button>
  )
}

function StepPill({ n, label, done, active }: { n: number; label: string; done: boolean; active: boolean }) {
  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium ${
      done ? 'bg-green-100 text-green-700' : active ? 'bg-brand-100 text-brand-700' : 'bg-slate2-100 text-slate2-500'
    }`}>
      <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
        done ? 'bg-green-500 text-white' : active ? 'bg-brand-500 text-white' : 'bg-slate2-300 text-white'
      }`}>
        {done ? '✓' : n}
      </span>
      {label}
    </div>
  )
}

function Connector() {
  return <span className="flex-1 h-px bg-slate2-200" />
}

function Banner({ color, icon, title, children }: { color: 'green' | 'amber' | 'red'; icon: React.ReactNode; title: string; children: React.ReactNode }) {
  const cls = color === 'green'
    ? 'bg-green-50 border-green-200 text-green-800'
    : color === 'amber'
    ? 'bg-amber-50 border-amber-200 text-amber-800'
    : 'bg-red-50 border-red-200 text-red-800'
  return (
    <div className={`border rounded-2xl p-4 flex items-start gap-3 ${cls}`}>
      {icon}
      <div className="flex-1">
        <p className="font-semibold">{title}</p>
        <p className="text-sm mt-0.5">{children}</p>
      </div>
    </div>
  )
}
