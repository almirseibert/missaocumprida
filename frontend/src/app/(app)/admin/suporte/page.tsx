'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { ChevronRight, LifeBuoy, Search } from 'lucide-react'
import { api, getApiErrorMessage } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { Avatar } from '@/components/ui/Avatar'
import { PageSpinner } from '@/components/ui/Spinner'
import { formatRelative } from '@/lib/utils'

type Status = 'OPEN' | 'IN_PROGRESS' | 'WAITING_USER' | 'RESOLVED' | 'CLOSED'

interface Ticket {
  id: string
  subject: string
  category: string
  status: Status
  unread_for_admin: boolean
  created_at: string
  updated_at: string
  user: { id: string; name: string; email: string; avatar?: string; role: string }
  assignee?: { id: string; name: string } | null
  _count?: { messages: number }
}

const STATUS_LABEL: Record<Status, string> = {
  OPEN: 'Abertos',
  IN_PROGRESS: 'Em andamento',
  WAITING_USER: 'Aguardando usuário',
  RESOLVED: 'Resolvidos',
  CLOSED: 'Fechados',
}

const STATUS_COLOR: Record<Status, string> = {
  OPEN: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  WAITING_USER: 'bg-purple-100 text-purple-700',
  RESOLVED: 'bg-emerald-100 text-emerald-700',
  CLOSED: 'bg-slate2-200 text-slate2-600',
}

export default function AdminSupportListPage() {
  const { user } = useAuthStore()
  const router = useRouter()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [summary, setSummary] = useState<Record<string, number>>({})
  const [status, setStatus] = useState<Status | ''>('OPEN')
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user && user.role !== 'ADMIN') router.replace('/home')
  }, [user, router])

  const load = async () => {
    setLoading(true)
    try {
      const r = await api.get('/support/admin/list', { params: { status: status || undefined, q: q || undefined } })
      setTickets(r.data.data.tickets)
      setSummary(r.data.data.summary)
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [status])

  if (!user) return <PageSpinner />
  if (user.role !== 'ADMIN') return null

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-brand-50 flex items-center justify-center text-brand-600">
          <LifeBuoy className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate2-900">Suporte ao usuário</h1>
          <p className="text-sm text-slate2-600 mt-1">Mensagens enviadas por clientes e prestadores.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['OPEN', 'IN_PROGRESS', 'WAITING_USER', 'RESOLVED', 'CLOSED'] as Status[]).map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border ${status === s ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-slate2-700 border-slate2-200 hover:border-brand-300'}`}
          >
            {STATUS_LABEL[s]} {summary[s] != null && <span className="opacity-70">({summary[s]})</span>}
          </button>
        ))}
        <button
          onClick={() => setStatus('')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border ${status === '' ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-slate2-700 border-slate2-200 hover:border-brand-300'}`}
        >
          Todos
        </button>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); load() }}
        className="flex items-center gap-2 bg-white border border-slate2-200 rounded-xl px-3 py-2"
      >
        <Search className="w-4 h-4 text-slate2-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por assunto, nome ou email…"
          className="flex-1 bg-transparent text-sm focus:outline-none"
        />
      </form>

      {loading ? (
        <PageSpinner />
      ) : tickets.length === 0 ? (
        <p className="text-sm text-slate2-500 text-center py-8 bg-white border border-slate2-200 rounded-2xl">
          Nenhum ticket encontrado.
        </p>
      ) : (
        <div className="space-y-2">
          {tickets.map((t) => (
            <Link
              key={t.id}
              href={`/admin/suporte/${t.id}`}
              className="flex items-start gap-3 bg-white border border-slate2-200 rounded-2xl p-4 hover:border-brand-300 hover:shadow-sm transition-all"
            >
              <Avatar name={t.user.name} avatar={t.user.avatar} size="md" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-slate2-900 truncate">{t.subject}</p>
                  {t.unread_for_admin && <span className="w-2 h-2 rounded-full bg-red-500" />}
                </div>
                <p className="text-xs text-slate2-600 mt-0.5 truncate">
                  {t.user.name} <span className="text-slate2-400">· {t.user.email}</span>
                </p>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[t.status]}`}>
                    {t.status}
                  </span>
                  <span className="text-[11px] text-slate2-500">{t.category}</span>
                  {t.assignee && <span className="text-[11px] text-slate2-500">→ {t.assignee.name}</span>}
                  <span className="text-[11px] text-slate2-400">· atualizado {formatRelative(t.updated_at)}</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate2-400 mt-2" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
