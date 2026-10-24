'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { ArrowLeft, Download, ShieldAlert, BadgeCheck } from 'lucide-react'
import { api, getApiErrorMessage } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { PageSpinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import { Timeline, type TimelineItem, type People } from '@/components/admin/Timeline'
import { downloadAuthed } from '@/lib/adminDownload'
import { formatCurrency, formatDateTime } from '@/lib/utils'

type Tab = 'resumo' | 'timeline' | 'financeiro' | 'acessos'

export default function AdminUsuarioPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuthStore()
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('timeline')
  const [u, setU] = useState<any>(null)

  useEffect(() => { if (user && user.role !== 'ADMIN') router.replace('/home') }, [user, router])
  const loadUser = useCallback(() => {
    api.get(`/users/admin/users/${id}`).then((r) => setU(r.data.data)).catch((e) => toast.error(getApiErrorMessage(e)))
  }, [id])
  useEffect(() => { if (user?.role === 'ADMIN') loadUser() }, [user, loadUser])

  if (!user || !u) return <PageSpinner />
  if (user.role !== 'ADMIN') return null

  const status = u.banned_at ? 'Banida' : !u.is_active ? 'Inativa/suspensa' : 'Ativa'
  return (
    <div className="space-y-5">
      <Link href="/admin/usuarios" className="text-sm text-slate2-500 flex items-center gap-1 hover:text-slate2-800"><ArrowLeft className="w-4 h-4" /> Usuários</Link>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate2-900 flex items-center gap-2">
            {u.name}
            {u.is_verified_pro && <BadgeCheck className="w-5 h-5 text-trust-600" aria-label="Pro" />}
          </h1>
          <p className="text-sm text-slate2-600">{u.email} · {u.role} · conta {status} · desde {formatDateTime(u.created_at)}</p>
          {u.ban_reason && <p className="text-sm text-red-600 flex items-center gap-1 mt-1"><ShieldAlert className="w-4 h-4" /> {u.ban_reason}</p>}
        </div>
        <Button variant="outline" onClick={() => downloadAuthed(`/admin/users/${id}/dossier.csv`, `usuario-${String(id).slice(0, 8)}.csv`).catch((e) => toast.error(getApiErrorMessage(e)))}>
          <Download className="w-4 h-4" /> Dossiê CSV
        </Button>
      </div>

      <div className="flex gap-1 border-b border-slate2-200 overflow-x-auto">
        {([['timeline', 'Linha do tempo'], ['resumo', 'Resumo'], ['financeiro', 'Financeiro'], ['acessos', 'Acessos']] as [Tab, string][]).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 text-sm whitespace-nowrap border-b-2 -mb-px ${tab === k ? 'border-brand-600 text-brand-700 font-medium' : 'border-transparent text-slate2-500'}`}>{l}</button>
        ))}
      </div>

      {tab === 'resumo' && <Resumo u={u} />}
      {tab === 'timeline' && <UserTimeline id={id} />}
      {tab === 'financeiro' && <Financeiro id={id} onChanged={loadUser} />}
      {tab === 'acessos' && <Acessos id={id} />}
    </div>
  )
}

function Resumo({ u }: { u: any }) {
  const rows: [string, string][] = [
    ['Telefone', u.phone ?? '—'],
    ['CPF', u.cpf ? `${String(u.cpf).slice(0, 3)}.***.***-${String(u.cpf).slice(-2)}` : '—'],
    ['Cidade', [u.address_neighborhood, u.address_city, u.address_state].filter(Boolean).join(', ') || '—'],
    ['Documentos', u.document_verification_status],
    ['Pro até', u.verified_pro_expires ? formatDateTime(u.verified_pro_expires) : '—'],
    ['Saldo prestador', formatCurrency(u.provider_balance ?? 0)],
    ['Crédito na plataforma', formatCurrency(u.credit_balance ?? 0)],
    ['Avaliação', u.rating_count ? `${u.rating_avg?.toFixed(1)} (${u.rating_count})` : '—'],
    ['Não comparecimentos', String(u.no_show_count ?? 0)],
    ['Pedidos como cliente', String(u._count?.orders_as_client ?? 0)],
    ['Propostas', String(u._count?.proposals ?? 0)],
    ['Serviços como prestador', String(u._count?.schedules_provider ?? 0)],
    ['Saques', String(u._count?.withdrawals ?? 0)],
  ]
  return (
    <div className="grid sm:grid-cols-2 gap-2">
      {rows.map(([k, v]) => (
        <div key={k} className="border border-slate2-200 rounded-lg px-3 py-2">
          <p className="text-[11px] uppercase text-slate2-400">{k}</p>
          <p className="text-sm text-slate2-900">{v}</p>
        </div>
      ))}
    </div>
  )
}

function UserTimeline({ id }: { id: string }) {
  const [d, setD] = useState<{ items: TimelineItem[]; people: People; audit_started_at: string } | null>(null)
  useEffect(() => {
    api.get(`/admin/users/${id}/timeline`).then((r) => setD(r.data.data)).catch((e) => toast.error(getApiErrorMessage(e)))
  }, [id])
  if (!d) return <PageSpinner />
  return <Timeline items={d.items} people={d.people} auditStartedAt={d.audit_started_at} focusUserId={id} />
}

const REASON_LABEL: Record<string, string> = {
  FEE_CREDIT: 'Taxa devolvida', BOOST: 'Destaque de proposta', BOOST_REFUND: 'Destaque devolvido', WITHDRAWAL: 'Saque',
  WITHDRAWAL_REJECTED: 'Saque rejeitado (devolvido)', PAYMENT_RELEASE: 'Pagamento liberado (legado)',
  FEE_PAID_WITH_BALANCE: 'Taxa paga com saldo', FEE_PAID_WITH_BALANCE_REVERSAL: 'Débito de taxa devolvido',
  ADMIN_ADJUSTMENT: 'Ajuste do admin', OPENING_BALANCE: 'Saldo de abertura', ADMIN_REVERSAL: 'Estorno do admin',
  MP_ORPHAN_PAYMENT: 'Pagamento MP com taxa já resolvida',
}

function Financeiro({ id, onChanged }: { id: string; onChanged: () => void }) {
  const [d, setD] = useState<any>(null)
  const [kind, setKind] = useState<'PROVIDER' | 'CREDIT'>('CREDIT')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const load = useCallback(() => {
    api.get(`/admin/users/${id}/ledger`).then((r) => setD(r.data.data)).catch((e) => toast.error(getApiErrorMessage(e)))
  }, [id])
  useEffect(load, [load])

  const adjust = async (e: React.FormEvent) => {
    e.preventDefault()
    const value = Number(amount.replace(',', '.'))
    if (!value) return toast.error('Informe o valor (negativo para retirar)')
    if (reason.trim().length < 5) return toast.error('Informe o motivo')
    if (!confirm(`${value > 0 ? 'Adicionar' : 'Retirar'} ${formatCurrency(Math.abs(value))} do ${kind === 'PROVIDER' ? 'saldo do prestador' : 'crédito'}?`)) return
    setBusy(true)
    try {
      await api.post(`/admin/users/${id}/balance-adjust`, { kind, amount: value, reason: reason.trim() })
      toast.success('Ajuste registrado'); setAmount(''); setReason(''); load(); onChanged()
    } catch (err) { toast.error(getApiErrorMessage(err)) } finally { setBusy(false) }
  }

  const refundCredited = async (feeId: string) => {
    const r = prompt('Motivo do estorno em dinheiro (o crédito será retirado do usuário):')
    if (!r) return
    try {
      const res = await api.post(`/admin/fees/${feeId}/refund-credited`, { reason: r })
      toast.success(res.data.message); load(); onChanged()
    } catch (err) { toast.error(getApiErrorMessage(err)) }
  }

  if (!d) return <PageSpinner />
  return (
    <div className="space-y-5">
      <div className="grid sm:grid-cols-3 gap-2">
        <div className="border border-slate2-200 rounded-lg p-3"><p className="text-[11px] text-slate2-400">Saldo do prestador</p><p className="text-lg font-semibold">{formatCurrency(d.provider_balance)}</p></div>
        <div className="border border-slate2-200 rounded-lg p-3"><p className="text-[11px] text-slate2-400">Crédito na plataforma</p><p className="text-lg font-semibold">{formatCurrency(d.credit_balance)}</p></div>
        <div className={`border rounded-lg p-3 ${d.ledger_matches ? 'border-slate2-200' : 'border-red-300 bg-red-50'}`}>
          <p className="text-[11px] text-slate2-400">Soma do extrato</p>
          <p className="text-lg font-semibold">{formatCurrency(d.ledger_total)}</p>
          <p className={`text-[11px] ${d.ledger_matches ? 'text-emerald-700' : 'text-red-700'}`}>{d.ledger_matches ? 'Confere com o saldo' : 'Diferente do saldo — investigar'}</p>
        </div>
      </div>

      <form onSubmit={adjust} className="border border-slate2-200 rounded-xl p-3 space-y-2">
        <p className="text-sm font-medium text-slate2-800">Ajuste manual (reembolso / correção)</p>
        <div className="flex flex-wrap gap-2">
          <select value={kind} onChange={(e) => setKind(e.target.value as 'PROVIDER' | 'CREDIT')} className="rounded-lg border-[1.5px] border-slate2-300 px-3 py-2 text-sm">
            <option value="CREDIT">Crédito (abatido em taxas)</option>
            <option value="PROVIDER">Saldo do prestador (sacável)</option>
          </select>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Valor (ex.: 12,50 ou -5)" className="rounded-lg border-[1.5px] border-slate2-300 px-3 py-2 text-sm w-40" />
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo (fica registrado e é enviado ao usuário)" className="rounded-lg border-[1.5px] border-slate2-300 px-3 py-2 text-sm flex-1 min-w-[220px]" />
          <Button type="submit" isLoading={busy}>Registrar</Button>
        </div>
      </form>

      <section>
        <h2 className="text-sm font-semibold text-slate2-800 mb-2">Taxas de conexão</h2>
        <div className="space-y-1.5">
          {d.fees.length === 0 && <p className="text-sm text-slate2-500">Nenhuma.</p>}
          {d.fees.map((f: any) => (
            <div key={f.id} className="flex items-center justify-between gap-2 text-sm border border-slate2-200 rounded-lg px-3 py-2 flex-wrap">
              <Link href={`/admin/pedidos/${f.order_id}`} className="text-brand-700 hover:underline truncate max-w-[50%]">{f.order?.title ?? f.order_id.slice(0, 8)}</Link>
              <span className="text-slate2-600">{f.side === 'CLIENT' ? 'Cliente' : 'Prestador'} · {formatCurrency(f.gateway_amount || f.base_amount)} · {f.status}</span>
              {f.status === 'CREDITED' && <button onClick={() => refundCredited(f.id)} className="text-xs text-red-600 hover:underline">Estornar em dinheiro</button>}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate2-800 mb-2">Extrato do saldo do prestador</h2>
        <LedgerTable rows={d.balance_transactions.map((t: any) => ({ id: t.id, at: t.created_at, amount: t.amount, after: t.balance_after, label: REASON_LABEL[t.reason] ?? t.reason, note: t.note }))} />
      </section>
      <section>
        <h2 className="text-sm font-semibold text-slate2-800 mb-2">Movimentos de crédito</h2>
        <LedgerTable rows={d.credit_transactions.map((t: any) => ({ id: t.id, at: t.created_at, amount: t.amount, label: t.reason }))} />
      </section>
      <section>
        <h2 className="text-sm font-semibold text-slate2-800 mb-2">Saques</h2>
        <LedgerTable rows={d.withdrawals.map((w: any) => ({ id: w.id, at: w.created_at, amount: -w.amount, label: `${w.status} · Pix ${w.pix_key}`, note: w.notes }))} />
      </section>
    </div>
  )
}

function LedgerTable({ rows }: { rows: { id: string; at: string; amount: number; after?: number; label: string; note?: string | null }[] }) {
  if (rows.length === 0) return <p className="text-sm text-slate2-500">Nenhum movimento.</p>
  return (
    <div className="border border-slate2-200 rounded-lg divide-y divide-slate2-100">
      {rows.map((r) => (
        <div key={r.id} className="px-3 py-2 text-sm flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-slate2-800">{r.label}</p>
            <p className="text-[11px] text-slate2-500">{formatDateTime(r.at)}{r.note ? ` · ${r.note}` : ''}</p>
          </div>
          <div className="text-right shrink-0">
            <p className={`font-semibold ${r.amount < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{formatCurrency(r.amount)}</p>
            {r.after != null && <p className="text-[11px] text-slate2-500">saldo {formatCurrency(r.after)}</p>}
          </div>
        </div>
      ))}
    </div>
  )
}

