'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { Search, UserIcon, ShieldCheck, Ban, RotateCcw } from 'lucide-react'
import { api, getApiErrorMessage } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { PageSpinner } from '@/components/ui/Spinner'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { formatCurrency, formatDateTime } from '@/lib/utils'

type U = {
  id: string; name: string; email: string; phone?: string | null; role: string; avatar?: string | null
  is_active: boolean; suspended_until?: string | null; no_show_count?: number
  document_verification_status: string; document_verified?: boolean; is_verified_pro?: boolean
  provider_balance?: number; rating_avg?: number; rating_count?: number
  address_city?: string | null; address_state?: string | null; created_at: string
}

const ROLE_LABEL: Record<string, string> = { CLIENT: 'Cliente', PROVIDER: 'Prestador', BOTH: 'Ambos', ADMIN: 'Admin' }
const KYC_LABEL: Record<string, string> = { NONE: 'Sem KYC', PENDING: 'KYC pendente', APPROVED: 'KYC aprovado', REJECTED: 'KYC recusado' }
const KYC_COLOR: Record<string, string> = {
  NONE: 'bg-slate2-100 text-slate2-500', PENDING: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-accent-100 text-accent-700', REJECTED: 'bg-red-100 text-red-700',
}

export default function AdminUsuariosPage() {
  const { user } = useAuthStore()
  const router = useRouter()
  const [items, setItems] = useState<U[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('')
  const [status, setStatus] = useState('')
  const [selected, setSelected] = useState<U | null>(null)

  useEffect(() => { if (user && user.role !== 'ADMIN') router.replace('/home') }, [user, router])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (role) params.set('role', role)
      if (status) params.set('status', status)
      const res = await api.get(`/users/admin/list?${params.toString()}`)
      setItems(res.data.data)
    } catch (e) { toast.error(getApiErrorMessage(e)) } finally { setLoading(false) }
  }, [search, role, status])

  useEffect(() => { if (user?.role === 'ADMIN') load() }, [user, role, status]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) return <PageSpinner />
  if (user.role !== 'ADMIN') return null

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate2-900">Usuários & Cadastros</h1>
        <p className="text-sm text-slate2-600 mt-1">Buscar, verificar e moderar contas.</p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        <form onSubmit={(e) => { e.preventDefault(); load() }} className="flex-1 min-w-[220px]">
          <Input leftIcon={<Search className="w-4 h-4" />} placeholder="Nome, e-mail ou CPF" value={search} onChange={(e) => setSearch(e.target.value)} />
        </form>
        <select value={role} onChange={(e) => setRole(e.target.value)} className="rounded-lg border-[1.5px] border-slate2-300 px-3 py-2.5 text-sm">
          <option value="">Todos os papéis</option>
          <option value="CLIENT">Clientes</option>
          <option value="PROVIDER">Prestadores</option>
          <option value="BOTH">Ambos</option>
          <option value="ADMIN">Admins</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border-[1.5px] border-slate2-300 px-3 py-2.5 text-sm">
          <option value="">Todos status</option>
          <option value="active">Ativos</option>
          <option value="suspended">Suspensos</option>
        </select>
      </div>

      {loading ? (
        <div className="py-16"><PageSpinner /></div>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate2-400 py-8 text-center">Nenhum usuário encontrado.</p>
      ) : (
        <div className="space-y-2">
          {items.map((u) => (
            <button key={u.id} onClick={() => setSelected(u)}
              className="w-full bg-white border border-slate2-200 rounded-2xl p-4 flex items-center gap-3 hover:border-brand-300 hover:shadow-sm transition-all text-left">
              <div className="w-10 h-10 rounded-full bg-slate2-100 overflow-hidden flex items-center justify-center flex-shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {u.avatar ? <img src={u.avatar} alt="" className="w-full h-full object-cover" /> : <UserIcon className="w-5 h-5 text-slate2-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-slate2-900 truncate">{u.name}</p>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate2-100 text-slate2-600">{ROLE_LABEL[u.role] ?? u.role}</span>
                  {!u.is_active && <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-100 text-red-700">Suspenso</span>}
                  {u.is_verified_pro && <span className="text-[11px] px-2 py-0.5 rounded-full bg-brand-100 text-brand-700">Pro</span>}
                </div>
                <p className="text-xs text-slate2-500 truncate">{u.email}</p>
              </div>
              <span className={`text-[11px] px-2 py-0.5 rounded-full flex-shrink-0 ${KYC_COLOR[u.document_verification_status] ?? 'bg-slate2-100 text-slate2-500'}`}>
                {KYC_LABEL[u.document_verification_status] ?? u.document_verification_status}
              </span>
            </button>
          ))}
        </div>
      )}

      {selected && <UserDetail user={selected} onClose={() => setSelected(null)} onChanged={() => { setSelected(null); load() }} />}
    </div>
  )
}

