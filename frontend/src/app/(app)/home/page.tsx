'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Search, Star, ChevronRight } from 'lucide-react'
import { api } from '@/lib/api'
import { ServiceGroup } from '@/types'
import { useAuthStore } from '@/store/auth'
import { PageSpinner } from '@/components/ui/Spinner'
import { formatCurrency } from '@/lib/utils'

export default function HomePage() {
  const { user } = useAuthStore()
  const [groups, setGroups] = useState<ServiceGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    api.get('/categories/groups').then((res) => {
      setGroups(res.data.data)
    }).finally(() => setLoading(false))
  }, [])

  const filtered = groups.filter(
    (g) =>
      search === '' ||
      g.name.toLowerCase().includes(search.toLowerCase()) ||
      g.categories.some((c) => c.name.toLowerCase().includes(search.toLowerCase()))
  )

  if (loading) return <PageSpinner />

  return (
    <div className="space-y-8">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Olá, {user?.name.split(' ')[0]}! 👋
        </h1>
        <p className="text-gray-600 mt-1">O que você precisa hoje?</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar serviço (ex: limpeza, elétrica, cabelo...)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent shadow-sm"
        />
      </div>

      {/* Groups */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg font-medium">Nenhum serviço encontrado</p>
          <p className="text-sm mt-1">Tente outro termo de busca</p>
        </div>
      ) : (
        <div className="space-y-10">
          {filtered.map((group) => {
            const cats = search
              ? group.categories.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
              : group.categories

            if (cats.length === 0) return null

            return (
              <section key={group.id}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{group.icon}</span>
                    <h2 className="text-lg font-semibold text-gray-900">{group.name}</h2>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {cats.map((cat) => (
                    <Link
                      key={cat.id}
                      href={`/pedido/novo/${cat.slug}`}
                      className="group bg-white rounded-2xl border border-gray-200 p-4 hover:border-brand-300 hover:shadow-md transition-all"
                    >
                      <div className="text-3xl mb-3">{cat.icon}</div>
                      <h3 className="text-sm font-semibold text-gray-800 group-hover:text-brand-600 leading-tight mb-1">
                        {cat.name}
                      </h3>
                      <p className="text-xs text-gray-500">
                        A partir de {formatCurrency(cat.base_price_min)}
                      </p>
                      {cat.estimated_hours && (
                        <p className="text-xs text-gray-400 mt-0.5">~{cat.estimated_hours}h</p>
                      )}
                    </Link>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}

      {/* Stats strip */}
      <div className="bg-brand-500 rounded-2xl p-6 text-white flex flex-col sm:flex-row gap-6 items-center justify-around">
        {[
          { value: '10+', label: 'Categorias' },
          { value: '25+', label: 'Tipos de serviço' },
          { value: '★ 4.8', label: 'Avaliação média' },
        ].map((s) => (
          <div key={s.label} className="text-center">
            <div className="text-3xl font-bold">{s.value}</div>
            <div className="text-brand-100 text-sm mt-1">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
