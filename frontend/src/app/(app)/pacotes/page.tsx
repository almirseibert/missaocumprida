'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Package, Clock, MapPin, Star, Search, ShieldCheck } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Avatar } from '@/components/ui/Avatar'
import { PageSpinner } from '@/components/ui/Spinner'
import { VerifiedBadge } from '@/components/VerifiedBadge'
import { api, getApiErrorMessage } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { ServicePackage } from '@/types'
import { useAuthStore } from '@/store/auth'

export default function PacotesPage() {
  const { user } = useAuthStore()
  const [packages, setPackages] = useState<ServicePackage[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [verifiedOnly, setVerifiedOnly] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    const params: Record<string, string> = {}
    if (user?.latitude && user?.longitude) {
      params.lat = String(user.latitude)
      params.lng = String(user.longitude)
      params.radius = '50'
    }
    if (verifiedOnly) params.verified_only = '1'
    const qs = new URLSearchParams(params).toString()
    api.get(`/packages${qs ? `?${qs}` : ''}`)
      .then((r) => setPackages(r.data.data))
      .catch((e) => setError(getApiErrorMessage(e)))
      .finally(() => setLoading(false))
  }, [user?.latitude, user?.longitude, verifiedOnly])

  const filtered = search
    ? packages.filter((p) =>
        (p.title + ' ' + p.category.name + ' ' + p.provider.name).toLowerCase().includes(search.toLowerCase())
      )
    : packages

  if (loading) return <PageSpinner />

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Package className="text-emerald-600" size={24} /> Pacotes
        </h1>
      </div>
      <p className="text-sm text-slate2-600 mb-4">
        Serviços com preço fixo de prestadores perto de você. Contrate em 1 clique.
      </p>

      <div className="mb-4 flex gap-2 items-center flex-wrap">
        <div className="flex-1 min-w-[240px]">
          <Input
            leftIcon={<Search size={16} />}
            placeholder="Buscar pacote, categoria ou prestador..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button
          type="button"
          onClick={() => setVerifiedOnly((v) => !v)}
          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border transition ${
            verifiedOnly
              ? 'bg-blue-50 border-blue-300 text-blue-700'
              : 'bg-white border-slate2-300 text-slate2-600 hover:border-slate2-400'
          }`}
        >
          <ShieldCheck size={14} fill={verifiedOnly ? '#2563EB' : 'transparent'} />
          Apenas verificados
        </button>
      </div>

      {error && <div className="mb-4 text-sm text-red-600">{error}</div>}

      {filtered.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="text-slate2-400 mb-2">Nenhum pacote disponível</div>
          <div className="text-sm text-slate2-500">
            Quando prestadores criarem pacotes nas suas categorias, eles aparecerão aqui.
          </div>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <Link key={p.id} href={`/pacotes/${p.id}`}>
              <Card className={`overflow-hidden hover:shadow-md transition ${p.is_pro_highlighted ? 'border-2 border-blue-300 ring-1 ring-blue-200' : 'hover:border-brand-400'}`}>
                {p.is_pro_highlighted && (
                  <div className="bg-blue-600 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 text-center">
                    ⭐ Destaque Pro · Novo
                  </div>
                )}
                {p.photos[0] && (
                  <img src={p.photos[0]} alt={p.title} className="w-full h-36 object-cover" />
                )}
                <div className="p-4">
                  <div className="text-xs text-brand-700 font-semibold uppercase tracking-wide flex items-center gap-1">
                    {p.category.icon} {p.category.name}
                  </div>
                  <h3 className="font-bold text-slate2-900 line-clamp-2 mt-1">{p.title}</h3>
                  <div className="flex items-center gap-2 mt-2 text-xs text-slate2-500">
                    <Clock size={12} /> {p.duration_min} min
                    {p.distance_km != null && (
                      <><MapPin size={12} className="ml-2" /> {p.distance_km.toFixed(1)} km</>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate2-100">
                    <Avatar name={p.provider.name} avatar={p.provider.avatar ?? undefined} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate flex items-center gap-1">
                        {p.provider.name}
                        {p.provider.is_verified_pro && <VerifiedBadge size="xs" />}
                      </div>
                      {p.provider.rating_count > 0 && (
                        <div className="text-xs text-amber-600 flex items-center gap-0.5">
                          <Star size={10} fill="currentColor" />
                          {p.provider.rating_avg.toFixed(1)} ({p.provider.rating_count})
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex items-end justify-between">
                    <span className="text-xs text-slate2-500">A partir de</span>
                    <span className="text-xl font-extrabold text-emerald-700">{formatCurrency(p.price)}</span>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
