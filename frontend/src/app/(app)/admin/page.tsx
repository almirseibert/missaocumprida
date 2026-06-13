'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import {
  ShieldCheck, ChevronRight, LifeBuoy, Wallet, TrendingUp, Landmark,
  Lock, Users, ShoppingBag, RefreshCw, AlertTriangle, ArrowDownToLine,
  FolderTree, Megaphone,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { api, getApiErrorMessage } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { PageSpinner } from '@/components/ui/Spinner'
import { formatCurrency, ORDER_STATUS_LABEL } from '@/lib/utils'

type Overview = {
  period: string
  financeiro: {
    gmv: number; platform_revenue: number; gateway_fees: number; provider_volume: number
    transactions: number
    held_amount: number; held_count: number
    released_amount: number; released_count: number
    refunded_amount: number; refunded_count: number
    provider_available_balance: number
    withdrawals_pending_amount: number; withdrawals_pending_count: number
    withdrawals_paid_amount: number
    disputes_open: number
  }
  payments_by_status: { status: string; count: number; amount: number }[]
  usuarios: { total: number; novos: number; verificados: number; por_role: { role: string; count: number }[] }
  pedidos: { total_periodo: number; por_status: { status: string; count: number }[] }
}

const PERIODS = [
  { key: '7d', label: '7 dias' },
  { key: '30d', label: '30 dias' },
  { key: '90d', label: '90 dias' },
  { key: '12m', label: '12 meses' },
]

const ROLE_LABEL: Record<string, string> = {
  CLIENT: 'Clientes', PROVIDER: 'Prestadores', BOTH: 'Ambos', ADMIN: 'Admins',
}

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendente', PAID: 'Pago', HELD: 'Em garantia', RELEASED: 'Liberado',
  REFUNDED: 'Reembolsado', FAILED: 'Falhou', DISPUTED: 'Em disputa',
}

