'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import {
  ShieldCheck, ShieldX, Search, Clock, CheckCircle2, XCircle, MinusCircle,
  RefreshCw, Eye, X as XIcon, MapPin, Phone, User as UserIcon, FileText, ArrowLeft,
} from 'lucide-react'
import { api, getApiErrorMessage } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { PageSpinner } from '@/components/ui/Spinner'
import { Modal } from '@/components/ui/Modal'

type VStatus = 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED'

interface AdminUser {
  id: string
  name: string
  email: string
  phone?: string | null
  cpf?: string | null
  rg?: string | null
  birth_date?: string | null
  mother_name?: string | null
  role: 'CLIENT' | 'PROVIDER' | 'BOTH' | 'ADMIN'
  avatar?: string | null
  address_zip?: string | null
  address_street?: string | null
  address_number?: string | null
  address_complement?: string | null
  address_neighborhood?: string | null
  address_city?: string | null
  address_state?: string | null
  emergency_contact_name?: string | null
  emergency_contact_phone?: string | null
  document_photo_url?: string | null
  selfie_photo_url?: string | null
  document_submitted_at?: string | null
  document_verification_status: VStatus
  document_rejection_reason?: string | null
  document_reviewed_at?: string | null
  document_verified: boolean
  created_at: string
}

interface ListResponse {
  users: AdminUser[]
  total: number
  page: number
  limit: number
  summary: Record<VStatus, number>
}

const STATUS_TABS: { value: VStatus; label: string; color: string; icon: typeof Clock }[] = [
  { value: 'PENDING',  label: 'Pendentes',   color: 'amber',  icon: Clock },
  { value: 'APPROVED', label: 'Aprovados',   color: 'green',  icon: CheckCircle2 },
  { value: 'REJECTED', label: 'Recusados',   color: 'red',    icon: XCircle },
  { value: 'NONE',     label: 'Não enviados', color: 'gray',  icon: MinusCircle },
]

