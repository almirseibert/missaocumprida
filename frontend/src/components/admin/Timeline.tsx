'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronRight, History, ShieldCheck } from 'lucide-react'
import { formatCurrency, formatDateTime } from '@/lib/utils'

export type TimelineItem = {
  id: string
  at: string
  type: string
  source: 'audit' | 'history'
  actor_id: string | null
  actor_role: string | null
  user_id: string | null
  counterpart_id: string | null
  order_id: string | null
  entity_type: string | null
  entity_id: string | null
  amount: number | null
  reason: string | null
  before?: unknown
  after?: unknown
  metadata?: unknown
  ip?: string | null
  user_agent?: string | null
  device_id?: string | null
  app_version?: string | null
  request_id?: string | null
}

export type People = Record<string, { id: string; name: string; email: string; role: string }>

// Rótulos em português dos tipos de evento (os desconhecidos aparecem como vieram)
export const EVENT_LABEL: Record<string, string> = {
  USER_REGISTERED: 'Cadastro criado',
  REGISTER: 'Cadastro',
  TERMS_ACCEPTED: 'Aceitou os Termos',
  LOGIN_OK: 'Login',
  LOGIN_FAIL: 'Login recusado',
  PROFILE_UPDATED: 'Perfil alterado',
  PROFILE_UPDATED_CPF: 'CPF alterado',
  PASSWORD_CHANGED: 'Senha alterada',
  KYC_SUBMITTED: 'Enviou documentos',
  KYC_REVIEWED: 'Documentos analisados',
  KYC_APPROVED: 'Documentos aprovados',
  KYC_REJECTED: 'Documentos recusados',
  SKILL_ADDED: 'Habilidade adicionada',
  ACCOUNT_DELETED: 'Conta excluída',
  ACCOUNT_DELETION_REQUESTED: 'Pediu exclusão da conta',
  ACCOUNT_DELETION_UNDONE: 'Desistiu da exclusão',
  USER_SUSPENDED: 'Conta suspensa',
  USER_REACTIVATED: 'Conta reativada',
  USER_BANNED: 'Conta banida',
  CPF_RELEASED: 'CPF liberado pelo admin',
  PIX_KEY_CHANGED: 'Chave Pix alterada',
  ORDER_CREATED: 'Pedido criado',
  ORDER_EDITED: 'Pedido editado',
  ORDER_DELETED: 'Pedido excluído pelo cliente',
  ORDER_HIDDEN: 'Pedido removido da lista',
  ORDER_CANCELLED: 'Pedido cancelado',
  ORDER_CANCELLED_BY_ADMIN: 'Pedido cancelado pelo suporte',
  PROPOSAL_CREATED: 'Proposta enviada',
  PROPOSAL_EDITED: 'Proposta ajustada',
  PROPOSAL_BOOSTED: 'Proposta destacada',
  PROPOSAL_REJECTED: 'Proposta recusada',
  PROPOSAL_WITHDRAWN: 'Proposta retirada',
  PROPOSAL_ACCEPTED: 'Proposta aceita',
  FEES_CREATED: 'Taxas de conexão geradas (valor do serviço)',
  FEE_CREATED: 'Taxa gerada',
  FEE_PAID: 'Taxa paga',
  FEE_EXPIRED: 'Taxa vencida (prestador não pagou)',
  FEE_CREDITED: 'Taxa devolvida como crédito',
  FEE_REFUNDED: 'Taxa estornada (banco)',
  FEE_REVERSED_BY_GATEWAY: 'Estorno/chargeback no Mercado Pago',
  FEE_CREDIT_REVERSED: 'Crédito da taxa estornado em dinheiro',
  CONTACT_UNLOCKED: 'Contato liberado às duas partes',
  SERVICE_CHECKIN: 'Check-in do prestador',
  SERVICE_COMPLETED_BY_PROVIDER: 'Prestador concluiu o serviço',
  SERVICE_CONFIRMED_BY_CLIENT: 'Cliente confirmou o serviço',
  SCHEDULE_CANCELLED_BY_CLIENT: 'Agendamento cancelado pelo cliente',
  SCHEDULE_CANCELLED_BY_PROVIDER: 'Agendamento cancelado pelo prestador',
  SCHEDULE_ARCHIVED: 'Agendamento arquivado (chat guardado)',
  NO_SHOW_REPORTED: 'Não comparecimento informado',
  RATING_CREATED: 'Avaliação',
  PAYMENT_PAID: 'Pagamento (legado) pago',
  PAYMENT_RELEASED: 'Pagamento (legado) liberado',
  PHOTO_ORDER: 'Foto do pedido',
  PHOTO_CHECKIN: 'Foto do check-in',
  PHOTO_COMPLETION: 'Foto da conclusão',
  BALANCE_CREDIT: 'Entrada no saldo',
  BALANCE_DEBIT: 'Saída do saldo',
  BALANCE_ADJUSTED_BY_ADMIN: 'Saldo ajustado pelo admin',
  CREDIT_ADDED: 'Crédito recebido',
  CREDIT_USED: 'Crédito usado',
  CREDIT_ADJUSTED_UP: 'Crédito adicionado pelo admin',
  CREDIT_ADJUSTED_DOWN: 'Crédito retirado pelo admin',
  WITHDRAWAL_REQUESTED: 'Saque solicitado',
  WITHDRAWAL_PAID: 'Saque pago',
  WITHDRAWAL_REJECTED: 'Saque rejeitado',
  PRO_GRANTED: 'Assinatura Pro ativada',
  PRO_REVOKED: 'Assinatura Pro encerrada',
  TICKET_CREATED: 'Abriu chamado no suporte',
  TICKET_REPLIED: 'Respondeu chamado',
  TICKET_REPLIED_BY_ADMIN: 'Suporte respondeu chamado',
  TICKET_STATUS_CHANGED: 'Status do chamado alterado',
  TICKET_ASSIGNED: 'Chamado atribuído',
  ADMIN_VIEWED_CHAT: 'Admin abriu o chat',
  ADMIN_EXPORTED_DOSSIER: 'Admin exportou dossiê',
  WEBHOOK_REPLAYED: 'Webhook reprocessado',
  SETTINGS_CHANGED: 'Configurações alteradas',
  ANNOUNCEMENT_CREATED: 'Aviso criado',
  ANNOUNCEMENT_PUSH_SENT: 'Push de aviso enviado',
  CATEGORY_MERGED: 'Categorias mescladas',
}