// ---------------------------------------------------------------------------
function UserDetail({ user, onClose, onChanged }: { user: U; onClose: () => void; onChanged: () => void }) {
  const [detail, setDetail] = useState<any>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.get(`/users/admin/users/${user.id}`).then((r) => setDetail(r.data.data)).catch(() => setDetail(user))
  }, [user])

  const suspend = async () => {
    if (!confirm(`Suspender ${user.name}?`)) return
    setBusy(true)
    try { await api.patch(`/users/admin/users/${user.id}/suspend`, {}); toast.success('Usuário suspenso'); onChanged() }
    catch (e) { toast.error(getApiErrorMessage(e)) } finally { setBusy(false) }
  }
  const reactivate = async () => {
    setBusy(true)
    try { await api.patch(`/users/admin/users/${user.id}/reactivate`, {}); toast.success('Usuário reativado'); onChanged() }
    catch (e) { toast.error(getApiErrorMessage(e)) } finally { setBusy(false) }
  }

  const d = detail ?? user
  const c = d._count ?? {}

  return (
    <Modal isOpen onClose={onClose} title={user.name} size="lg">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <span className="text-xs px-2 py-1 rounded-full bg-slate2-100 text-slate2-600">{ROLE_LABEL[d.role] ?? d.role}</span>
          <span className={`text-xs px-2 py-1 rounded-full ${KYC_COLOR[d.document_verification_status] ?? 'bg-slate2-100'}`}>{KYC_LABEL[d.document_verification_status] ?? d.document_verification_status}</span>
          {d.is_active ? <span className="text-xs px-2 py-1 rounded-full bg-accent-100 text-accent-700">Ativo</span>
            : <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700">Suspenso</span>}
        </div>

        <div className="text-sm text-slate2-700 space-y-1">
          <p>{d.email}{d.phone ? ` · ${d.phone}` : ''}</p>
          {(d.address_city || d.address_state) && <p className="text-slate2-500">{[d.address_neighborhood, d.address_city, d.address_state].filter(Boolean).join(', ')}</p>}
          <p className="text-xs text-slate2-400">Desde {formatDateTime(d.created_at)}</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Stat label="Avaliação" value={`${(d.rating_avg ?? 0).toFixed(1)} ★`} sub={`${d.rating_count ?? 0} avaliações`} />
          <Stat label="Saldo" value={formatCurrency(d.provider_balance ?? 0)} />
          <Stat label="No-shows" value={String(d.no_show_count ?? 0)} />
          <Stat label="Pedidos" value={String((c.orders_as_client ?? 0))} />
          <Stat label="Serviços (prest.)" value={String(c.schedules_provider ?? 0)} />
          <Stat label="Propostas" value={String(c.proposals ?? 0)} />
          <Stat label="Saques" value={String(c.withdrawals ?? 0)} />
          <Stat label="Pagam. recebidos" value={String(c.payments_provider ?? 0)} />
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <Link href="/admin/verificacoes" className="text-sm text-brand-600 inline-flex items-center gap-1 hover:underline">
            <ShieldCheck className="w-4 h-4" /> Ver verificações
          </Link>
        </div>

        <div className="flex gap-2 pt-2 border-t border-slate2-100">
          {d.is_active ? (
            <Button variant="danger" size="sm" isLoading={busy} onClick={suspend}><Ban className="w-4 h-4 mr-1" /> Suspender</Button>
          ) : (
            <Button variant="success" size="sm" isLoading={busy} onClick={reactivate}><RotateCcw className="w-4 h-4 mr-1" /> Reativar</Button>
          )}
        </div>
      </div>
    </Modal>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-slate2-50 border border-slate2-200 rounded-xl p-2.5">
      <p className="text-sm font-bold text-slate2-900 leading-tight">{value}</p>
      <p className="text-[11px] text-slate2-400">{label}</p>
      {sub && <p className="text-[10px] text-slate2-400">{sub}</p>}
    </div>
  )
}
