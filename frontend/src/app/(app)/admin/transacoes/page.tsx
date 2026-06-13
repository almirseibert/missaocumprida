'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import {
  Lock, AlertTriangle, CheckCircle2, RefreshCw, ArrowDownToLine, MapPin,
  Camera, Banknote, Clock, ChevronRight,
} from 'lucide-react'
import { api, getApiErrorMessage } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { PageSpinner } from '@/components/ui/Spinner'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { formatCurrency, formatDateTime } from '@/lib/utils'

type Schedule = {
  scheduled_at?: string | null
  checkin_at?: string | null; checkin_photo_url?: string | null; checkin_address?: string | null
  checkin_lat?: number | null; checkin_lng?: number | null
  done_at?: string | null; complete_photo_url?: string | null; complete_address?: string | null
  complete_lat?: number | null; complete_lng?: number | null; duration_minutes?: number | null
}
type Tx = {
  id: string; amount: number; provider_amount: number; platform_fee: number; gateway_fee: number
  payment_method?: string | null; status: string
  paid_at?: string | null; confirmed_at?: string | null; hold_until?: string | null
  admin_approved_at?: string | null; review_notes?: string | null
  release_eligible?: boolean; days_remaining?: number | null
  order: {
    id: string; title: string; description?: string | null; photos: string[]
    city?: string | null; neighborhood?: string | null; address?: string | null
    final_price?: number | null; client_total?: number | null
    category?: { name: string; icon: string } | null
    schedule?: Schedule | null
  }
  client: { id: string; name: string; email: string; phone?: string | null }
  provider: { id: string; name: string; email: string; phone?: string | null; pix_key?: string | null; pix_key_type?: string | null }
}
type Withdrawal = {
  id: string; amount: number; pix_key: string; pix_key_type: string; status: string
  processed_at?: string | null; notes?: string | null; created_at: string
  provider: { id: string; name: string; email: string; phone?: string | null }
}

const TX_TABS = [
  { key: 'HELD', label: 'Em garantia', icon: Lock },
  { key: 'DISPUTED', label: 'Disputas', icon: AlertTriangle },
  { key: 'RELEASED', label: 'Liberadas', icon: CheckCircle2 },
  { key: 'REFUNDED', label: 'Reembolsadas', icon: RefreshCw },
]

