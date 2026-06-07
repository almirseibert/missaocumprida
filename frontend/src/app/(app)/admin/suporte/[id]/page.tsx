'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { ArrowLeft, Send, ShieldCheck, Mail, Phone, User as UserIcon } from 'lucide-react'
import { api, getApiErrorMessage } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { PageSpinner } from '@/components/ui/Spinner'
import { formatRelative } from '@/lib/utils'

type Status = 'OPEN' | 'IN_PROGRESS' | 'WAITING_USER' | 'RESOLVED' | 'CLOSED'

interface Message {
  id: string
  content: string
  from_admin: boolean
  created_at: string
  sender?: { id: string; name: string; avatar?: string; role: string }
}
interface Ticket {
  id: string
  subject: string
  category: string
  status: Status
  contact_email?: string
  contact_phone?: string
  reporter_role?: string
  created_at: string
  user: { id: string; name: string; email: string; phone?: string; avatar?: string; role: string }
  messages: Message[]
  assignee?: { id: string; name: string } | null
}

const STATUS_OPTIONS: Status[] = ['OPEN', 'IN_PROGRESS', 'WAITING_USER', 'RESOLVED', 'CLOSED']

export default function AdminTicketDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user } = useAuthStore()
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [loading, setLoading] = useState(true)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  useEffect(() => {
    if (user && user.role !== 'ADMIN') router.replace('/home')
  }, [user, router])

  const load = async () => {
    try {
      const r = await api.get(`/support/${id}`)
      setTicket(r.data.data)
    } catch (err) {
      toast.error(getApiErrorMessage(err))
      router.push('/admin/suporte')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id])

  const send = async () => {
    if (reply.trim().length === 0) return
    setSending(true)
    try {
      await api.post(`/support/${id}/reply`, { content: reply.trim() })
      setReply('')
      await load()
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setSending(false)
    }
  }

  const changeStatus = async (status: Status) => {
    setUpdatingStatus(true)
    try {
      await api.patch(`/support/admin/${id}/status`, { status })
      toast.success('Status atualizado')
      await load()
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setUpdatingStatus(false)
    }
  }

  const assignToMe = async () => {
    setUpdatingStatus(true)
    try {
      await api.patch(`/support/admin/${id}/assign`, { assignee_id: user?.id ?? null })
      toast.success('Atribuído a você')
      await load()
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setUpdatingStatus(false)
    }
  }

  if (loading || !ticket || !user) return <PageSpinner />
  if (user.role !== 'ADMIN') return null

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-slate2-600 hover:text-slate2-900">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>

      <div className="bg-white border border-slate2-200 rounded-2xl p-5 space-y-3">
        <h1 className="font-semibold text-slate2-900 text-lg">{ticket.subject}</h1>
        <div className="flex items-start gap-3 pt-2 border-t border-slate2-100">
          <Avatar name={ticket.user.name} avatar={ticket.user.avatar} size="md" />
          <div className="flex-1 text-sm">
            <p className="font-medium text-slate2-900">{ticket.user.name} <span className="text-xs text-slate2-500">({ticket.reporter_role ?? ticket.user.role})</span></p>
            <p className="text-xs text-slate2-500 flex items-center gap-1"><Mail className="w-3 h-3" /> {ticket.contact_email || ticket.user.email}</p>
            {(ticket.contact_phone || ticket.user.phone) && (
              <p className="text-xs text-slate2-500 flex items-center gap-1"><Phone className="w-3 h-3" /> {ticket.contact_phone || ticket.user.phone}</p>
            )}
            <p className="text-xs text-slate2-400 mt-1">Aberto {formatRelative(ticket.created_at)} · Categoria: {ticket.category}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate2-100">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => changeStatus(s)}
              disabled={updatingStatus || ticket.status === s}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${ticket.status === s ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-slate2-700 border-slate2-200 hover:border-brand-300 disabled:opacity-50'}`}
            >
              {s}
            </button>
          ))}
          {(!ticket.assignee || ticket.assignee.id !== user.id) && (
            <button
              onClick={assignToMe}
              disabled={updatingStatus}
              className="px-3 py-1 rounded-full text-xs font-medium border border-slate2-200 bg-white text-slate2-700 hover:border-brand-300 flex items-center gap-1"
            >
              <UserIcon className="w-3 h-3" /> Atribuir a mim
            </button>
          )}
          {ticket.assignee && <span className="text-xs text-slate2-500 self-center">Responsável: {ticket.assignee.name}</span>}
        </div>
      </div>

      <div className="space-y-3">
        {ticket.messages.map((m) => (
          <div key={m.id} className={`flex gap-3 ${m.from_admin ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className="flex-shrink-0">
              {m.from_admin ? (
                <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
              ) : (
                <Avatar name={m.sender?.name ?? 'U'} avatar={m.sender?.avatar} size="sm" />
              )}
            </div>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${m.from_admin ? 'bg-brand-50 border border-brand-100' : 'bg-white border border-slate2-200'}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-slate2-700">
                  {m.from_admin ? `Equipe — ${m.sender?.name ?? 'admin'}` : (m.sender?.name ?? 'Usuário')}
                </span>
                <span className="text-[10px] text-slate2-400">{formatRelative(m.created_at)}</span>
              </div>
              <p className="text-sm text-slate2-800 whitespace-pre-wrap break-words">{m.content}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-slate2-200 rounded-2xl p-4 space-y-3">
        <Textarea
          placeholder="Resposta da equipe…"
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          rows={4}
        />
        <Button onClick={send} isLoading={sending} disabled={reply.trim().length === 0}>
          <Send className="w-4 h-4" /> Enviar resposta
        </Button>
      </div>
    </div>
  )
}