export default function AdminHomePage() {
  const { user } = useAuthStore()
  const router = useRouter()
  const [period, setPeriod] = useState('30d')
  const [data, setData] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user && user.role !== 'ADMIN') router.replace('/home')
  }, [user, router])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get(`/analytics/admin/overview?period=${period}`)
      setData(res.data.data)
    } catch (e) {
      toast.error(getApiErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => {
    if (user?.role === 'ADMIN') load()
  }, [user, load])

  if (!user) return <PageSpinner />
  if (user.role !== 'ADMIN') return null

  const f = data?.financeiro
  const navCards = [
    { href: '/admin/transacoes', title: 'Financeiro & Transações', desc: 'Segurança de Transação, saques e movimentações', icon: Wallet },
    { href: '/admin/categorias', title: 'Categorias & Questionários', desc: 'Grupos, serviços e perguntas', icon: FolderTree },
    { href: '/admin/usuarios', title: 'Usuários & Cadastros', desc: 'Buscar, verificar e moderar contas', icon: Users },
    { href: '/admin/pedidos', title: 'Pedidos & Agendamentos', desc: 'Acompanhamento e intervenção', icon: ShoppingBag },
    { href: '/admin/verificacoes', title: 'Verificações de identidade', desc: 'Aprovar ou recusar documentos (KYC)', icon: ShieldCheck },
    { href: '/admin/comunicacao', title: 'Comunicação', desc: 'Comunicados/broadcast aos usuários', icon: Megaphone },
    { href: '/admin/suporte', title: 'Suporte ao usuário', desc: 'Mensagens de clientes e prestadores', icon: LifeBuoy },
  ]

  return (
    <div className="space-y-6">
      {/* Header + filtro de período */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate2-900">Painel administrativo</h1>
          <p className="text-sm text-slate2-600 mt-1">Bem-vindo, {user.name.split(' ')[0]}. Visão geral da plataforma.</p>
        </div>
        <div className="flex items-center gap-1 bg-slate2-100 rounded-xl p-1">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                period === p.key ? 'bg-white text-slate2-900 shadow-sm' : 'text-slate2-500 hover:text-slate2-700'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading || !f ? (
        <div className="py-16"><PageSpinner /></div>
      ) : (
        <>
          {/* KPIs financeiros principais */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi icon={TrendingUp} label="Volume (GMV)" value={formatCurrency(f.gmv)} sub={`${f.transactions} transações`} tone="brand" />
            <Kpi icon={Landmark} label="Receita da plataforma" value={formatCurrency(f.platform_revenue)} sub={`Gateway: ${formatCurrency(f.gateway_fees)}`} tone="accent" />
            <Kpi icon={Lock} label="Em garantia" value={formatCurrency(f.held_amount)} sub={`${f.held_count} retidas`} tone="amber" />
            <Kpi icon={Wallet} label="Liberado a prestadores" value={formatCurrency(f.released_amount)} sub={`${f.released_count} no período`} tone="violet" />
          </div>

          {/* KPIs secundários */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi icon={ArrowDownToLine} label="Saldo sacável (prestadores)" value={formatCurrency(f.provider_available_balance)} tone="slate" />
            <Kpi icon={ArrowDownToLine} label="Saques pendentes" value={formatCurrency(f.withdrawals_pending_amount)} sub={`${f.withdrawals_pending_count} solicitações`} tone="slate" />
            <Kpi icon={RefreshCw} label="Reembolsado" value={formatCurrency(f.refunded_amount)} sub={`${f.refunded_count} no período`} tone="slate" />
            <Kpi icon={AlertTriangle} label="Disputas abertas" value={String(f.disputes_open)} tone={f.disputes_open > 0 ? 'red' : 'slate'} />
          </div>

          {/* Distribuições */}
          <div className="grid lg:grid-cols-3 gap-3">
            <Panel title="Transações por status" icon={Wallet}>
              {data!.payments_by_status.length === 0 ? (
                <Empty />
              ) : (
                <ul className="space-y-1.5">
                  {data!.payments_by_status.map((s) => (
                    <Row key={s.status} label={PAYMENT_STATUS_LABEL[s.status] ?? s.status} count={s.count} extra={formatCurrency(s.amount)} />
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Usuários" icon={Users}>
              <div className="flex gap-4 mb-3">
                <Stat label="Total" value={data!.usuarios.total} />
                <Stat label="Novos" value={data!.usuarios.novos} />
                <Stat label="Verificados" value={data!.usuarios.verificados} />
              </div>
              <ul className="space-y-1.5">
                {data!.usuarios.por_role.map((r) => (
                  <Row key={r.role} label={ROLE_LABEL[r.role] ?? r.role} count={r.count} />
                ))}
              </ul>
            </Panel>

            <Panel title="Pedidos" icon={ShoppingBag}>
              <div className="mb-3"><Stat label="No período" value={data!.pedidos.total_periodo} /></div>
              {data!.pedidos.por_status.length === 0 ? (
                <Empty />
              ) : (
                <ul className="space-y-1.5">
                  {data!.pedidos.por_status.map((o) => (
                    <Row key={o.status} label={ORDER_STATUS_LABEL[o.status as keyof typeof ORDER_STATUS_LABEL] ?? o.status} count={o.count} />
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </>
      )}

      {/* Navegação para módulos */}
      <div>
        <h2 className="text-sm font-semibold text-slate2-700 mb-2">Gestão</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {navCards.map((c) => {
            const Icon = c.icon
            return (
              <Link
                key={c.href}
                href={c.href}
                className="bg-white border border-slate2-200 rounded-2xl p-5 hover:border-brand-300 hover:shadow-sm transition-all flex items-start gap-3"
              >
                <div className="w-10 h-10 rounded-full bg-brand-50 flex items-center justify-center text-brand-600 flex-shrink-0">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-slate2-900">{c.title}</h3>
                  <p className="text-xs text-slate2-500 mt-0.5">{c.desc}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate2-400 mt-1.5" />
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
const TONES: Record<string, string> = {
  brand: 'bg-brand-50 text-brand-600',
  accent: 'bg-accent-50 text-accent-600',
  amber: 'bg-amber-50 text-amber-600',
  violet: 'bg-violet-50 text-violet-600',
  red: 'bg-red-50 text-red-600',
  slate: 'bg-slate2-100 text-slate2-600',
}

function Kpi({ icon: Icon, label, value, sub, tone = 'slate' }: {
  icon: React.ElementType; label: string; value: string; sub?: string; tone?: string
}) {
  return (
    <div className="bg-white border border-slate2-200 rounded-2xl p-4">
      <div className={`w-9 h-9 rounded-full flex items-center justify-center mb-3 ${TONES[tone]}`}>
        <Icon className="w-4.5 h-4.5" />
      </div>
      <p className="text-xs text-slate2-500">{label}</p>
      <p className="text-lg font-bold text-slate2-900 mt-0.5 leading-tight">{value}</p>
      {sub && <p className="text-[11px] text-slate2-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function Panel({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate2-200 rounded-2xl p-4">
      <h3 className="font-semibold text-slate2-800 text-sm flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-slate2-400" /> {title}
      </h3>
      {children}
    </div>
  )
}

function Row({ label, count, extra }: { label: string; count: number; extra?: string }) {
  return (
    <li className="flex items-center justify-between text-sm">
      <span className="text-slate2-600">{label}</span>
      <span className="font-medium text-slate2-900">
        {count}{extra ? <span className="text-slate2-400 font-normal ml-2">{extra}</span> : null}
      </span>
    </li>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-lg font-bold text-slate2-900 leading-none">{value}</p>
      <p className="text-[11px] text-slate2-400 mt-1">{label}</p>
    </div>
  )
}

function Empty() {
  return <p className="text-sm text-slate2-400">Sem dados no período.</p>
}
