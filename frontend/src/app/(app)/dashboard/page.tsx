'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  TrendingUp, DollarSign, Target, CheckCircle2, Star, Wallet, ListChecks, Activity,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { Card } from '@/components/ui/Card'
import { PageSpinner } from '@/components/ui/Spinner'
import { api, getApiErrorMessage } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'

type Period = '7d' | '30d' | '90d' | '12m'

interface Overview {
  proposals_sent: number
  proposals_accepted: number
  proposals_rejected: number
  conversion_rate: number
  services_done: number
  services_in_progress: number
  total_earnings: number
  platform_fees_paid: number
  avg_ticket: number
  paid_orders_count: number
  released_orders_count: number
  rating_avg: number
  rating_count: number
  provider_balance: number
}
interface SeriesPoint { period: string; value: number }
interface CategoryPerf {
  id: string; name: string; icon: string
  sent: number; accepted: number; conversion_rate: number; total_value: number
}
interface Recent {
  id: string
  status: string
  scheduled_at: string
  order: { id: string; title: string; final_price: number | null; status: string; category: { name: string; icon: string } | null }
  client: { id: string; name: string; avatar: string | null }
}

export default function DashboardPage() {
  const [period, setPeriod] = useState<Period>('30d')
  const [overview, setOverview] = useState<Overview | null>(null)
  const [series, setSeries] = useState<SeriesPoint[]>([])
  const [cats, setCats] = useState<CategoryPerf[]>([])
  const [recent, setRecent] = useState<Recent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')
    Promise.all([
      api.get(`/analytics/provider/overview?period=${period}`),
      api.get(`/analytics/provider/earnings-timeseries?period=${period}`),
      api.get(`/analytics/provider/categories?period=${period}`),
      api.get(`/analytics/provider/recent?limit=10`),
    ])
      .then(([o, s, c, r]) => {
        setOverview(o.data.data)
        setSeries(s.data.data)
        setCats(c.data.data)
        setRecent(r.data.data)
      })
      .catch((e) => setError(getApiErrorMessage(e)))
      .finally(() => setLoading(false))
  }, [period])

  const seriesShort = useMemo(
    () => series.map((p) => ({ ...p, label: formatPeriodLabel(p.period) })),
    [series]
  )

  if (loading && !overview) return <PageSpinner />

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>
      <p className="text-sm text-slate2-600 mb-6">Funil, ganhos e desempenho por categoria.</p>

      {error && <div className="mb-4 text-sm text-red-600">{error}</div>}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Kpi
          icon={<DollarSign size={18} />}
          label="Ganhos no período"
          value={formatCurrency(overview?.total_earnings ?? 0)}
          sub={`${overview?.released_orders_count ?? 0} liberados`}
          tone="emerald"
        />
        <Kpi
          icon={<Wallet size={18} />}
          label="Saldo atual"
          value={formatCurrency(overview?.provider_balance ?? 0)}
          sub="disponível para saque"
          tone="brand"
        />
        <Kpi
          icon={<Target size={18} />}
          label="Conversão"
          value={`${Math.round((overview?.conversion_rate ?? 0) * 100)}%`}
          sub={`${overview?.proposals_accepted ?? 0} de ${overview?.proposals_sent ?? 0} propostas`}
          tone="violet"
        />
        <Kpi
          icon={<Star size={18} />}
          label="Avaliação"
          value={`${(overview?.rating_avg ?? 0).toFixed(1)} ★`}
          sub={`${overview?.rating_count ?? 0} avaliações`}
          tone="amber"
        />
        <Kpi
          icon={<CheckCircle2 size={18} />}
          label="Serviços concluídos"
          value={`${overview?.services_done ?? 0}`}
          sub={`${overview?.services_in_progress ?? 0} em andamento`}
        />
        <Kpi
          icon={<TrendingUp size={18} />}
          label="Ticket médio"
          value={formatCurrency(overview?.avg_ticket ?? 0)}
          sub={`${overview?.paid_orders_count ?? 0} pedidos pagos`}
        />
        <Kpi
          icon={<ListChecks size={18} />}
          label="Propostas enviadas"
          value={`${overview?.proposals_sent ?? 0}`}
          sub={`${overview?.proposals_rejected ?? 0} rejeitadas`}
        />
        <Kpi
          icon={<Activity size={18} />}
          label="Taxas pagas"
          value={formatCurrency(overview?.platform_fees_paid ?? 0)}
          sub="à plataforma"
        />
      </div>

      {/* Gráfico */}
      <Card className="p-5 mb-6">
        <div className="font-semibold mb-3">Evolução dos ganhos</div>
        <div style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer>
            <AreaChart data={seriesShort} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1D4ED8" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="#1D4ED8" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748B' }} />
              <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={(v) => `R$ ${v}`} />
              <Tooltip
                formatter={(v) => formatCurrency(Number(v ?? 0))}
                contentStyle={{ borderRadius: 8, borderColor: '#E2E8F0', fontSize: 12 }}
              />
              <Area type="monotone" dataKey="value" stroke="#1D4ED8" strokeWidth={2} fill="url(#g1)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Categorias */}
        <Card className="p-0">
          <div className="p-4 border-b border-slate2-100 font-semibold">Por categoria</div>
          {cats.length === 0 && <div className="p-6 text-sm text-slate2-500 text-center">Sem propostas no período.</div>}
          {cats.slice(0, 8).map((c) => (
            <div key={c.id} className="px-4 py-3 border-b border-slate2-100 last:border-0 flex items-center gap-3">
              <div className="text-2xl">{c.icon}</div>
              <div className="flex-1">
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-slate2-500">
                  {c.accepted}/{c.sent} aceitas · {Math.round(c.conversion_rate * 100)}%
                </div>
              </div>
              <div className="font-semibold text-emerald-700">{formatCurrency(c.total_value)}</div>
            </div>
          ))}
        </Card>

        {/* Últimos serviços */}
        <Card className="p-0">
          <div className="p-4 border-b border-slate2-100 font-semibold">Últimos agendamentos</div>
          {recent.length === 0 && <div className="p-6 text-sm text-slate2-500 text-center">Nada por aqui ainda.</div>}
          {recent.map((s) => (
            <div key={s.id} className="px-4 py-3 border-b border-slate2-100 last:border-0 flex items-center gap-3">
              <div className="text-xl">{s.order?.category?.icon ?? '🧰'}</div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{s.order?.title}</div>
                <div className="text-xs text-slate2-500">
                  {s.client?.name} · {s.status}
                </div>
              </div>
              <div className="text-sm font-semibold">{formatCurrency(s.order?.final_price ?? 0)}</div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}

function formatPeriodLabel(p: string): string {
  if (/^\d{4}-\d{2}$/.test(p)) {
    const [y, m] = p.split('-')
    return `${m}/${y.slice(2)}`
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(p)) {
    const [, m, d] = p.split('-')
    return `${d}/${m}`
  }
  return p
}

function PeriodSelector({ value, onChange }: { value: Period; onChange: (v: Period) => void }) {
  const opts: Array<{ k: Period; l: string }> = [
    { k: '7d', l: '7 dias' },
    { k: '30d', l: '30 dias' },
    { k: '90d', l: '90 dias' },
    { k: '12m', l: '12 meses' },
  ]
  return (
    <div className="flex bg-slate2-100 rounded-xl p-1">
      {opts.map((o) => (
        <button
          key={o.k}
          onClick={() => onChange(o.k)}
          className={
            'px-3 py-1.5 text-sm rounded-lg transition ' +
            (value === o.k ? 'bg-white shadow-sm font-semibold' : 'text-slate2-500 hover:text-slate2-700')
          }
        >
          {o.l}
        </button>
      ))}
    </div>
  )
}

function Kpi({
  icon, label, value, sub, tone,
}: { icon: React.ReactNode; label: string; value: string; sub?: string; tone?: 'emerald' | 'brand' | 'amber' | 'violet' }) {
  const toneCls =
    tone === 'emerald' ? 'bg-emerald-50 text-emerald-700' :
    tone === 'brand'   ? 'bg-brand-50 text-brand-700' :
    tone === 'amber'   ? 'bg-amber-50 text-amber-700' :
    tone === 'violet'  ? 'bg-violet-50 text-violet-700' :
                         'bg-slate2-100 text-slate2-700'
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${toneCls}`}>{icon}</div>
        <div className="text-xs text-slate2-500">{label}</div>
      </div>
      <div className="text-xl font-extrabold text-slate2-900">{value}</div>
      {sub && <div className="text-xs text-slate2-500 mt-0.5">{sub}</div>}
    </Card>
  )
}
