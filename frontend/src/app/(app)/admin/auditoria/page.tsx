'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Search, RefreshCw, AlertTriangle } from 'lucide-react'
import { api, getApiErrorMessage } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { PageSpinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Timeline, eventLabel, type TimelineItem, type People } from '@/components/admin/Timeline'
import { formatCurrency, formatDateTime, ORDER_STATUS_LABEL } from '@/lib/utils'

type Tab = 'busca' | 'eventos' | 'webhooks' | 'conciliacao'

export default function AdminAuditoriaPage() {
  const { user } = useAuthStore()
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('busca')
  useEffect(() => { if (user && user.role !== 'ADMIN') router.replace('/home') }, [user, router])
  if (!user) return <PageSpinner />
  if (user.role !== 'ADMIN') return null

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate2-900">Auditoria & rastreabilidade</h1>
        <p className="text-sm text-slate2-600 mt-1">Quem fez o quê, quando e de onde — para responder reclamações e decidir reembolsos.</p>
      </div>
      <div className="flex gap-1 border-b border-slate2-200 overflow-x-auto">
        {([['busca', 'Buscar'], ['eventos', 'Eventos'], ['webhooks', 'Webhooks'], ['conciliacao', 'Conciliação']] as [Tab, string][]).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 text-sm whitespace-nowrap border-b-2 -mb-px ${tab === k ? 'border-brand-600 text-brand-700 font-medium' : 'border-transparent text-slate2-500'}`}>{l}</button>
        ))}
      </div>
      {tab === 'busca' && <Busca />}
      {tab === 'eventos' && <Eventos />}
      {tab === 'webhooks' && <Webhooks />}
      {tab === 'conciliacao' && <Conciliacao />}
    </div>
  )
}

function Busca() {
  const [q, setQ] = useState('')
  const [d, setD] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const run = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try { setD((await api.get('/admin/audit/search', { params: { q } })).data.data) }
    catch (err) { toast.error(getApiErrorMessage(err)) } finally { setBusy(false) }
  }
  return (
    <div className="space-y-4">
      <form onSubmit={run} className="flex gap-2">
        <div className="flex-1"><Input leftIcon={<Search className="w-4 h-4" />} placeholder="E-mail, nome, telefone, CPF ou nº do pedido" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <Button type="submit" isLoading={busy}>Buscar</Button>
      </form>
      {d && (
        <div className="grid md:grid-cols-2 gap-4">
          <section>
            <p className="text-sm font-semibold text-slate2-800 mb-2">Usuários ({d.users.length})</p>
            {d.cpf_matches.length > 0 && (
              <p className="text-xs text-slate2-500 mb-2">CPF registrado: {d.cpf_matches.map((c: any) => c.status).join(', ')}</p>
            )}
            <div className="space-y-1.5">
              {d.users.map((u: any) => (
                <Link key={u.id} href={`/admin/usuarios/${u.id}`} className="block border border-slate2-200 rounded-lg px-3 py-2 hover:bg-slate2-50">
                  <p className="text-sm font-medium text-slate2-900">{u.name} {u.banned_at && <span className="text-xs text-red-600">· banido</span>}</p>
                  <p className="text-xs text-slate2-500">{u.email} · {u.role} · desde {formatDateTime(u.created_at)}</p>
                </Link>
              ))}
              {d.users.length === 0 && <p className="text-sm text-slate2-500">Nenhum.</p>}
            </div>
          </section>
          <section>
            <p className="text-sm font-semibold text-slate2-800 mb-2">Pedidos ({d.orders.length})</p>
            <div className="space-y-1.5">
              {d.orders.map((o: any) => (
                <Link key={o.id} href={`/admin/pedidos/${o.id}`} className="block border border-slate2-200 rounded-lg px-3 py-2 hover:bg-slate2-50">
                  <p className="text-sm font-medium text-slate2-900">{o.title}</p>
                  <p className="text-xs text-slate2-500">{ORDER_STATUS_LABEL[o.status as keyof typeof ORDER_STATUS_LABEL] ?? o.status} · {o.client?.name} · {formatDateTime(o.created_at)} · nº {o.id.slice(0, 8)}</p>
                </Link>
              ))}
              {d.orders.length === 0 && <p className="text-sm text-slate2-500">Nenhum.</p>}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

function Eventos() {
  const [types, setTypes] = useState<{ type: string; count: number }[]>([])
  const [type, setType] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [items, setItems] = useState<TimelineItem[]>([])
  const [people, setPeople] = useState<People>({})
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => { api.get('/admin/audit/types').then((r) => setTypes(r.data.data)).catch(() => {}) }, [])

  const load = useCallback(async (more: boolean) => {
    setLoading(true)
    try {
      const params: Record<string, string> = { limit: '100' }
      if (type) params.type = type
      if (from) params.from = from
      if (to) params.to = `${to}T23:59:59`
      if (more && cursor) params.cursor = cursor
      const r = await api.get('/admin/audit', { params })
      const d = r.data.data
      setItems((prev) => (more ? [...prev, ...d.items] : d.items))
      setPeople((prev) => ({ ...(more ? prev : {}), ...d.people }))
      setCursor(d.next_cursor)
    } catch (e) { toast.error(getApiErrorMessage(e)) } finally { setLoading(false) }
  }, [type, from, to, cursor])

  useEffect(() => { load(false) }, [type, from, to]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-lg border-[1.5px] border-slate2-300 px-3 py-2 text-sm">
          <option value="">Todos os eventos</option>
          {types.map((t) => <option key={t.type} value={t.type}>{eventLabel(t.type)} ({t.count})</option>)}
        </select>
        <label className="text-xs text-slate2-500">de <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border-[1.5px] border-slate2-300 px-2 py-1.5 text-sm" /></label>
        <label className="text-xs text-slate2-500">até <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border-[1.5px] border-slate2-300 px-2 py-1.5 text-sm" /></label>
      </div>
      <Timeline items={items} people={people} />
      {cursor && <Button variant="outline" isLoading={loading} onClick={() => load(true)}>Carregar mais</Button>}
    </div>
  )
}

const WH_STATUS_COLOR: Record<string, string> = {
  PROCESSED: 'text-emerald-700', IGNORED: 'text-slate2-500', FAILED: 'text-red-600', RECEIVED: 'text-amber-600',
}

function Webhooks() {
  const [provider, setProvider] = useState('')
  const [status, setStatus] = useState('')
  const [d, setD] = useState<any>(null)
  const [open, setOpen] = useState<any>(null)
  const load = useCallback(() => {
    api.get('/admin/webhooks', { params: { provider: provider || undefined, status: status || undefined } })
      .then((r) => setD(r.data.data)).catch((e) => toast.error(getApiErrorMessage(e)))
  }, [provider, status])
  useEffect(load, [load])

  const replay = async (id: string) => {
    if (!confirm('Reprocessar este evento? É seguro: o que já foi aplicado não é aplicado de novo.')) return
    try { const r = await api.post(`/admin/webhooks/${id}/replay`); toast.success(r.data.message); load() }
    catch (e) { toast.error(getApiErrorMessage(e)) }
  }
  const view = async (id: string) => {
    try { setOpen((await api.get(`/admin/webhooks/${id}`)).data.data) } catch (e) { toast.error(getApiErrorMessage(e)) }
  }

  if (!d) return <PageSpinner />
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <select value={provider} onChange={(e) => setProvider(e.target.value)} className="rounded-lg border-[1.5px] border-slate2-300 px-3 py-2 text-sm">
          <option value="">Todos</option><option value="MERCADOPAGO">Mercado Pago</option><option value="REVENUECAT">RevenueCat</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border-[1.5px] border-slate2-300 px-3 py-2 text-sm">
          <option value="">Todos status</option>{['PROCESSED', 'IGNORED', 'FAILED', 'RECEIVED'].map((s) => <option key={s}>{s}</option>)}
        </select>
        <span className="text-xs text-slate2-500 self-center">
          {d.counts.map((c: any) => `${c.provider} ${c.status}: ${c.count}`).join(' · ')}
        </span>
      </div>
      <div className="border border-slate2-200 rounded-lg divide-y divide-slate2-100">
        {d.items.length === 0 && <p className="text-sm text-slate2-500 p-3">Nenhum evento.</p>}
        {d.items.map((w: any) => (
          <div key={w.id} className="px-3 py-2 text-sm flex items-start justify-between gap-2 flex-wrap">
            <div className="min-w-0">
              <p className="text-slate2-800">{w.provider} · {w.event_type ?? '—'} <span className={WH_STATUS_COLOR[w.status] ?? ''}>· {w.status}</span></p>
              <p className="text-[11px] text-slate2-500 break-all">{formatDateTime(w.received_at)} · {w.external_id} · {w.attempts} tentativa(s){w.error ? ` · ${w.error}` : ''}</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => view(w.id)} className="text-xs text-brand-700 hover:underline">Ver</button>
              <button onClick={() => replay(w.id)} className="text-xs text-brand-700 hover:underline flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Reprocessar</button>
            </div>
          </div>
        ))}
      </div>
      {open && (
        <div className="border border-slate2-200 rounded-lg p-3">
          <div className="flex justify-between"><p className="text-sm font-medium">{open.external_id}</p><button onClick={() => setOpen(null)} className="text-xs text-slate2-500">fechar</button></div>
          <pre className="text-[11px] bg-slate2-50 rounded p-2 mt-2 overflow-x-auto whitespace-pre-wrap break-all">{JSON.stringify(open.payload, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}

function Conciliacao() {
  const [d, setD] = useState<any>(null)
  useEffect(() => { api.get('/admin/reconciliation').then((r) => setD(r.data.data)).catch((e) => toast.error(getApiErrorMessage(e))) }, [])
  if (!d) return <PageSpinner />
  const Block = ({ title, count, children }: { title: string; count: number; children: React.ReactNode }) => (
    <section className={`border rounded-xl p-3 ${count ? 'border-amber-300 bg-amber-50/40' : 'border-slate2-200'}`}>
      <p className="text-sm font-semibold text-slate2-800 flex items-center gap-1">
        {count > 0 && <AlertTriangle className="w-4 h-4 text-amber-600" />} {title} ({count})
      </p>
      {count === 0 ? <p className="text-xs text-slate2-500 mt-1">Tudo certo.</p> : <div className="mt-2 space-y-1 text-xs">{children}</div>}
    </section>
  )
  const U = ({ id }: { id: string }) => <Link href={`/admin/usuarios/${id}`} className="text-brand-700 hover:underline">{id.slice(0, 8)}</Link>
  const O = ({ id }: { id: string }) => <Link href={`/admin/pedidos/${id}`} className="text-brand-700 hover:underline">{id.slice(0, 8)}</Link>
  return (
    <div className="grid md:grid-cols-2 gap-3">
      <Block title="Saldo diferente do extrato" count={d.balance_mismatch.length}>
        {d.balance_mismatch.map((m: any) => <p key={m.user_id}><U id={m.user_id} /> · saldo {formatCurrency(m.balance)} × extrato {formatCurrency(m.ledger)}</p>)}
      </Block>
      <Block title="Webhooks com falha" count={d.failed_webhooks.length}>
        {d.failed_webhooks.map((w: any) => <p key={w.id}>{w.provider} · {w.external_id} · {w.error ?? w.status}</p>)}
      </Block>
      <Block title="Taxa paga há +24 h com pedido parado" count={d.stuck_fees.length}>
        {d.stuck_fees.map((f: any) => <p key={f.id}>Pedido <O id={f.order_id} /> · {f.side} · {formatCurrency(f.gateway_amount)} · {formatDateTime(f.paid_at)}</p>)}
      </Block>
      <Block title="Estornos/chargebacks no Mercado Pago" count={d.gateway_reversals.length}>
        {d.gateway_reversals.map((e: any) => <p key={e.id}>{formatDateTime(e.at)} · {e.order_id ? <O id={e.order_id} /> : '—'} · {e.reason}</p>)}
      </Block>
      <Block title="Saques pendentes" count={d.pending_withdrawals.length}>
        {d.pending_withdrawals.map((w: any) => <p key={w.id}><U id={w.provider_id} /> · {formatCurrency(w.amount)} · {w.status} · {formatDateTime(w.created_at)}</p>)}
      </Block>
      <Block title="Contato liberado sem taxa do prestador" count={d.unlocked_without_fee.length}>
        {d.unlocked_without_fee.map((o: any) => <p key={o.id}><O id={o.id} /> · {o.title} · {o.status}</p>)}
      </Block>
    </div>
  )
}
