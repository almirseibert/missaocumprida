'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Filter } from 'lucide-react'
import { api } from '@/lib/api'
import { Order, OrderStatus } from '@/types'
import { Button } from '@/components/ui/Button'
import { PageSpinner } from '@/components/ui/Spinner'
import {
  formatDate,
  formatCurrency,
  ORDER_STATUS_LABEL,
  ORDER_STATUS_COLOR,
} from '@/lib/utils'

const STATUS_FILTERS: { label: string; value: string }[] = [
  { label: 'Todos', value: '' },
  { label: 'Abertos', value: 'OPEN' },
  { label: 'Em proposta', value: 'IN_PROPOSAL' },
  { label: 'Aceito', value: 'ACCEPTED' },
  { label: 'Agendado', value: 'SCHEDULED' },
  { label: 'Em andamento', value: 'IN_PROGRESS' },
  { label: 'Concluído', value: 'DONE' },
]

export default function MeusPedidosPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const fetchOrders = async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = { page, limit: 10 }
      if (statusFilter) params.status = statusFilter
      const res = await api.get('/orders', { params })
      const payload = res.data.data ?? res.data
      const ordersData = Array.isArray(payload.orders) ? payload.orders : []
      setOrders(ordersData)
      const totalItems = payload.total || 0
      const pageLimit = payload.limit || 10
      setTotalPages(Math.ceil(totalItems / pageLimit) || 1)
    } catch (err) {
      console.error('Erro ao buscar pedidos:', err)
      setOrders([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrders()
  }, [page, statusFilter])

  const handleFilterChange = (val: string) => {
    setStatusFilter(val)
    setPage(1)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate2-900">Meus Pedidos</h1>
        <Link href="/home">
          <Button size="sm">
            <Plus className="w-4 h-4" /> Novo pedido
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => handleFilterChange(f.value)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
              statusFilter === f.value
                ? 'bg-brand-500 text-white'
                : 'bg-white border border-slate2-300 text-slate2-600 hover:border-slate2-400'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <PageSpinner />
      ) : orders.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-lg font-medium text-slate2-700">Nenhum pedido encontrado</p>
          <p className="text-sm text-slate2-500 mt-1 mb-6">Solicite um serviço e ele aparecerá aqui</p>
          <Link href="/home">
            <Button>Solicitar serviço</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/pedido/${order.id}`}
              className="block bg-white rounded-2xl border border-slate2-200 p-5 hover:border-brand-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ORDER_STATUS_COLOR[order.status]}`}>
                      {ORDER_STATUS_LABEL[order.status]}
                    </span>
                    {order.category && (
                      <span className="text-xs text-slate2-500">{order.category.name}</span>
                    )}
                  </div>
                  <h3 className="font-semibold text-slate2-900 truncate">{order.title}</h3>
                  <p className="text-sm text-slate2-500 mt-0.5">{formatDate(order.created_at)}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  {order.final_price ? (
                    <p className="font-bold text-green-600">{formatCurrency(order.final_price)}</p>
                  ) : order.estimated_price_min ? (
                    <p className="text-sm text-slate2-500">
                      {formatCurrency(order.estimated_price_min)}–{formatCurrency(order.estimated_price_max!)}
                    </p>
                  ) : null}
                  {order.status === 'IN_PROPOSAL' && (
                    <p className="text-xs text-brand-600 font-medium mt-1">
                      {order.proposals?.length || 0} proposta(s)
                    </p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
            Anterior
          </Button>
          <span className="px-4 py-2 text-sm text-slate2-600">
            {page} / {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
            Próxima
          </Button>
        </div>
      )}
    </div>
  )
}