export default function AdminVerificacoesPage() {
  const { user } = useAuthStore()
  const router = useRouter()
  const [status, setStatus] = useState<VStatus>('PENDING')
  const [data, setData] = useState<ListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<AdminUser | null>(null)

  // Modal de aprovação/recusa
  const [reviewAction, setReviewAction] = useState<'APPROVED' | 'REJECTED' | null>(null)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Visualizador de imagem
  const [imageOpen, setImageOpen] = useState<string | null>(null)

  // Gate: só admin
  useEffect(() => {
    if (user && user.role !== 'ADMIN') router.replace('/home')
  }, [user, router])

  const load = useCallback(async (s: VStatus, query = '') => {
    setLoading(true)
    try {
      const res = await api.get('/users/admin/verifications', {
        params: { status: s, q: query || undefined, limit: 50 },
      })
      setData(res.data.data)
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(status, q) }, [status, load])

  // Re-busca por query com debounce simples
  useEffect(() => {
    const t = setTimeout(() => load(status, q), 350)
    return () => clearTimeout(t)
  }, [q, status, load])

  async function review(action: 'APPROVED' | 'REJECTED') {
    if (!selected) return
    if (action === 'REJECTED' && !reason.trim()) {
      toast.error('Informe o motivo da recusa')
      return
    }
    setSubmitting(true)
    try {
      await api.put(`/users/${selected.id}/verification/review`, {
        status: action,
        reason: action === 'REJECTED' ? reason.trim() : undefined,
      })
      toast.success(action === 'APPROVED' ? 'Aprovado!' : 'Recusado.')
      setSelected(null); setReviewAction(null); setReason('')
      load(status, q)
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (!user) return <PageSpinner />
  if (user.role !== 'ADMIN') return null

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs text-slate2-500 mb-1">
          <ShieldCheck className="w-3.5 h-3.5" /> Painel administrativo
        </div>
        <h1 className="text-2xl font-bold text-slate2-900">Verificações de identidade</h1>
        <p className="text-sm text-slate2-600 mt-1">
          Aprove ou recuse documentos enviados pelos usuários.
        </p>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {STATUS_TABS.map((t) => {
          const isActive = status === t.value
          const Icon = t.icon
          const count = data?.summary?.[t.value] ?? 0
          return (
            <button
              key={t.value}
              onClick={() => setStatus(t.value)}
              className={`text-left rounded-2xl border p-4 transition-all ${
                isActive
                  ? 'border-brand-500 bg-brand-50 shadow-sm'
                  : 'border-slate2-200 bg-white hover:border-slate2-300'
              }`}
            >
              <Icon className={`w-5 h-5 mb-2 text-${t.color}-500`} />
              <p className="text-2xl font-bold text-slate2-900">{count}</p>
              <p className="text-xs text-slate2-500 mt-0.5">{t.label}</p>
            </button>
          )
        })}
      </div>

      {/* Busca + refresh */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate2-400" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nome, e-mail ou CPF…"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate2-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => load(status, q)}>
          <RefreshCw className="w-4 h-4" /> Atualizar
        </Button>
      </div>

      {/* Lista */}
      {loading ? (
        <PageSpinner />
      ) : !data || data.users.length === 0 ? (
        <div className="bg-white border border-slate2-200 rounded-2xl py-16 text-center">
          <p className="text-4xl mb-2">📭</p>
          <p className="font-medium text-slate2-700">Nada por aqui</p>
          <p className="text-sm text-slate2-500 mt-1">Nenhum usuário no status &quot;{labelFor(status)}&quot;.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.users.map((u) => (
            <UserRow
              key={u.id}
              user={u}
              onOpen={() => { setSelected(u); setReason(''); setReviewAction(null) }}
            />
          ))}
        </div>
      )}

      {/* Modal de detalhes + aprovar/recusar */}
      {selected && (
        <Modal isOpen onClose={() => setSelected(null)} title="" size="lg">
          <UserDetails
            user={selected}
            onClose={() => setSelected(null)}
            onView={(url) => setImageOpen(url)}
            onApprove={() => setReviewAction('APPROVED')}
            onReject={() => setReviewAction('REJECTED')}
            reviewing={!!reviewAction}
            reviewAction={reviewAction}
            reason={reason}
            setReason={setReason}
            onConfirm={() => reviewAction && review(reviewAction)}
            onCancelReview={() => { setReviewAction(null); setReason('') }}
            submitting={submitting}
          />
        </Modal>
      )}

      {/* Lightbox simples para visualizar foto */}
      {imageOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setImageOpen(null)}
        >
          <button
            className="absolute top-4 right-4 text-white p-2 rounded-full bg-white/10 hover:bg-white/20"
            onClick={() => setImageOpen(null)}
            aria-label="Fechar"
          >
            <XIcon className="w-5 h-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageOpen}
            alt=""
            className="max-w-full max-h-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
function UserRow({ user, onOpen }: { user: AdminUser; onOpen: () => void }) {
  const s = user.document_verification_status
  return (
    <button
      onClick={onOpen}
      className="w-full bg-white border border-slate2-200 rounded-2xl p-4 flex items-center gap-4 hover:border-brand-300 hover:shadow-sm transition-all text-left"
    >
      {/* Avatar (foto da selfie quando houver) */}
      <div className="w-12 h-12 rounded-full bg-slate2-100 overflow-hidden flex items-center justify-center flex-shrink-0">
        {user.selfie_photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.selfie_photo_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <UserIcon className="w-5 h-5 text-slate2-400" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-slate2-900 truncate">{user.name}</p>
          <StatusBadge status={s} />
          <RoleBadge role={user.role} />
        </div>
        <p className="text-xs text-slate2-500 mt-0.5 truncate">{user.email}</p>
        <div className="flex gap-3 mt-1 text-xs text-slate2-500">
          {user.cpf && <span>CPF: {maskCpf(user.cpf)}</span>}
          {user.document_submitted_at && (
            <span>Enviado: {new Date(user.document_submitted_at).toLocaleString('pt-BR')}</span>
          )}
        </div>
      </div>

      <Eye className="w-4 h-4 text-slate2-400 flex-shrink-0" />
    </button>
  )
}

// ---------------------------------------------------------------------------
function UserDetails({
  user, onClose, onView, onApprove, onReject,
  reviewing, reviewAction, reason, setReason,
  onConfirm, onCancelReview, submitting,
}: {
  user: AdminUser
  onClose: () => void
  onView: (url: string) => void
  onApprove: () => void
  onReject: () => void
  reviewing: boolean
  reviewAction: 'APPROVED' | 'REJECTED' | null
  reason: string
  setReason: (v: string) => void
  onConfirm: () => void
  onCancelReview: () => void
  submitting: boolean
}) {
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-14 h-14 rounded-full bg-slate2-100 overflow-hidden flex items-center justify-center flex-shrink-0">
          {user.selfie_photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.selfie_photo_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <UserIcon className="w-6 h-6 text-slate2-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold text-slate2-900 truncate">{user.name}</h2>
            <StatusBadge status={user.document_verification_status} />
            <RoleBadge role={user.role} />
          </div>
          <p className="text-sm text-slate2-600">{user.email}</p>
          {user.phone && (
            <p className="text-sm text-slate2-500 flex items-center gap-1 mt-0.5">
              <Phone className="w-3.5 h-3.5" /> {user.phone}
            </p>
          )}
        </div>
      </div>

      {/* Documentos */}
      <div className="grid grid-cols-2 gap-3">
        <PhotoTile label="Documento" url={user.document_photo_url} onClick={onView} />
        <PhotoTile label="Selfie"     url={user.selfie_photo_url}   onClick={onView} />
      </div>

      {/* Dados pessoais */}
      <div className="bg-slate2-50 border border-slate2-200 rounded-xl p-4 space-y-2">
        <h3 className="font-semibold text-slate2-800 text-sm flex items-center gap-2 mb-2">
          <FileText className="w-4 h-4" /> Dados pessoais
        </h3>
        <DataRow label="CPF/CNPJ" value={user.cpf ? maskCpf(user.cpf) : '—'} />
        <DataRow label="RG" value={user.rg ?? '—'} />
        <DataRow label="Data de nascimento" value={user.birth_date ? new Date(user.birth_date).toLocaleDateString('pt-BR') : '—'} />
        <DataRow label="Nome da mãe" value={user.mother_name ?? '—'} />
        <DataRow label="Cadastrado em" value={new Date(user.created_at).toLocaleDateString('pt-BR')} />
      </div>

      {/* Endereço */}
      <div className="bg-slate2-50 border border-slate2-200 rounded-xl p-4 space-y-2">
        <h3 className="font-semibold text-slate2-800 text-sm flex items-center gap-2 mb-2">
          <MapPin className="w-4 h-4" /> Endereço
        </h3>
        {user.address_street ? (
          <p className="text-sm text-slate2-700">
            {user.address_street}, {user.address_number ?? 's/n'}
            {user.address_complement ? ` — ${user.address_complement}` : ''}<br />
            {user.address_neighborhood ? `${user.address_neighborhood} · ` : ''}
            {user.address_city ?? ''}{user.address_state ? `/${user.address_state}` : ''}<br />
            CEP: {user.address_zip ?? '—'}
          </p>
        ) : (
          <p className="text-sm text-slate2-500">Não informado</p>
        )}
      </div>

      {/* Contato de emergência */}
      {(user.emergency_contact_name || user.emergency_contact_phone) && (
        <div className="bg-slate2-50 border border-slate2-200 rounded-xl p-4 space-y-2">
          <h3 className="font-semibold text-slate2-800 text-sm flex items-center gap-2 mb-2">
            <Phone className="w-4 h-4" /> Contato de emergência
          </h3>
          <DataRow label="Nome" value={user.emergency_contact_name ?? '—'} />
          <DataRow label="Telefone" value={user.emergency_contact_phone ?? '—'} />
        </div>
      )}

      {/* Histórico de review */}
      {user.document_reviewed_at && (
        <div className={`rounded-xl p-3 text-sm ${
          user.document_verification_status === 'APPROVED'
            ? 'bg-green-50 border border-green-200 text-green-800'
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          <p className="font-medium">
            {user.document_verification_status === 'APPROVED' ? 'Aprovado' : 'Recusado'}{' '}
            em {new Date(user.document_reviewed_at).toLocaleString('pt-BR')}
          </p>
          {user.document_rejection_reason && (
            <p className="text-xs mt-1">Motivo: {user.document_rejection_reason}</p>
          )}
        </div>
      )}

      {/* Painel de ação */}
      <div className="border-t pt-4">
        {!reviewing ? (
          <div className="flex flex-wrap gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>Fechar</Button>
            {user.document_verification_status !== 'APPROVED' && (
              <Button onClick={onApprove}>
                <ShieldCheck className="w-4 h-4" /> Aprovar
              </Button>
            )}
            {user.document_verification_status !== 'REJECTED' &&
             user.document_verification_status !== 'NONE' && (
              <Button variant="danger" onClick={onReject}>
                <ShieldX className="w-4 h-4" /> Recusar
              </Button>
            )}
          </div>
        ) : reviewAction === 'APPROVED' ? (
          <div className="space-y-3">
            <p className="text-sm text-slate2-700">
              Confirma aprovar a verificação de <strong>{user.name}</strong>?
              O usuário passará a poder criar pedidos e enviar propostas.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={onCancelReview}>Voltar</Button>
              <Button onClick={onConfirm} isLoading={submitting}>Confirmar aprovação</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <Textarea
              label="Motivo da recusa *"
              placeholder="Ex.: Foto do documento ilegível, dados não conferem, selfie sem documento..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={onCancelReview}>Voltar</Button>
              <Button variant="danger" onClick={onConfirm} isLoading={submitting} disabled={!reason.trim()}>
                Confirmar recusa
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
function PhotoTile({ label, url, onClick }: { label: string; url?: string | null; onClick: (url: string) => void }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate2-500 mb-1">{label}</p>
      {url ? (
        <button
          onClick={() => onClick(url)}
          className="block w-full aspect-[4/3] rounded-xl border border-slate2-200 overflow-hidden bg-slate2-50 hover:opacity-90 transition-opacity"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={label} className="w-full h-full object-cover" />
        </button>
      ) : (
        <div className="w-full aspect-[4/3] rounded-xl border border-dashed border-slate2-300 bg-slate2-50 flex items-center justify-center text-xs text-slate2-400">
          Não enviado
        </div>
      )}
    </div>
  )
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-slate2-500">{label}</span>
      <span className="text-slate2-800 font-medium text-right ml-3">{value}</span>
    </div>
  )
}

function StatusBadge({ status }: { status: VStatus }) {
  const map: Record<VStatus, { label: string; cls: string }> = {
    NONE:     { label: 'Não enviado', cls: 'bg-slate2-100 text-slate2-600' },
    PENDING:  { label: 'Pendente',    cls: 'bg-amber-100 text-amber-700' },
    APPROVED: { label: 'Aprovado',    cls: 'bg-green-100 text-green-700' },
    REJECTED: { label: 'Recusado',    cls: 'bg-red-100 text-red-700' },
  }
  return (
    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${map[status].cls}`}>
      {map[status].label}
    </span>
  )
}

function RoleBadge({ role }: { role: string }) {
  const labels: Record<string, string> = { CLIENT: 'Cliente', PROVIDER: 'Prestador', BOTH: 'Cliente+Prestador', ADMIN: 'Admin' }
  return (
    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-brand-100 text-brand-800">
      {labels[role] ?? role}
    </span>
  )
}

function maskCpf(v: string) {
  const d = v.replace(/\D/g, '')
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  return v
}

function labelFor(s: VStatus) {
  return STATUS_TABS.find((t) => t.value === s)?.label ?? s
}
