'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { ArrowLeft, Download, MapPin, MessageSquare, Ban } from 'lucide-react'
import { api, getApiErrorMessage } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { PageSpinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import { Timeline, type TimelineItem, type People } from '@/components/admin/Timeline'
import { ServicePhotoGallery } from '@/components/ServicePhotoGallery'
import { downloadAuthed } from '@/lib/adminDownload'
import { formatCurrency, formatDateTime, ORDER_STATUS_LABEL } from '@/lib/utils'

type Tab = 'timeline' | 'resumo' | 'taxas' | 'chat'

export default function AdminPedidoPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuthStore()
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('timeline')
  const [o, setO] = useState<any>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (user && user.role !== 'ADMIN') router.replace('/home') }, [user, router])
  const load = useCallback(() => {
    api.get(`/admin/orders/${id}`).then((r) => setO(r.data.data)).catch((e) => toast.error(getApiErrorMessage(e)))
  }, [id])
  useEffect(() => { if (user?.role === 'ADMIN') load() }, [user, load])

  if (!user || !o) return <PageSpinner />
  if (user.role !== 'ADMIN') return null

  const cancel = async () => {
    const reason = prompt('Motivo do cancelamento (fica registrado e é enviado ao cliente e ao prestador):')
    if (reason === null) return
    if (reason.trim().length < 5) return toast.error('Informe o motivo (mínimo 5 caracteres)')
    const creditFees = confirm('Devolver as taxas já pagas como crédito/saldo?\n\nOK = devolver · Cancelar = não devolver (ex.: fraude comprovada)')
    setBusy(true)
    try {
      const r = await api.patch(`/orders/admin/orders/${id}/cancel`, { reason: reason.trim(), credit_fees: creditFees })
      toast.success(r.data.message); load()
    } catch (e) { toast.error(getApiErrorMessage(e)) } finally { setBusy(false) }
  }

  const canCancel = !['DONE', 'RATED', 'CANCELLED'].includes(o.status)
  const provider = o.schedule?.provider
  return (
    <div className="space-y-5">
      <Link href="/admin/pedidos" className="text-sm text-slate2-500 flex items-center gap-1 hover:text-slate2-800"><ArrowLeft className="w-4 h-4" /> Pedidos</Link>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate2-900">{o.title}</h1>
          <p className="text-sm text-slate2-600">
            {ORDER_STATUS_LABEL[o.status as keyof typeof ORDER_STATUS_LABEL] ?? o.status} · {o.category?.name} · criado {formatDateTime(o.created_at)} · nº {String(o.id).slice(0, 8)}
          </p>
          {o.cancel_reason && <p className="text-sm text-red-600 mt-1">Cancelado: {o.cancel_reason}</p>}
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => downloadAuthed(`/admin/orders/${id}/dossier.csv`, `pedido-${String(id).slice(0, 8)}.csv`).catch((e) => toast.error(getApiErrorMessage(e)))}>
            <Download className="w-4 h-4" /> Dossiê CSV
          </Button>
          {canCancel && <Button variant="danger" isLoading={busy} onClick={cancel}><Ban className="w-4 h-4" /> Cancelar pedido</Button>}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <Party title="Cliente" p={o.client} />
        <Party title="Prestador" p={provider} extra={o.schedule?.scheduled_at ? `Agendado para ${formatDateTime(o.schedule.scheduled_at)}` : undefined} />
      </div>

      <div className="flex gap-1 border-b border-slate2-200 overflow-x-auto">
        {([['timeline', 'Linha do tempo'], ['resumo', 'Pedido e propostas'], ['taxas', 'Taxas'], ['chat', 'Chat']] as [Tab, string][]).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 text-sm whitespace-nowrap border-b-2 -mb-px ${tab === k ? 'border-brand-600 text-brand-700 font-medium' : 'border-transparent text-slate2-500'}`}>{l}</button>
        ))}
      </div>

      {tab === 'timeline' && <OrderTimeline id={id} />}
      {tab === 'resumo' && <Resumo o={o} />}
      {tab === 'taxas' && <Taxas o={o} onChanged={load} />}
      {tab === 'chat' && <Chat id={id} />}
    </div>
  )
}

function Party({ title, p, extra }: { title: string; p: any; extra?: string }) {
  return (
    <div className="border border-slate2-200 rounded-xl p-3">
      <p className="text-[11px] uppercase text-slate2-400">{title}</p>
      {p ? (
        <>
          <Link href={`/admin/usuarios/${p.id}`} className="text-sm font-medium text-brand-700 hover:underline">{p.name}</Link>
          <p className="text-xs text-slate2-500">{p.email}{p.phone ? ` · ${p.phone}` : ''}</p>
          {extra && <p className="text-xs text-slate2-500">{extra}</p>}
        </>
      ) : <p className="text-sm text-slate2-500">—</p>}
    </div>
  )
}

function OrderTimeline({ id }: { id: string }) {
  const [d, setD] = useState<{ items: TimelineItem[]; people: People; audit_started_at: string } | null>(null)
  useEffect(() => {
    api.get(`/admin/orders/${id}/timeline`).then((r) => setD(r.data.data)).catch((e) => toast.error(getApiErrorMessage(e)))
  }, [id])
  if (!d) return <PageSpinner />
  return <Timeline items={d.items} people={d.people} auditStartedAt={d.audit_started_at} />
}

function Resumo({ o }: { o: any }) {
  const answers = o.answers_snapshot ?? null
  const mapsUrl = o.latitude != null && o.longitude != null ? `https://www.google.com/maps?q=${o.latitude},${o.longitude}` : null
  return (
    <div className="space-y-4">
      {o.description && <p className="text-sm text-slate2-700 whitespace-pre-wrap">{o.description}</p>}
      <div className="text-sm text-slate2-600 flex items-start gap-1">
        <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
        <span>
          {[o.address, o.address_number, o.address_complement, o.neighborhood, o.city, o.state, o.cep].filter(Boolean).join(', ') || '—'}
          {o.location_source && <span className="text-xs text-slate2-400"> · origem: {o.location_source}{o.location_accuracy_m ? ` (±${Math.round(o.location_accuracy_m)} m)` : ''}</span>}
          {mapsUrl && <> · <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="text-brand-700 hover:underline">ver no mapa</a></>}
        </span>
      </div>
      {Array.isArray(answers) && answers.length > 0 && (
        <div className="border border-slate2-200 rounded-lg divide-y divide-slate2-100">
          {answers.map((a: any, i: number) => (
            <div key={i} className="px-3 py-2 text-sm"><span className="text-slate2-500">{a.question ?? a.label}: </span>{a.value === 'true' ? 'Sim' : a.value === 'false' ? 'Não' : String(a.value ?? a.answer ?? '')}</div>
          ))}
        </div>
      )}
      <ServicePhotoGallery photos={o.service_photos ?? []} />
      <div>
        <p className="text-sm font-semibold text-slate2-800 mb-1">Propostas ({o.proposals.length})</p>
        <div className="space-y-1.5">
          {o.proposals.map((p: any) => (
            <div key={p.id} className="flex items-center justify-between text-sm border border-slate2-200 rounded-lg px-3 py-2 gap-2">
              <Link href={`/admin/usuarios/${p.provider.id}`} className="text-brand-700 hover:underline">{p.provider.name}</Link>
              <span className="text-slate2-500">{formatCurrency(p.value)} · {p.status}{p.boost_purchases?.length ? ` · ${p.boost_purchases.length} destaque(s)` : ''} · {formatDateTime(p.created_at)}</span>
            </div>
          ))}
        </div>
      </div>
      {o.archives?.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-slate2-800 mb-1">Agendamentos arquivados</p>
          {o.archives.map((a: any) => (
            <p key={a.id} className="text-xs text-slate2-600">{formatDateTime(a.archived_at)} · {a.reason}</p>
          ))}
        </div>
      )}
    </div>
  )
}

