'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Search, MapPin, Zap, Ban, ChevronRight } from 'lucide-react'
import { api, getApiErrorMessage } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { PageSpinner } from '@/components/ui/Spinner'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { formatCurrency, formatDateTime, ORDER_STATUS_LABEL, ORDER_STATUS_COLOR } from '@/lib/utils'

type OrderStatusKey = keyof typeof ORDER_STATUS_LABEL
type Order = {
  id: string; title: string; status: string; city?: string | null; neighborhood?: string | null
  final_price?: number | null; client_total?: number | null; is_urgent?: boolean; created_at: string
  category?: { name: string; icon: string } | null
  client?: { id: string; name: string } | null
  schedule?: { id: string; status: string; scheduled_at?: string | null; provider?: { id: string; name: string } | null } | null
  payment?: { status: string; amount: number; provider_amount: number } | null
  _count?: { proposals: number }
}

const STATUS = ['', 'OPEN', 'IN_PROPOSAL', 'ACCEPTED', 'SCHEDULED', 'IN_PROGRESS', 'DONE', 'RATED', 'CANCELLED', 'DISPUTED']

function StatusBadge({ status }: { status: string }) {
  const cls = ORDER_STATUS_COLOR[status as OrderStatusKey] ?? 'bg-slate2-100 text-slate2-600'
  const label = ORDER_STATUS_LABEL[status as OrderStatusKey] ?? status
  return <span className={`text-[11px] px-2 py-0.5 rounded-full ${cls}`}>{label}</span>
}

export default function AdminPedidosPage() {
  const { user } = useAuthStore()
  const router = useRouter()
  const [items, setItems] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [selected, setSelected] = useState<Order | null>(null)

  useEffect(() => { if (user && user.role !== 'ADMIN') router.replace('/home') }, [user, router])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (status) params.set('status', status)
      const res = await api.get(`/orders/admin/list?${params.toString()}`)
      setItems(res.data.data)
    } catch (e) { toast.error(getApiErrorMessage(e)) } finally { setLoading(false) }
  }, [search, status])

  useEffect(() => { if (user?.role === 'ADMIN') load() }, [user, status]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) return <PageSpinner />
  if (user.role !== 'ADMIN') return null

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate2-900">Pedidos & Agendamentos</h1>
        <p className="text-sm text-slate2-600 mt-1">Acompanhamento e intervenção.</p>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <form onSubmit={(e) => { e.preventDefault(); load() }} className="flex-1 min-w-[220px]">
          <Input leftIcon={<Search className="w-4 h-4" />} placeholder="Título ou nome do cliente" value={search} onChange={(e) => setSearch(e.target.value)} />
        </form>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border-[1.5px] border-slate2-300 px-3 py-2.5 text-sm">
          {STATUS.map((s) => <option key={s} value={s}>{s ? (ORDER_STATUS_LABEL[s as OrderStatusKey] ?? s) : 'Todos status'}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="py-16"><PageSpinner /></div>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate2-400 py-8 text-center">Nenhum pedido encontrado.</p>
      ) : (
        <div className="space-y-2">
          {items.map((o) => (
            <button key={o.id} onClick={() => setSelected(o)}
              className="w-full bg-white border border-slate2-200 rounded-2xl p-4 flex items-center gap-3 hover:border-brand-300 hover:shadow-sm transition-all text-left">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-slate2-900 truncate">{o.category?.icon} {o.title}</p>
                  <StatusBadge status={o.status} />
                  {o.is_urgent && <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 inline-flex items-center gap-0.5"><Zap className="w-3 h-3" /> Urgente</span>}
                </div>
                <p className="text-xs text-slate2-500 mt-0.5 truncate">
                  {o.client?.name}{o.schedule?.provider ? ` → ${o.schedule.provider.name}` : ''}
                  {(o.neighborhood || o.city) ? ` · ${[o.neighborhood, o.city].filter(Boolean).join(', ')}` : ''}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                {o.final_price != null && <p className="font-bold text-slate2-900">{formatCurrency(o.final_price)}</p>}
                <p className="text-[11px] text-slate2-400">{o._count?.proposals ?? 0} propostas</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate2-400 flex-shrink-0" />
            </button>
          ))}
        </div>
      )}

      {selected && <OrderDetail order={selected} onClose={() => setSelected(null)} onChanged={() => { setSelected(null); load() }} />}
    </div>
  )
}

