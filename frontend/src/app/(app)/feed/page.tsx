'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { MapPin, Calendar, RefreshCw, List, Map, AlertCircle } from 'lucide-react'
import { api } from '@/lib/api'
import { Order } from '@/types'
import { useAuthStore } from '@/store/auth'
import { Button } from '@/components/ui/Button'
import { PageSpinner } from '@/components/ui/Spinner'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils'

const MapView = dynamic(() => import('@/components/MapView').then(m => ({ default: m.MapView })), {
  ssr: false,
  loading: () => <div className="h-[420px] bg-slate2-100 rounded-2xl animate-pulse" />,
})

type ViewMode = 'list' | 'map'

export default function FeedPage() {
  const { user } = useAuthStore()
  const router = useRouter()

  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [providerHasLocation, setProviderHasLocation] = useState(false)

  const fetchFeed = useCallback(async (p = 1) => {
    setLoading(true)
    try {
      const res = await api.get('/orders/feed', { params: { page: p, limit: 20 } })
      const { orders: data, total, limit, provider_has_location } = res.data.data
      setOrders(data ?? [])
      setTotalPages(Math.ceil(total / limit) || 1)
      setProviderHasLocation(!!provider_has_location)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFeed(page)
  }, [page, fetchFeed])

  const ordersWithCoords = orders.filter(o => o.latitude != null && o.longitude != null)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate2-900">Feed de Pedidos</h1>
          <p className="text-slate2-600 text-sm mt-1">
            {providerHasLocation
              ? 'Filtrado por distância conforme seu raio de atendimento'
              : 'Pedidos compatíveis com suas habilidades cadastradas'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Toggle lista / mapa */}
          <div className="flex rounded-lg border border-slate2-200 overflow-hidden">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 text-sm flex items-center gap-1.5 ${viewMode === 'list' ? 'bg-brand-500 text-white' : 'bg-white text-slate2-600 hover:bg-slate2-50'}`}
            >
              <List className="w-3.5 h-3.5" /> Lista
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`px-3 py-1.5 text-sm flex items-center gap-1.5 ${viewMode === 'map' ? 'bg-brand-500 text-white' : 'bg-white text-slate2-600 hover:bg-slate2-50'}`}
            >
              <Map className="w-3.5 h-3.5" /> Mapa
            </button>
          </div>
          <Button variant="outline" size="sm" onClick={() => { setPage(1); fetchFeed(1) }}>
            <RefreshCw className="w-4 h-4" /> Atualizar
          </Button>
        </div>
      </div>

      {/* Aviso sem localização */}
      {!providerHasLocation && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <strong>Ative o filtro por proximidade:</strong> cadastre sua localização no perfil para ver somente
            pedidos dentro do seu raio de atendimento e ordenados por distância.{' '}
            <button onClick={() => router.push('/perfil/editar')} className="underline font-medium">
              Atualizar perfil
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <PageSpinner />
      ) : orders.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">📭</p>
          <p className="text-lg font-medium text-slate2-700">Nenhum pedido disponível</p>
          <p className="text-sm text-slate2-500 mt-1 mb-6">
            Cadastre mais habilidades no seu perfil para ver mais pedidos
          </p>
          <Link href="/perfil">
            <Button>Gerenciar habilidades</Button>
          </Link>
        </div>
      ) : viewMode === 'map' ? (
        <div className="rounded-2xl overflow-hidden border border-slate2-200 shadow-sm">
          <MapView
            orders={orders}
            providerLat={user?.latitude}
            providerLng={user?.longitude}
            onOrderClick={(order) => router.push(`/pedido/${order.id}`)}
          />
          {ordersWithCoords.length < orders.length && (
            <p className="text-xs text-slate2-500 px-4 py-2 bg-slate2-50 border-t">
              {orders.length - ordersWithCoords.length} pedido(s) sem coordenadas não aparecem no mapa
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/pedido/${order.id}`}
              className={`block rounded-2xl border-2 p-5 hover:shadow-md transition-all ${order.is_urgent ? 'border-rose-500 bg-rose-50/50 animate-pulse-slow' : 'border-slate2-200 bg-white hover:border-brand-300'}`}
            >
              {order.is_urgent && (
                <div className="flex items-center gap-2 mb-2 -mt-1">
                  <span className="text-xs font-bold bg-rose-600 text-white px-2 py-1 rounded-full flex items-center gap-1">
                    🚨 URGENTE
                  </span>
                  {order.urgency_deadline && (
                    <span className="text-xs text-rose-700">
                      Até {new Date(order.urgency_deadline).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              )}
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {order.category && (
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="text-lg">{order.category.icon}</span>
                      <span className="text-xs font-medium text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full">
                        {order.category.name}
                      </span>
                    </div>
                  )}

                  <h3 className="font-semibold text-slate2-900 mb-1">{order.title}</h3>

                  {order.description && (
                    <p className="text-sm text-slate2-600 line-clamp-2 mb-3">{order.description}</p>
                  )}

                  <div className="flex flex-wrap gap-3 text-sm text-slate2-500">
                    {(order.city || order.neighborhood) && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {[order.neighborhood, order.city].filter(Boolean).join(', ')}
                        {order.state && `/${order.state}`}
                      </span>
                    )}
                    {order.distance_km != null && (
                      <span className="flex items-center gap-1 text-brand-600 font-medium">
                        <MapPin className="w-3.5 h-3.5" />
                        {order.distance_km} km de você
                      </span>
                    )}
                    {order.desired_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDateTime(order.desired_date)}
                      </span>
                    )}
                    <span className="text-xs text-slate2-400">Publicado {formatDate(order.created_at)}</span>
                  </div>
                </div>

                <div className="text-right flex-shrink-0 flex flex-col items-end">
                  {(order.estimated_price_min || order.estimated_price_max) && (
                    <>
                      <p className="text-[11px] text-slate2-400 mb-0.5">Estimativa bruta</p>
                      <p className="font-display text-xl font-extrabold text-brand-700 leading-none">
                        {order.estimated_price_min && formatCurrency(order.estimated_price_min)}
                        {order.estimated_price_min && order.estimated_price_max && '–'}
                        {order.estimated_price_max && formatCurrency(order.estimated_price_max)}
                      </p>
                      <p className="text-[11px] font-semibold text-accent-600 mt-0.5 mb-3.5">
                        Você recebe ~{formatCurrency((order.estimated_price_min ?? 0) * 0.88)}
                      </p>
                    </>
                  )}
                  <span className="inline-flex items-center gap-1.5 bg-brand-700 text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg">
                    Enviar proposta
                  </span>
                </div>
              </div>

              {order.photos.length > 0 && (
                <div className="flex gap-2 mt-3 pt-3 border-t border-slate2-100">
                  {order.photos.slice(0, 4).map((url, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={i}
                      src={url.startsWith('http') ? url : `${process.env.NEXT_PUBLIC_API_URL}/${url}`}
                      alt=""
                      className="w-12 h-12 rounded-lg object-cover border border-slate2-200"
                    />
                  ))}
                  {order.photos.length > 4 && (
                    <div className="w-12 h-12 rounded-lg bg-slate2-100 flex items-center justify-center text-xs text-slate2-500 font-medium">
                      +{order.photos.length - 4}
                    </div>
                  )}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}

      {/* Pagination (somente em lista) */}
      {viewMode === 'list' && totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
            Anterior
          </Button>
          <span className="px-4 py-2 text-sm text-slate2-600">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
            Próxima
          </Button>
        </div>
      )}
    </div>
  )
}