const ACCESS_LABEL: Record<string, string> = { LOGIN_OK: 'Login', LOGIN_FAIL: 'Login recusado', REFRESH: 'Sessão renovada', LOGOUT: 'Saiu', REGISTER: 'Cadastro' }

function Acessos({ id }: { id: string }) {
  const [d, setD] = useState<any>(null)
  useEffect(() => {
    api.get(`/admin/users/${id}/access-logs`).then((r) => setD(r.data.data)).catch((e) => toast.error(getApiErrorMessage(e)))
  }, [id])
  if (!d) return <PageSpinner />
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-slate2-800 mb-2">Aparelhos ({d.devices.length})</h2>
        <div className="flex flex-wrap gap-2">
          {d.devices.map((x: any) => (
            <span key={x.device_id} className="text-xs border border-slate2-200 rounded-full px-3 py-1">
              {String(x.device_id).slice(0, 8)} · {x.count} acesso(s) · último {formatDateTime(x.last_seen)}
            </span>
          ))}
          {d.devices.length === 0 && <span className="text-sm text-slate2-500">Nenhum aparelho identificado ainda.</span>}
        </div>
      </div>
      <div className="border border-slate2-200 rounded-lg divide-y divide-slate2-100">
        {d.items.length === 0 && <p className="text-sm text-slate2-500 p-3">Nenhum acesso registrado.</p>}
        {d.items.map((a: any) => (
          <div key={a.id} className="px-3 py-2 text-sm flex justify-between gap-3 flex-wrap">
            <span className={a.event === 'LOGIN_FAIL' ? 'text-red-600' : 'text-slate2-800'}>{ACCESS_LABEL[a.event] ?? a.event}</span>
            <span className="text-[11px] text-slate2-500">
              {formatDateTime(a.created_at)} · IP {a.ip ?? '—'} · {a.app_version ?? 'versão ?'}{a.device_id ? ` · ${String(a.device_id).slice(0, 8)}` : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