const MONEY = /^(FEE|BALANCE|CREDIT|WITHDRAWAL|PAYMENT|PRO_)/
const ALERT = /(BANNED|SUSPENDED|REVERSED|NO_SHOW|LOGIN_FAIL|CANCELLED|EXPIRED|REJECTED|DELETED)/

export function eventLabel(type: string) {
  return EVENT_LABEL[type] ?? type.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())
}

function dotColor(type: string) {
  if (ALERT.test(type)) return 'bg-red-500'
  if (MONEY.test(type)) return 'bg-emerald-500'
  if (type.startsWith('ADMIN') || type.startsWith('TICKET')) return 'bg-amber-500'
  return 'bg-slate2-400'
}

const FILTERS = [
  { key: 'all', label: 'Tudo' },
  { key: 'money', label: 'Dinheiro', test: (t: string) => MONEY.test(t) },
  { key: 'service', label: 'Pedido/serviço', test: (t: string) => /^(ORDER|PROPOSAL|SERVICE|SCHEDULE|RATING|PHOTO|NO_SHOW|CONTACT)/.test(t) },
  { key: 'account', label: 'Conta', test: (t: string) => /^(USER|KYC|PROFILE|PASSWORD|ACCOUNT|CPF|SKILL|TERMS|PIX|LOGIN|REGISTER)/.test(t) },
  { key: 'support', label: 'Suporte/admin', test: (t: string) => /^(TICKET|ADMIN|WEBHOOK|SETTINGS|ANNOUNCEMENT|CATEGORY)/.test(t) },
]

function Json({ value }: { value: unknown }) {
  if (value === null || value === undefined) return null
  return <pre className="text-[11px] bg-slate2-50 border border-slate2-200 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">{JSON.stringify(value, null, 2)}</pre>
}