function Taxas({ o, onChanged }: { o: any; onChanged: () => void }) {
  const refund = async (fee: any) => {
    const notes = prompt(fee.status === 'CREDITED'
      ? 'Motivo do estorno em dinheiro (o crédito será retirado do usuário):'
      : 'Motivo do estorno (faça o estorno no painel do Mercado Pago):')
    if (!notes) return
    try {
      const r = fee.status === 'CREDITED'
        ? await api.post(`/admin/fees/${fee.id}/refund-credited`, { reason: notes })
        : await api.post(`/payments/admin/fees/${fee.id}/refund`, { notes })
      toast.success(r.data.message); onChanged()
    } catch (e) { toast.error(getApiErrorMessage(e)) }
  }
  if (!o.connection_fees?.length) return <p className="text-sm text-slate2-500">Sem taxas de conexão.</p>
  return (
    <div className="space-y-2">
      {o.connection_fees.map((f: any) => (
        <div key={f.id} className="border border-slate2-200 rounded-lg px-3 py-2 text-sm">
          <div className="flex justify-between gap-2 flex-wrap">
            <span className="font-medium">{f.side === 'CLIENT' ? 'Cliente' : 'Prestador'} · {f.status}</span>
            <span>{formatCurrency(f.gateway_amount || f.base_amount)}{f.credit_used ? ` (crédito usado ${formatCurrency(f.credit_used)})` : ''}</span>
          </div>
          <p className="text-[11px] text-slate2-500">
            {f.pct_applied}% · gerada {formatDateTime(f.created_at)}
            {f.paid_at && ` · paga ${formatDateTime(f.paid_at)} (${f.method ?? '—'})`}
            {f.credited_at && ` · creditada ${formatDateTime(f.credited_at)} (${f.credit_reason})`}
            {f.mp_payment_id && ` · MP ${f.mp_payment_id}`}
          </p>
          {['PAID', 'COVERED', 'CREDITED'].includes(f.status) && (
            <button onClick={() => refund(f)} className="text-xs text-red-600 hover:underline mt-1">Estornar</button>
          )}
        </div>
      ))}
    </div>
  )
}

