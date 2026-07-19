'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { HandCoins, RefreshCw, Undo2, Banknote } from 'lucide-react'
import { api, getApiErrorMessage } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { PageSpinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import { formatCurrency } from '@/lib/utils'

/**
 * Fila de exceção das Taxas de Conexão (Remap 2.0): o fluxo normal é
 * automático — aqui o admin resolve disputas (devolver como crédito ou
 * marcar estorno bancário manual).
 */

type Fee = {
  id: string
  side: 'CLIENT' | 'PROVIDER'
  status: string
  base_amount: number
  credit_used: number
  gateway_amount: number
  method: string | null
  credit_reason: string | null
  paid_at: string | null
  created_at: string
  user: { id: string; name: string; email: string }
  order: { id: string; title: string; status: string; final_price: number | null }
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendente', PAID: 'Paga', COVERED: 'Coberta (saldo/crédito)',
  CREDITED: 'Devolvida como crédito', EXPIRED: 'Expirada', CANCELLED: 'Cancelada',
  REFUNDED: 'Estornada',
}

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  PAID: 'bg-emerald-100 text-emerald-700',
  COVERED: 'bg-emerald-100 text-emerald-700',
  CREDITED: 'bg-blue-100 text-blue-700',
  EXPIRED: 'bg-slate2-100 text-slate2-600',
  CANCELLED: 'bg-slate2-100 text-slate2-600',
  REFUNDED: 'bg-rose-100 text-rose-700',
}

const FILTERS = ['', 'PAID', 'COVERED', 'PENDING', 'CREDITED', 'EXPIRED', 'REFUNDED']

export default function AdminTaxasPage() {
  const { user } = useAuthStore()
  const router = useRouter()
  const [fees, setFees] = useState<Fee[]>([])
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')

  useEffect(() => { if (user && user.role !== 'ADMIN') router.replace('/home') }, [user, router])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get(`/payments/admin/fees${status ? `?status=${status}` : ''}`)
      setFees(res.data.data ?? [])
    } catch (e) {
      toast.error(getApiErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => { if (user?.role === 'ADMIN') load() }, [user, load])

  if (!user) return <PageSpinner />
  if (user.role !== 'ADMIN') return null

  const act = async (fee: Fee, action: 'credit' | 'refund') => {
    const label = action === 'credit'
      ? 'devolver esta taxa como CRÉDITO na plataforma'
      : 'marcar como ESTORNADA (o estorno bancário é manual no painel do Mercado Pago)'
    const notes = prompt(`Confirma ${label}?\n\nObservações (opcional):`)
    if (notes === null) return
    setBusyId(fee.id)
    try {
      const res = await api.post(`/payments/admin/fees/${fee.id}/${action}`, { notes })
      toast.success(res.data.message ?? 'Feito')
      await load()
    } catch (e) {
      toast.error(getApiErrorMessage(e))
    } finally {
      setBusyId('')
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate2-900 flex items-center gap-2">
            <HandCoins className="w-6 h-6 text-brand-600" /> Taxas de Conexão
          </h1>
          <p className="text-sm text-slate2-600 mt-1">
            Fila de exceção — liberar crédito ou registrar estorno manual.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={load}>
          <RefreshCw className="w-4 h-4 mr-1" /> Atualizar
        </Button>
      </div>

      <div className="flex items-center gap-1 bg-slate2-100 rounded-xl p-1 w-fit flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f || 'all'}
            onClick={() => setStatus(f)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              status === f ? 'bg-white text-slate2-900 shadow-sm' : 'text-slate2-500 hover:text-slate2-700'
            }`}
          >
            {f ? STATUS_LABEL[f] : 'Todas'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-16"><PageSpinner /></div>
      ) : fees.length === 0 ? (
        <p className="text-sm text-slate2-400 py-10 text-center">Nenhuma taxa encontrada.</p>
      ) : (
        <div className="space-y-2">
          {fees.map((fee) => {
            const total = Math.round((fee.credit_used + fee.gateway_amount) * 100) / 100
            return (
              <div key={fee.id} className="bg-white border border-slate2-200 rounded-2xl p-4 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[220px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${fee.side === 'CLIENT' ? 'bg-brand-50 text-brand-700' : 'bg-violet-50 text-violet-700'}`}>
                      {fee.side === 'CLIENT' ? 'Cliente' : 'Prestador'}
                    </span>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR[fee.status] ?? 'bg-slate2-100 text-slate2-600'}`}>
                      {STATUS_LABEL[fee.status] ?? fee.status}
                    </span>
                    {fee.credit_reason && (
                      <span className="text-[10px] text-slate2-400">({fee.credit_reason})</span>
                    )}
                  </div>
                  <p className="font-semibold text-slate2-900 mt-1 text-sm">{fee.order.title}</p>
                  <p className="text-xs text-slate2-500">
                    {fee.user.name} · {fee.user.email} · proposta {formatCurrency(fee.order.final_price ?? 0)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate2-900">{formatCurrency(total || fee.base_amount)}</p>
                  <p className="text-[11px] text-slate2-400">{fee.method ?? '—'}</p>
                </div>
                {['PAID', 'COVERED'].includes(fee.status) && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      isLoading={busyId === fee.id}
                      onClick={() => act(fee, 'credit')}
                    >
                      <Undo2 className="w-3.5 h-3.5 mr-1" /> Devolver crédito
                    </Button>
                    <Button
                      size="sm"
                      className="bg-rose-600 hover:bg-rose-700"
                      isLoading={busyId === fee.id}
                      onClick={() => act(fee, 'refund')}
                    >
                      <Banknote className="w-3.5 h-3.5 mr-1" /> Estornar
                    </Button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