// ---------------------------------------------------------------------------
function OrderDetail({ order, onClose, onChanged }: { order: Order; onClose: () => void; onChanged: () => void }) {
  const [d, setD] = useState<any>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.get(`/orders/admin/orders/${order.id}`).then((r) => setD(r.data.data)).catch(() => setD(order))
  }, [order])

  const cancel = async () => {
    if (!confirm('Cancelar este pedido como admin?')) return
    setBusy(true)
    try { await api.patch(`/orders/admin/orders/${order.id}/cancel`, {}); toast.success('Pedido cancelado'); onChanged() }
    catch (e) { toast.error(getApiErrorMessage(e)) } finally { setBusy(false) }
  }

  const o = d ?? order
  const canCancel = !['DONE', 'RATED', 'CANCELLED'].includes(o.status)

  return (
    <Modal isOpen onClose={onClose} title={o.title} size="lg">
      <div className="space-y-4 max-h-[70vh] overflow-y-auto">
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={o.status} />
          {o.is_urgent && <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-100 text-red-700">Urgente</span>}
          <span className="text-xs text-slate2-400">Criado {formatDateTime(o.created_at)}</span>
        </div>

        {o.description && <p className="text-sm text-slate2-600">{o.description}</p>}
        <p className="text-xs text-slate2-500 flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {[o.address, o.neighborhood, o.city].filter(Boolean).join(', ') || '—'}</p>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="border border-slate2-200 rounded-xl p-3">
            <p className="text-[11px] uppercase text-slate2-400">Cliente</p>
            <p className="text-sm font-medium text-slate2-900">{o.client?.name}</p>
            {o.client?.email && <p className="text-xs text-slate2-500">{o.client.email}</p>}
            {o.client?.phone && <p className="text-xs text-slate2-500">{o.client.phone}</p>}
          </div>
          <div className="border border-slate2-200 rounded-xl p-3">
            <p className="text-[11px] uppercase text-slate2-400">Prestador</p>
            <p className="text-sm font-medium text-slate2-900">{o.schedule?.provider?.name ?? '—'}</p>
            {o.schedule?.scheduled_at && <p className="text-xs text-slate2-500">Agendado {formatDateTime(o.schedule.scheduled_at)}</p>}
            {o.schedule?.status && <p className="text-xs text-slate2-500">Status: {o.schedule.status}</p>}
          </div>
        </div>

        {o.payment && (
          <div className="bg-slate2-50 border border-slate2-200 rounded-xl p-3 grid grid-cols-3 gap-2 text-center">
            <div><p className="text-[11px] text-slate2-400">Pagamento</p><p className="text-sm font-semibold">{o.payment.status}</p></div>
            <div><p className="text-[11px] text-slate2-400">Total</p><p className="text-sm font-semibold">{formatCurrency(o.payment.amount ?? 0)}</p></div>
            <div><p className="text-[11px] text-slate2-400">Prestador</p><p className="text-sm font-semibold">{formatCurrency(o.payment.provider_amount ?? 0)}</p></div>
          </div>
        )}

        {Array.isArray(o.proposals) && o.proposals.length > 0 && (
          <div>
            <p className="text-xs font-medium text-slate2-500 mb-1">Propostas ({o.proposals.length})</p>
            <div className="space-y-1.5">
              {o.proposals.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between text-sm border border-slate2-200 rounded-lg px-3 py-2">
                  <span className="text-slate2-700">{p.provider?.name}</span>
                  <span className="text-slate2-500">{formatCurrency(p.value)} · {p.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {canCancel && (
          <div className="pt-2 border-t border-slate2-100">
            <Button variant="danger" size="sm" isLoading={busy} onClick={cancel}><Ban className="w-4 h-4 mr-1" /> Cancelar pedido</Button>
          </div>
        )}
      </div>
    </Modal>
  )
}