export default function AdminTransacoesPage() {
  const { user } = useAuthStore()
  const router = useRouter()
  const [tab, setTab] = useState<'HELD' | 'DISPUTED' | 'RELEASED' | 'REFUNDED' | 'SAQUES'>('HELD')
  const [txs, setTxs] = useState<Tx[]>([])
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [overview, setOverview] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Tx | null>(null)

  useEffect(() => {
    if (user && user.role !== 'ADMIN') router.replace('/home')
  }, [user, router])

  const loadOverview = useCallback(async () => {
    try {
      const res = await api.get('/analytics/admin/overview?period=30d')
      setOverview(res.data.data?.financeiro)
    } catch { /* silencioso */ }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      if (tab === 'SAQUES') {
        const res = await api.get('/payments/admin/withdrawals')
        setWithdrawals(res.data.data)
      } else {
        const res = await api.get(`/payments/admin/transactions?status=${tab}`)
        setTxs(res.data.data)
      }
    } catch (e) {
      toast.error(getApiErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => { if (user?.role === 'ADMIN') { load(); loadOverview() } }, [user, load, loadOverview])

  if (!user) return <PageSpinner />
  if (user.role !== 'ADMIN') return null

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate2-900">Financeiro & Transações</h1>
        <p className="text-sm text-slate2-600 mt-1">Segurança de Transação, movimentações e saques.</p>
      </div>

      {/* KPIs */}
      {overview && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Kpi icon={Banknote} label="GMV (30d)" value={formatCurrency(overview.gmv)} />
          <Kpi icon={Lock} label="Em garantia" value={formatCurrency(overview.held_amount)} sub={`${overview.held_count} retidas`} />
          <Kpi icon={CheckCircle2} label="Liberado (30d)" value={formatCurrency(overview.released_amount)} />
          <Kpi icon={ArrowDownToLine} label="Saques pendentes" value={formatCurrency(overview.withdrawals_pending_amount)} sub={`${overview.withdrawals_pending_count} solicitações`} />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {TX_TABS.map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key as any)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl whitespace-nowrap transition-colors ${
                tab === t.key ? 'bg-brand-700 text-white' : 'bg-slate2-100 text-slate2-600 hover:bg-slate2-200'
              }`}
            >
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          )
        })}
        <button
          onClick={() => setTab('SAQUES')}
          className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl whitespace-nowrap transition-colors ${
            tab === 'SAQUES' ? 'bg-brand-700 text-white' : 'bg-slate2-100 text-slate2-600 hover:bg-slate2-200'
          }`}
        >
          <ArrowDownToLine className="w-4 h-4" /> Saques
        </button>
      </div>

      {loading ? (
        <div className="py-16"><PageSpinner /></div>
      ) : tab === 'SAQUES' ? (
        <WithdrawalsList items={withdrawals} onChanged={() => { load(); loadOverview() }} />
      ) : txs.length === 0 ? (
        <p className="text-sm text-slate2-400 py-8 text-center">Nenhuma transação nesta categoria.</p>
      ) : (
        <div className="space-y-2">
          {txs.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelected(t)}
              className="w-full bg-white border border-slate2-200 rounded-2xl p-4 flex items-center gap-4 hover:border-brand-300 hover:shadow-sm transition-all text-left"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-slate2-900 truncate">{t.order.title}</p>
                  <TxBadge status={t.status} />
                  {t.status === 'HELD' && t.release_eligible && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-accent-100 text-accent-700">Elegível p/ liberar</span>
                  )}
                </div>
                <p className="text-xs text-slate2-500 mt-0.5 truncate">
                  {t.client.name} → {t.provider.name}
                  {typeof t.days_remaining === 'number' && t.status === 'HELD' && (
                    <span className="ml-2 text-amber-600">· libera em {t.days_remaining}d</span>
                  )}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-bold text-slate2-900">{formatCurrency(t.provider_amount)}</p>
                <p className="text-[11px] text-slate2-400">total {formatCurrency(t.amount)}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate2-400 flex-shrink-0" />
            </button>
          ))}
        </div>
      )}

      {selected && (
        <TxDetail tx={selected} onClose={() => setSelected(null)} onChanged={() => { setSelected(null); load(); loadOverview() }} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
function TxDetail({ tx, onClose, onChanged }: { tx: Tx; onClose: () => void; onChanged: () => void }) {
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const s = tx.order.schedule

  const act = async (action: 'approve' | 'dispute' | 'refund') => {
    if ((action === 'dispute' || action === 'refund') && !notes.trim()) {
      toast.error('Descreva o motivo nas observações.')
      return
    }
    setBusy(action)
    try {
      const res = await api.post(`/payments/admin/transactions/${tx.id}/${action}`, { notes: notes.trim() || undefined })
      toast.success(res.data.message || 'Feito')
      onChanged()
    } catch (e) {
      toast.error(getApiErrorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const canAct = tx.status === 'HELD' || tx.status === 'DISPUTED'

  return (
    <Modal isOpen onClose={onClose} title="Transação" size="lg">
      <div className="space-y-4 max-h-[70vh] overflow-y-auto">
        {/* Resumo financeiro */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Money label="Total cobrado" value={tx.amount} />
          <Money label="Taxa plataforma" value={tx.platform_fee} />
          <Money label="Taxa gateway" value={tx.gateway_fee} />
          <Money label="Líquido prestador" value={tx.provider_amount} strong />
        </div>

        {/* Partes */}
        <div className="grid sm:grid-cols-2 gap-3">
          <Party title="Cliente" name={tx.client.name} email={tx.client.email} phone={tx.client.phone} />
          <Party title="Prestador" name={tx.provider.name} email={tx.provider.email} phone={tx.provider.phone}
            extra={tx.provider.pix_key ? `PIX (${tx.provider.pix_key_type}): ${tx.provider.pix_key}` : 'Sem chave PIX'} />
        </div>

        {/* Pedido + janela */}
        <div className="bg-slate2-50 border border-slate2-200 rounded-xl p-3 text-sm space-y-1">
          <p className="font-semibold text-slate2-800">{tx.order.category?.icon} {tx.order.title}</p>
          {tx.order.description && <p className="text-slate2-600 text-xs">{tx.order.description}</p>}
          <p className="text-xs text-slate2-500">{[tx.order.neighborhood, tx.order.city].filter(Boolean).join(', ')}</p>
          <div className="flex items-center gap-2 text-xs text-slate2-500 pt-1">
            <Clock className="w-3.5 h-3.5" />
            {tx.confirmed_at ? `Confirmado ${formatDateTime(tx.confirmed_at)}` : 'Não confirmado'}
            {tx.hold_until && ` · libera após ${formatDateTime(tx.hold_until)}`}
          </div>
          {tx.review_notes && <p className="text-xs text-amber-700 pt-1">Obs. anterior: {tx.review_notes}</p>}
        </div>

        {/* Provas: check-in e conclusão */}
        <div className="grid sm:grid-cols-2 gap-3">
          <ProofTile label="Check-in" at={s?.checkin_at} photo={s?.checkin_photo_url}
            address={s?.checkin_address} lat={s?.checkin_lat} lng={s?.checkin_lng} />
          <ProofTile label="Conclusão" at={s?.done_at} photo={s?.complete_photo_url}
            address={s?.complete_address} lat={s?.complete_lat} lng={s?.complete_lng} />
        </div>

        {/* Fotos do pedido */}
        {tx.order.photos?.length > 0 && (
          <div>
            <p className="text-xs font-medium text-slate2-500 mb-1">Fotos do pedido</p>
            <div className="flex gap-2 flex-wrap">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {tx.order.photos.map((p, i) => <img key={i} src={p} alt="" className="w-20 h-20 rounded-lg object-cover border border-slate2-200" />)}
            </div>
          </div>
        )}

        {/* Ações */}
        {canAct ? (
          <div className="space-y-2 pt-1">
            <Textarea placeholder="Observações (obrigatório para disputa/reembolso)" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            <div className="grid grid-cols-3 gap-2">
              <Button variant="success" size="sm" isLoading={busy === 'approve'} onClick={() => act('approve')}>Aprovar</Button>
              <Button variant="secondary" size="sm" isLoading={busy === 'dispute'} onClick={() => act('dispute')}>Disputar</Button>
              <Button variant="danger" size="sm" isLoading={busy === 'refund'} onClick={() => act('refund')}>Reembolsar</Button>
            </div>
            <p className="text-[11px] text-slate2-400">Aprovar libera após os 7 dias (ou na hora, se a janela já passou). Reembolso: faça o estorno no painel do gateway.</p>
          </div>
        ) : (
          <p className="text-xs text-slate2-400 pt-1">Esta transação não permite mais ações ({tx.status}).</p>
        )}
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
function WithdrawalsList({ items, onChanged }: { items: Withdrawal[]; onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null)

  const act = async (id: string, action: 'approve' | 'reject') => {
    setBusy(id + action)
    try {
      const res = await api.put(`/payments/withdrawals/${id}/${action}`, {})
      toast.success(res.data.message || 'Feito')
      onChanged()
    } catch (e) {
      toast.error(getApiErrorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  if (items.length === 0) return <p className="text-sm text-slate2-400 py-8 text-center">Nenhum saque.</p>

  return (
    <div className="space-y-2">
      {items.map((w) => (
        <div key={w.id} className="bg-white border border-slate2-200 rounded-2xl p-4 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-slate2-900 truncate">{w.provider.name}</p>
              <WdBadge status={w.status} />
            </div>
            <p className="text-xs text-slate2-500 mt-0.5">PIX ({w.pix_key_type}): {w.pix_key}</p>
            <p className="text-[11px] text-slate2-400">{formatDateTime(w.created_at)}{w.notes ? ` · ${w.notes}` : ''}</p>
          </div>
          <p className="font-bold text-slate2-900 flex-shrink-0">{formatCurrency(w.amount)}</p>
          {w.status === 'REQUESTED' && (
            <div className="flex gap-1.5 flex-shrink-0">
              <Button variant="success" size="sm" isLoading={busy === w.id + 'approve'} onClick={() => act(w.id, 'approve')}>Pagar</Button>
              <Button variant="danger" size="sm" isLoading={busy === w.id + 'reject'} onClick={() => act(w.id, 'reject')}>Rejeitar</Button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
function Kpi({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white border border-slate2-200 rounded-2xl p-4">
      <div className="w-9 h-9 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center mb-2"><Icon className="w-4.5 h-4.5" /></div>
      <p className="text-xs text-slate2-500">{label}</p>
      <p className="text-lg font-bold text-slate2-900 leading-tight">{value}</p>
      {sub && <p className="text-[11px] text-slate2-400">{sub}</p>}
    </div>
  )
}

function Money({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="bg-white border border-slate2-200 rounded-xl p-2.5">
      <p className="text-[11px] text-slate2-400">{label}</p>
      <p className={strong ? 'text-sm font-bold text-accent-700' : 'text-sm font-semibold text-slate2-800'}>{formatCurrency(value)}</p>
    </div>
  )
}

function Party({ title, name, email, phone, extra }: { title: string; name: string; email: string; phone?: string | null; extra?: string }) {
  return (
    <div className="border border-slate2-200 rounded-xl p-3">
      <p className="text-[11px] uppercase tracking-wide text-slate2-400 mb-0.5">{title}</p>
      <p className="font-semibold text-slate2-900 text-sm">{name}</p>
      <p className="text-xs text-slate2-500">{email}</p>
      {phone && <p className="text-xs text-slate2-500">{phone}</p>}
      {extra && <p className="text-xs text-slate2-600 mt-1">{extra}</p>}
    </div>
  )
}

function ProofTile({ label, at, photo, address, lat, lng }: {
  label: string; at?: string | null; photo?: string | null; address?: string | null; lat?: number | null; lng?: number | null
}) {
  return (
    <div className="border border-slate2-200 rounded-xl p-3">
      <p className="text-xs font-medium text-slate2-600 flex items-center gap-1 mb-2"><Camera className="w-3.5 h-3.5" /> {label}</p>
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt={label} className="w-full h-36 rounded-lg object-cover border border-slate2-200" />
      ) : (
        <div className="w-full h-36 rounded-lg bg-slate2-50 flex items-center justify-center text-slate2-300 text-xs">Sem foto</div>
      )}
      {at && <p className="text-[11px] text-slate2-400 mt-1">{formatDateTime(at)}</p>}
      {address && <p className="text-[11px] text-slate2-500">{address}</p>}
      {typeof lat === 'number' && typeof lng === 'number' && (
        <a href={`https://www.google.com/maps?q=${lat},${lng}`} target="_blank" rel="noreferrer"
          className="text-[11px] text-brand-600 inline-flex items-center gap-1 mt-1 hover:underline">
          <MapPin className="w-3 h-3" /> Ver no mapa
        </a>
      )}
    </div>
  )
}

const TX_BADGE: Record<string, string> = {
  PAID: 'bg-violet-100 text-violet-700', HELD: 'bg-amber-100 text-amber-800',
  DISPUTED: 'bg-red-100 text-red-700', RELEASED: 'bg-accent-100 text-accent-700',
  REFUNDED: 'bg-slate2-200 text-slate2-700',
}
const TX_LABEL: Record<string, string> = {
  PAID: 'Pago', HELD: 'Em garantia', DISPUTED: 'Em disputa', RELEASED: 'Liberado', REFUNDED: 'Reembolsado',
}
function TxBadge({ status }: { status: string }) {
  return <span className={`text-[11px] px-2 py-0.5 rounded-full ${TX_BADGE[status] ?? 'bg-slate2-100 text-slate2-600'}`}>{TX_LABEL[status] ?? status}</span>
}

const WD_BADGE: Record<string, string> = {
  REQUESTED: 'bg-amber-100 text-amber-800', PROCESSING: 'bg-violet-100 text-violet-700',
  PAID: 'bg-accent-100 text-accent-700', REJECTED: 'bg-red-100 text-red-700',
}
const WD_LABEL: Record<string, string> = {
  REQUESTED: 'Solicitado', PROCESSING: 'Processando', PAID: 'Pago', REJECTED: 'Rejeitado',
}
function WdBadge({ status }: { status: string }) {
  return <span className={`text-[11px] px-2 py-0.5 rounded-full ${WD_BADGE[status] ?? 'bg-slate2-100 text-slate2-600'}`}>{WD_LABEL[status] ?? status}</span>
}
