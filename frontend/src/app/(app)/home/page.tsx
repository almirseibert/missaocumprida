'use client'

import { memo, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Search, MapPin, Calendar, Rss, ArrowRight, AlertCircle, ChevronDown, Wallet, FileText } from 'lucide-react'
import { api } from '@/lib/api'
import { ServiceGroup, Order } from '@/types'
import { useAuthStore } from '@/store/auth'
import { PageSpinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import { formatCurrency, formatDate, formatDateTime, cn } from '@/lib/utils'
import { VerifiedBadge } from '@/components/VerifiedBadge'

export default function HomePage() {
  const { user } = useAuthStore()
  if (!user) return <PageSpinner />
  if (user.role === 'PROVIDER') return <ProviderHome />
  return <ClientHome />
}

// ---------------------------------------------------------------------------
// Visão do CLIENTE (e BOTH/ADMIN) — catálogo de serviços
// ---------------------------------------------------------------------------
type RecentProvider = {
  provider: { id: string; name: string; avatar?: string | null; rating_avg?: number; is_verified_pro?: boolean }
  last_category: { name: string; slug: string; icon: string } | null
}

function ClientHome() {
  const { user } = useAuthStore()
  const [groups, setGroups] = useState<ServiceGroup[]>([])
  const [recents, setRecents] = useState<RecentProvider[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set())

  useEffect(() => {
    Promise.all([
      api.get('/categories/groups').then((res) => setGroups(res.data.data)),
      api.get('/recommendations/recent-providers').then((res) => setRecents(res.data.data || [])).catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    try {
      const raw = localStorage.getItem('mc:home-open-groups')
      if (raw) setOpenGroups(new Set(JSON.parse(raw)))
    } catch {}
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('mc:home-open-groups', JSON.stringify(Array.from(openGroups)))
    } catch {}
  }, [openGroups])

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const isSearching = search.trim() !== ''
  const matchingCats = isSearching
    ? groups.flatMap((g) => g.categories).filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase()),
      )
    : []
  const filteredGroups = isSearching
    ? groups.filter((g) => g.name.toLowerCase().includes(search.toLowerCase()))
    : groups

  if (loading) return <PageSpinner />

  return (
    <div className="space-y-7">
      {/* Hero de boas-vindas — faixa institucional com contraste */}
      <div
        className="relative overflow-hidden rounded-2xl px-6 py-7 sm:px-8 sm:py-8"
        style={{ background: 'linear-gradient(120deg, #1E3A8A 0%, #1D4ED8 55%, #059669 100%)' }}
      >
        <div
          aria-hidden
          className="absolute -top-16 -right-10 w-56 h-56 rounded-full opacity-20 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #FFFFFF 0%, transparent 65%)' }}
        />
        <h1 className="relative font-display text-2xl sm:text-[28px] font-extrabold text-white leading-tight">
          Olá, {user?.name.split(' ')[0]}! 👋
        </h1>
        <p className="relative text-sm sm:text-[15px] text-white/80 mt-1.5">
          O que você precisa resolver hoje? Encontre profissionais verificados na sua região.
        </p>

        <div className="relative mt-5">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate2-400" />
          <input
            type="text"
            placeholder="Buscar serviço (ex: limpeza, elétrica, cabelo...)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-4 rounded-xl bg-white text-sm text-slate2-900 placeholder:text-slate2-400 focus:outline-none focus:ring-4 focus:ring-white/30 shadow-elv-3"
          />
        </div>
      </div>

      {!isSearching && recents.length > 0 && (
        <section>
          <h2 className="font-display text-[15px] font-bold text-slate2-900 mb-3">
            Voltar a contratar
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {recents.map((r) => (
              <Link
                key={r.provider.id}
                href={r.last_category ? `/pedido/novo/${r.last_category.slug}?provider=${r.provider.id}` : `/pacotes?provider=${r.provider.id}`}
                className="flex items-center gap-3 bg-white rounded-2xl border border-slate2-200 p-3 hover:border-brand-300 hover:shadow-brand-soft transition-all"
              >
                <div className="w-11 h-11 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold flex-shrink-0 overflow-hidden">
                  {r.provider.avatar ? (
                    <img src={r.provider.avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    r.provider.name.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <p className="font-display text-[13px] font-bold text-slate2-900 truncate">{r.provider.name}</p>
                    {r.provider.is_verified_pro && <VerifiedBadge size="xs" />}
                  </div>
                  {r.last_category && (
                    <p className="text-[11px] text-slate2-500 truncate">
                      {r.last_category.icon} {r.last_category.name}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {isSearching ? (
        matchingCats.length === 0 && filteredGroups.length === 0 ? (
          <div className="text-center py-16 text-slate2-500">
            <p className="text-lg font-medium">Nenhum serviço encontrado</p>
            <p className="text-sm mt-1">Tente outro termo de busca</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {matchingCats.map((cat) => (
              <CategoryTile key={cat.id} cat={cat} />
            ))}
          </div>
        )
      ) : (
        <div className="space-y-3">
          {filteredGroups.map((group) => {
            const isOpen = openGroups.has(group.id)
            return (
              <section key={group.id} className={cn(
                'bg-white rounded-2xl border overflow-hidden transition-colors',
                isOpen ? 'border-brand-200 shadow-elv-1' : 'border-slate2-200',
              )}>
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  aria-expanded={isOpen}
                  className="w-full flex items-center gap-3.5 p-4 hover:bg-slate2-50 transition-colors text-left"
                >
                  <span className="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center text-2xl flex-shrink-0">
                    {group.icon}
                  </span>
                  <div className="flex-1">
                    <h2 className="font-display text-[15px] font-bold text-slate2-900">{group.name}</h2>
                    <p className="text-xs text-slate2-500 mt-0.5">
                      {group.categories.length} serviço{group.categories.length === 1 ? '' : 's'} disponíve{group.categories.length === 1 ? 'l' : 'is'}
                    </p>
                  </div>
                  <span className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center transition-colors flex-shrink-0',
                    isOpen ? 'bg-brand-100 text-brand-700' : 'bg-slate2-100 text-slate2-500',
                  )}>
                    <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </span>
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 pt-1 border-t border-slate2-100">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 mt-3">
                      {group.categories.map((cat) => (
                        <CategoryTile key={cat.id} cat={cat} />
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

const CategoryTile = memo(function CategoryTile({ cat }: { cat: { id: string; slug: string; name: string; icon: string; base_price_min: number; estimated_hours?: number | null } }) {
  return (
    <Link
      href={`/pedido/novo/${cat.slug}`}
      className="group bg-white rounded-2xl border border-slate2-200 p-4 hover:border-brand-300 hover:shadow-brand-soft hover:-translate-y-0.5 transition-all"
    >
      <div className="w-12 h-12 rounded-xl bg-slate2-50 group-hover:bg-brand-50 flex items-center justify-center text-2xl mb-3 transition-colors">
        {cat.icon}
      </div>
      <h3 className="font-display text-[13px] font-bold text-slate2-900 group-hover:text-brand-700 leading-tight mb-1">
        {cat.name}
      </h3>
      <p className="text-[11px] text-slate2-500">
        A partir de <span className="font-semibold text-slate2-700">{formatCurrency(cat.base_price_min)}</span>
      </p>
      {cat.estimated_hours && (
        <p className="text-[11px] text-slate2-400 mt-0.5">~{cat.estimated_hours}h</p>
      )}
    </Link>
  )
})

// ---------------------------------------------------------------------------
// Visão do PRESTADOR — pedidos abertos na sua região
// ---------------------------------------------------------------------------
function ProviderHome() {
  const { user } = useAuthStore()
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [providerHasLocation, setProviderHasLocation] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/orders/feed', { params: { page: 1, limit: 8 } })
      .then((res) => {
        const d = res.data.data
        setOrders(d?.orders ?? [])
        setProviderHasLocation(!!d?.provider_has_location)
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <PageSpinner />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-[22px] font-extrabold text-slate2-900">
          Pedidos disponíveis na sua área
        </h1>
        <p className="text-[13px] text-slate2-500 mt-1">
          {providerHasLocation
            ? 'Filtrado por suas habilidades · raio de atendimento configurado'
            : 'Cadastre sua localização para filtrar por proximidade'}
        </p>
      </div>

      {/* Aviso sem localização */}
      {!providerHasLocation && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <strong>Ative o filtro por proximidade:</strong> cadastre sua localização no perfil para ver
            somente pedidos dentro do seu raio de atendimento.
          </div>
          <Button size="sm" variant="outline" onClick={() => router.push('/perfil/editar')}>
            Atualizar
          </Button>
        </div>
      )}

      {/* 4 Stats — métricas como nas Telas Web */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Link href="/feed" className="group bg-white border border-slate2-200 rounded-2xl p-4 hover:border-brand-300 hover:shadow-brand-soft hover:-translate-y-0.5 transition-all">
          <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center mb-2.5">
            <Rss className="w-[18px] h-[18px]" />
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate2-500 mb-1">Pedidos abertos</p>
          <p className="font-display text-[28px] font-extrabold text-brand-700 leading-none">
            {orders.length}{orders.length === 8 ? '+' : ''}
          </p>
        </Link>
        <Link href="/minhas-propostas" className="group bg-white border border-slate2-200 rounded-2xl p-4 hover:border-brand-300 hover:shadow-brand-soft hover:-translate-y-0.5 transition-all">
          <div className="w-9 h-9 rounded-lg bg-violet-50 text-violet-700 flex items-center justify-center mb-2.5">
            <FileText className="w-[18px] h-[18px]" />
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate2-500 mb-1">Propostas enviadas</p>
          <p className="font-display text-[28px] font-extrabold text-slate2-900 leading-none">—</p>
        </Link>
        <Link href="/agendamentos" className="group bg-white border border-slate2-200 rounded-2xl p-4 hover:border-brand-300 hover:shadow-brand-soft hover:-translate-y-0.5 transition-all">
          <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center mb-2.5">
            <Calendar className="w-[18px] h-[18px]" />
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate2-500 mb-1">Agendamentos</p>
          <p className="font-display text-[28px] font-extrabold text-slate2-900 leading-none">—</p>
        </Link>
        <Link href="/carteira" className="group bg-white border border-slate2-200 rounded-2xl p-4 hover:border-accent-300 hover:shadow-brand-soft hover:-translate-y-0.5 transition-all">
          <div className="w-9 h-9 rounded-lg bg-accent-50 text-accent-600 flex items-center justify-center mb-2.5">
            <Wallet className="w-[18px] h-[18px]" />
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate2-500 mb-1">Saldo disponível</p>
          <p className="font-display text-[28px] font-extrabold text-accent-600 leading-none">
            {formatCurrency(user?.provider_balance ?? 0)}
          </p>
        </Link>
      </div>

      {/* Lista de pedidos próximos */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-base font-bold text-slate2-900">Pedidos abertos próximos</h2>
          <Link href="/feed" className="text-sm text-brand-700 hover:underline font-medium flex items-center gap-1">
            Ver todos <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {orders.length === 0 ? (
          <div className="bg-white border border-slate2-200 rounded-2xl py-16 text-center">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-lg font-medium text-slate2-700">Nenhum pedido aberto agora</p>
            <p className="text-sm text-slate2-500 mt-1 mb-6">
              Cadastre mais habilidades ou aumente seu raio de atendimento para ver mais pedidos
            </p>
            <Link href="/perfil">
              <Button>Gerenciar habilidades</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => {
              const minutesAgo = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000)
              const ago =
                minutesAgo < 60 ? `há ${minutesAgo} min`
                : minutesAgo < 1440 ? `há ${Math.floor(minutesAgo / 60)} h`
                : formatDate(order.created_at)
              return (
                <Link
                  key={order.id}
                  href={`/pedido/${order.id}`}
                  className="block bg-white rounded-2xl border border-slate2-200 p-5 hover:border-brand-300 hover:shadow-brand-soft transition-all"
                >
                  <div className="flex items-start gap-4">
                    {/* Lado esquerdo */}
                    <div className="flex-1 min-w-0">
                      {order.category && (
                        <div className="flex items-center gap-2 mb-2.5">
                          <span className="text-lg">{order.category.icon}</span>
                          <span className="text-[11px] font-semibold text-brand-700 bg-brand-50 px-2.5 py-0.5 rounded-full">
                            {order.category.name}
                          </span>
                          <span className="text-[11px] text-slate2-400 ml-auto">{ago}</span>
                        </div>
                      )}
                      <h3 className="font-display text-[15px] font-bold text-slate2-900 mb-1.5">{order.title}</h3>
                      {order.description && (
                        <p className="text-[13px] text-slate2-600 line-clamp-2 mb-2.5 leading-snug">{order.description}</p>
                      )}
                      <div className="flex flex-wrap gap-4 text-xs text-slate2-500">
                        {(order.city || order.neighborhood) && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {[order.neighborhood, order.city].filter(Boolean).join(', ')}
                          </span>
                        )}
                        {order.distance_km != null && (
                          <span className="text-brand-600 font-semibold">{order.distance_km} km</span>
                        )}
                        {order.desired_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDateTime(order.desired_date)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Lado direito — preço e botão */}
                    {(order.estimated_price_min || order.estimated_price_max) && (
                      <div className="text-right flex-shrink-0 flex flex-col items-end">
                        <p className="text-[11px] text-slate2-400 mb-0.5">Estimativa bruta</p>
                        <p className="font-display text-xl font-extrabold text-brand-700 leading-none">
                          {order.estimated_price_min && formatCurrency(order.estimated_price_min)}
                          {order.estimated_price_min && order.estimated_price_max && '–'}
                          {order.estimated_price_max && formatCurrency(order.estimated_price_max)}
                        </p>
                        <p className="text-[11px] font-semibold text-accent-600 mt-0.5 mb-3.5">
                          Você recebe ~{formatCurrency((order.estimated_price_min ?? 0) * 0.9)}
                        </p>
                        <span className="inline-flex items-center gap-1.5 bg-brand-700 text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg">
                          Enviar proposta
                        </span>
                      </div>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