export function Timeline({ items, people, auditStartedAt, focusUserId }: {
  items: TimelineItem[]
  people: People
  auditStartedAt?: string
  focusUserId?: string
}) {
  const [filter, setFilter] = useState('all')
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const shown = useMemo(() => {
    const f = FILTERS.find((x) => x.key === filter)
    return f?.test ? items.filter((i) => f.test!(i.type)) : items
  }, [items, filter])

  const who = (id: string | null) => {
    if (!id) return null
    const p = people[id]
    const label = p ? p.name : id.slice(0, 8)
    if (id === focusUserId) return <span className="font-medium">{label}</span>
    return <Link href={`/admin/usuarios/${id}`} className="font-medium text-brand-700 hover:underline">{label}</Link>
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button key={f.key} type="button" onClick={() => setFilter(f.key)}
            className={`text-xs px-3 py-1.5 rounded-full border ${filter === f.key ? 'bg-slate2-900 text-white border-slate2-900' : 'border-slate2-300 text-slate2-600'}`}>
            {f.label}
          </button>
        ))}
        <span className="text-xs text-slate2-400 self-center ml-auto">{shown.length} evento(s)</span>
      </div>
      {auditStartedAt && (
        <p className="text-[11px] text-slate2-500 flex items-center gap-1">
          <History className="w-3.5 h-3.5" /> Antes de {formatDateTime(auditStartedAt)} os eventos vêm do histórico das tabelas (sem IP/aparelho).
        </p>
      )}
      {shown.length === 0 && <p className="text-sm text-slate2-500 py-6 text-center">Nenhum evento.</p>}
      <ol className="relative border-l border-slate2-200 ml-2">
        {shown.map((i) => {
          const isOpen = !!open[i.id]
          const hasDetails = i.before != null || i.after != null || i.metadata != null || i.ip || i.device_id
          return (
            <li key={i.id} className="ml-4 pb-3">
              <span className={`absolute -left-[5px] mt-1.5 w-2.5 h-2.5 rounded-full ${dotColor(i.type)}`} />
              <button type="button" onClick={() => hasDetails && setOpen((o) => ({ ...o, [i.id]: !isOpen }))}
                className="w-full text-left">
                <div className="flex items-start gap-2 flex-wrap">
                  <span className="text-sm font-medium text-slate2-900">{eventLabel(i.type)}</span>
                  {i.amount != null && (
                    <span className={`text-xs font-semibold ${i.amount < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{formatCurrency(i.amount)}</span>
                  )}
                  {i.source === 'audit'
                    ? <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 mt-0.5" aria-label="registro de auditoria" />
                    : <History className="w-3.5 h-3.5 text-slate2-400 mt-0.5" aria-label="histórico" />}
                  {hasDetails && (isOpen ? <ChevronDown className="w-4 h-4 text-slate2-400 ml-auto" /> : <ChevronRight className="w-4 h-4 text-slate2-400 ml-auto" />)}
                </div>
              </button>
              <p className="text-xs text-slate2-500 mt-0.5">
                {formatDateTime(i.at)}
                {i.actor_id ? <> · por {who(i.actor_id)}{i.actor_role ? ` (${i.actor_role})` : ''}</> : i.actor_role ? ` · ${i.actor_role === 'SYSTEM' ? 'sistema' : i.actor_role === 'WEBHOOK' ? 'gateway' : i.actor_role}` : ''}
                {i.user_id && i.user_id !== i.actor_id && <> · titular {who(i.user_id)}</>}
                {i.counterpart_id && <> · com {who(i.counterpart_id)}</>}
                {i.order_id && <> · <Link href={`/admin/pedidos/${i.order_id}`} className="text-brand-700 hover:underline">pedido {i.order_id.slice(0, 8)}</Link></>}
              </p>
              {i.reason && <p className="text-xs text-slate2-700 mt-0.5">Motivo: {i.reason}</p>}
              {isOpen && (
                <div className="mt-2 space-y-1.5">
                  {(i.ip || i.device_id || i.app_version) && (
                    <p className="text-[11px] text-slate2-500">
                      {i.ip && <>IP {i.ip} · </>}{i.device_id && <>aparelho {i.device_id.slice(0, 8)} · </>}{i.app_version && <>versão {i.app_version} · </>}
                      {i.request_id && <>req {i.request_id.slice(0, 8)}</>}
                    </p>
                  )}
                  {i.before != null && <div><p className="text-[11px] text-slate2-500">Antes</p><Json value={i.before} /></div>}
                  {i.after != null && <div><p className="text-[11px] text-slate2-500">Depois</p><Json value={i.after} /></div>}
                  {i.metadata != null && <div><p className="text-[11px] text-slate2-500">Detalhes</p><Json value={i.metadata} /></div>}
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
