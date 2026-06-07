'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { ArrowLeft, Send, ShieldCheck } from 'lucide-react'
import { api, getApiErrorMessage } from '@/lib/api'
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
  created_at: string
  messages: Message[]
  assignee?: { id: string; name: string; avatar?: string } | null
}

const STATUS_LABEL: Record<Status, string> = {
  OPEN: 'Aberto',
  IN_PROGRESS: 'Em andamento',
  WAITING_USER: 'Aguardando você',
  RESOLVED: 'Resolvido',
  CLOSED: 'Fechado',
}

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [loading, setLoading] = useState(true)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)

  const load = async () => {
    try {
      const r = await api.get(`/support/${id}`)
      setTicket(r.data.data)
    } catch (err) {
      toast.error(getApiErrorMessage(err))
      router.push('/suporte')
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

  if (loading || !ticket) return <PageSpinner />

  const closed = ticket.status === 'CLOSED'

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-slate2-600 hover:text-slate2-900">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>

      <div className="bg-white border border-slate2-200 rounded-2xl p-5">
        <h1 className="font-semibold text-slate2-900">{ticket.subject}</h1>
        <p className="text-xs text-slate2-500 mt-1">Status: {STATUS_LABEL[ticket.status]} · Aberto em {formatRelative(ticket.created_at)}</p>
      </div>

      <div className="space-y-3">
        {ticket.messages.map((m) => (
          <div key={m.id} className={`flex gap-3 ${m.from_admin ? 'flex-row' : 'flex-row-reverse'}`}>
            <div className="flex-shrink-0">
              {m.from_admin ? (
                <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
              ) : (
                <Avatar name={m.sender?.name ?? 'Você'} avatar={m.sender?.avatar} size="sm" />
              )}
            </div>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${m.from_admin ? 'bg-brand-50 border border-brand-100' : 'bg-white border border-slate2-200'}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-slate2-700">
                  {m.from_admin ? 'Equipe Missão Cumprida' : (m.sender?.name ?? 'Você')}
                </span>
                <span className="text-[10px] text-slate2-400">{formatRelative(m.created_at)}</span>
              </div>
              <p className="text-sm text-slate2-800 whitespace-pre-wrap break-words">{m.content}</p>
            </div>
          </div>
        ))}
      </div>

      {closed ? (
        <p className="text-sm text-slate2-500 text-center py-4 bg-slate2-50 rounded-2xl">
          Este ticket foi fechado. Abra uma nova solicitação se precisar.
        </p>
      ) : (
        <div className="bg-white border border-slate2-200 rounded-2xl p-4 space-y-3">
          <Textarea
            placeholder="Escreva sua resposta..."
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={3}
          />
          <Button onClick={send} isLoading={sending} disabled={reply.trim().length === 0}>
            <Send className="w-4 h-4" /> Enviar
          </Button>
        </div>
      )}
    </div>
  )
}