function Chat({ id }: { id: string }) {
  const [d, setD] = useState<any>(null)
  const [asked, setAsked] = useState(false)
  const open = async () => {
    const reason = prompt('Motivo para abrir a conversa (fica registrado):') ?? ''
    setAsked(true)
    try {
      const r = await api.get(`/admin/orders/${id}/chat`, { params: { reason } })
      setD(r.data.data)
    } catch (e) { toast.error(getApiErrorMessage(e)) }
  }
  if (!asked) {
    return (
      <div className="text-center py-8 space-y-3">
        <p className="text-sm text-slate2-600">A conversa é privada entre cliente e prestador. Abrir fica registrado na linha do tempo.</p>
        <Button onClick={open}><MessageSquare className="w-4 h-4" /> Abrir conversa</Button>
      </div>
    )
  }
  if (!d) return <PageSpinner />
  const name = (uid: string) => d.people[uid]?.name ?? uid.slice(0, 8)
  const Msgs = ({ list }: { list: any[] }) => (
    <div className="space-y-1.5">
      {list.length === 0 && <p className="text-sm text-slate2-500">Sem mensagens.</p>}
      {list.map((m) => (
        <div key={m.id} className="text-sm border border-slate2-100 rounded-lg px-3 py-1.5">
          <p className="text-[11px] text-slate2-500">{name(m.sender_id)} · {formatDateTime(m.created_at)}</p>
          {m.content && <p className="text-slate2-800 whitespace-pre-wrap">{m.content}</p>}
          {m.photo_url && <a href={m.photo_url} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-700 hover:underline">ver foto</a>}
        </div>
      ))}
    </div>
  )
  return (
    <div className="space-y-5">
      <section><p className="text-sm font-semibold text-slate2-800 mb-2">Conversa atual</p><Msgs list={d.current} /></section>
      {d.archived.map((a: any) => (
        <section key={a.archive_id}>
          <p className="text-sm font-semibold text-slate2-800 mb-1">Conversa arquivada · {formatDateTime(a.archived_at)} · {a.reason}</p>
          <Msgs list={a.messages} />
        </section>
      ))}
    </div>
  )
}
