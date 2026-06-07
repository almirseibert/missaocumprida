import { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert,
  Dimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import {
  ArrowLeft, TrendingUp, DollarSign, Target, CheckCircle2, Star, Wallet,
  ListChecks, Activity,
} from 'lucide-react-native'
import { api, getApiError } from '../../src/lib/api'
import { formatCurrency } from '../../src/lib/utils'

type Period = '7d' | '30d' | '90d' | '12m'

interface Overview {
  proposals_sent: number
  proposals_accepted: number
  conversion_rate: number
  services_done: number
  services_in_progress: number
  total_earnings: number
  platform_fees_paid: number
  avg_ticket: number
  rating_avg: number
  rating_count: number
  provider_balance: number
}
interface SeriesPoint { period: string; value: number }
interface CategoryPerf {
  id: string; name: string; icon: string
  sent: number; accepted: number; conversion_rate: number; total_value: number
}

export default function DashboardScreen() {
  const [period, setPeriod] = useState<Period>('30d')
  const [overview, setOverview] = useState<Overview | null>(null)
  const [series, setSeries] = useState<SeriesPoint[]>([])
  const [cats, setCats] = useState<CategoryPerf[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.get(`/analytics/provider/overview?period=${period}`),
      api.get(`/analytics/provider/earnings-timeseries?period=${period}`),
      api.get(`/analytics/provider/categories?period=${period}`),
    ])
      .then(([o, s, c]) => {
        setOverview(o.data.data)
        setSeries(s.data.data)
        setCats(c.data.data)
      })
      .catch((e) => Alert.alert('Erro', getApiError(e)))
      .finally(() => setLoading(false))
  }, [period])

  return (
    <SafeAreaView className="flex-1 bg-slate2-50">
      <View className="flex-row items-center px-4 py-3 bg-white border-b border-slate2-200">
        <TouchableOpacity onPress={() => router.back()} className="mr-3"><ArrowLeft size={24} color="#334155" /></TouchableOpacity>
        <Text className="text-lg font-bold flex-1">Dashboard</Text>
        {loading && <ActivityIndicator size="small" color="#1D4ED8" />}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <PeriodTabs value={period} onChange={setPeriod} />

        {/* KPIs em grid 2x4 */}
        <View className="flex-row flex-wrap" style={{ gap: 8, marginHorizontal: -4 }}>
          <Kpi icon={<DollarSign size={16} color="#047857" />} label="Ganhos" value={formatCurrency(overview?.total_earnings ?? 0)} tone="emerald" />
          <Kpi icon={<Wallet size={16} color="#1D4ED8" />} label="Saldo" value={formatCurrency(overview?.provider_balance ?? 0)} tone="brand" />
          <Kpi icon={<Target size={16} color="#7C3AED" />} label="Conversão" value={`${Math.round((overview?.conversion_rate ?? 0) * 100)}%`} tone="violet" />
          <Kpi icon={<Star size={16} color="#B45309" />} label="Avaliação" value={`${(overview?.rating_avg ?? 0).toFixed(1)} ★`} tone="amber" />
          <Kpi icon={<CheckCircle2 size={16} color="#334155" />} label="Concluídos" value={`${overview?.services_done ?? 0}`} />
          <Kpi icon={<TrendingUp size={16} color="#334155" />} label="Ticket médio" value={formatCurrency(overview?.avg_ticket ?? 0)} />
          <Kpi icon={<ListChecks size={16} color="#334155" />} label="Propostas" value={`${overview?.proposals_sent ?? 0}`} />
          <Kpi icon={<Activity size={16} color="#334155" />} label="Taxas pagas" value={formatCurrency(overview?.platform_fees_paid ?? 0)} />
        </View>

        {/* Gráfico de barras simples */}
        <View className="bg-white rounded-2xl border border-slate2-200 p-4">
          <Text className="font-semibold mb-3">Evolução dos ganhos</Text>
          <BarChart points={series} />
        </View>

        {/* Por categoria */}
        <View className="bg-white rounded-2xl border border-slate2-200 overflow-hidden">
          <Text className="px-4 py-3 font-semibold border-b border-slate2-100">Por categoria</Text>
          {cats.length === 0 ? (
            <Text className="px-4 py-6 text-center text-sm text-slate2-500">Sem propostas no período.</Text>
          ) : (
            cats.slice(0, 8).map((c) => (
              <View key={c.id} className="px-4 py-3 border-b border-slate2-100 flex-row items-center">
                <Text className="text-xl mr-3">{c.icon}</Text>
                <View className="flex-1">
                  <Text className="font-medium">{c.name}</Text>
                  <Text className="text-xs text-slate2-500">
                    {c.accepted}/{c.sent} aceitas · {Math.round(c.conversion_rate * 100)}%
                  </Text>
                </View>
                <Text className="font-semibold text-emerald-700">{formatCurrency(c.total_value)}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function PeriodTabs({ value, onChange }: { value: Period; onChange: (v: Period) => void }) {
  const opts: Array<{ k: Period; l: string }> = [
    { k: '7d', l: '7d' }, { k: '30d', l: '30d' }, { k: '90d', l: '90d' }, { k: '12m', l: '12m' },
  ]
  return (
    <View className="flex-row bg-slate2-100 rounded-xl p-1">
      {opts.map((o) => (
        <TouchableOpacity
          key={o.k}
          onPress={() => onChange(o.k)}
          className={'flex-1 py-2 rounded-lg items-center ' + (value === o.k ? 'bg-white' : '')}
        >
          <Text className={value === o.k ? 'font-bold text-slate2-900' : 'text-slate2-500'}>{o.l}</Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}

function Kpi({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone?: 'emerald' | 'brand' | 'amber' | 'violet' }) {
  const bg =
    tone === 'emerald' ? 'bg-emerald-50' :
    tone === 'brand'   ? 'bg-brand-50' :
    tone === 'amber'   ? 'bg-amber-50' :
    tone === 'violet'  ? 'bg-violet-50' :
                         'bg-slate2-100'
  return (
    <View style={{ width: '48%', marginHorizontal: '1%' }} className="bg-white rounded-2xl border border-slate2-200 p-3 mb-2">
      <View className="flex-row items-center mb-2">
        <View className={`w-7 h-7 rounded-lg items-center justify-center mr-2 ${bg}`}>{icon}</View>
        <Text className="text-xs text-slate2-500 flex-1" numberOfLines={1}>{label}</Text>
      </View>
      <Text className="text-base font-extrabold text-slate2-900" numberOfLines={1}>{value}</Text>
    </View>
  )
}

function BarChart({ points }: { points: SeriesPoint[] }) {
  if (!points || points.length === 0) {
    return <Text className="text-sm text-slate2-500 text-center py-8">Sem dados no período.</Text>
  }
  const max = Math.max(...points.map((p) => p.value), 1)
  const W = Dimensions.get('window').width - 64
  const barCount = Math.min(points.length, 30)
  const slice = points.slice(-barCount)
  const gap = 2
  const barW = Math.max(2, (W - gap * (slice.length - 1)) / slice.length)
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 140 }}>
        {slice.map((p, i) => {
          const h = (p.value / max) * 130 + 2
          return (
            <View
              key={i}
              style={{
                width: barW,
                height: h,
                marginLeft: i === 0 ? 0 : gap,
                backgroundColor: '#1D4ED8',
                opacity: p.value > 0 ? 1 : 0.15,
                borderTopLeftRadius: 3,
                borderTopRightRadius: 3,
              }}
            />
          )
        })}
      </View>
      <View className="flex-row justify-between mt-2">
        <Text className="text-xs text-slate2-500">{formatLabel(slice[0]?.period)}</Text>
        <Text className="text-xs text-slate2-500">{formatLabel(slice[slice.length - 1]?.period)}</Text>
      </View>
      <View className="flex-row justify-between mt-2 px-1">
        <Text className="text-xs text-slate2-400">R$ 0</Text>
        <Text className="text-xs text-slate2-700 font-semibold">máx: {formatCurrency(max)}</Text>
      </View>
    </View>
  )
}

function formatLabel(p?: string): string {
  if (!p) return ''
  if (/^\d{4}-\d{2}$/.test(p)) {
    const [y, m] = p.split('-'); return `${m}/${y.slice(2)}`
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(p)) {
    const [, m, d] = p.split('-'); return `${d}/${m}`
  }
  return p
}
