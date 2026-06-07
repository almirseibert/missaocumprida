'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { LifeBuoy, Plus, ChevronRight, MessageCircle } from 'lucide-react'
import { api, getApiErrorMessage } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { PageSpinner } from '@/components/ui/Spinner'
import { formatRelative } from '@/lib/utils'

type Category = 'PROBLEM' | 'IMPROVEMENT' | 'QUESTION' | 'PAYMENT' | 'ACCOUNT' | 'OTHER'
type Status = 'OPEN' | 'IN_PROGRESS' | 'WAITING_USER' | 'RESOLVED' | 'CLOSED'

interface Ticket {
  id: string
  subject: string
  category: Category
  status: Status
  unread_for_user: boolean
  created_at: string
  updated_at: string
  _count?: { messages: number }
}

const CATEGORY_LABEL: Record<Category, string> = {
  PROBLEM: 'Problema',
  IMPROVEMENT: 'Sugestão de melhoria',
  QUESTION: 'Dúvida',
  PAYMENT: 'Pagamento',
  ACCOUNT: 'Minha conta',
  OTHER: 'Outro assunto',
}

const STATUS_LABEL: Record<Status, string> = {
  OPEN: 'Aberto',
  IN_PROGRESS: 'Em andamento',
  WAITING_USER: 'Aguardando você',
  RESOLVED: 'Resolvido',
  CLOSED: 'Fechado',
}

const STATUS_COLOR: Record<Status, string> = {
  OPEN: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  WAITING_USER: 'bg-purple-100 text-purple-700',
  RESOLVED: 'bg-emerald-100 text-emerald-700',
  CLOSED: 'bg-slate2-200 text-slate2-600',
}

export default function SuportePage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showForm, setShowForm] = useState(false)

  const [subject, setSubject] = useState('')
  const [category, setCategory] = useState<Category>('OTHER')
  const [message, setMessage] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const r = await api.get('/support/mine')
      setTickets(r.data.data ?? [])
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (subject.trim().length < 3) return toast.error('Resuma o assunto em pelo menos 3 caracteres.')
    if (message.trim().length < 10) return toast.error('Descreva sua solicitação com mais detalhes (mín. 10 caracteres).')
    setCreating(true)
    try {
      await api.post('/support', {
        subject: subject.trim(),
        category,
        message: message.trim(),
        contact_email: contactEmail.trim() || undefined,
        contact_phone: contactPhone.trim() || undefined,
      })
      toast.success('Sua mensagem foi enviada à equipe Missão Cumprida!')
      setShowForm(false)
      setSubject(''); setCategory('OTHER'); setMessage(''); setContactEmail(''); setContactPhone('')
      load()
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setCreating(false)
    }
  }

  if (loading) return <PageSpinner />

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-brand-50 flex items-center justify-center text-brand-600 flex-shrink-0">
          <LifeBuoy className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate2-900">Falar com a equipe</h1>
          <p className="text-sm text-slate2-600 mt-1">
            Reporte problemas, sugira melhorias ou tire dúvidas — a equipe do Missão Cumprida responde por aqui.
          </p>
        </div>
      </div>

      {!showForm && (
        <Button onClick={() => setShowForm(true)} className="w-full sm:w-auto">
          <Plus className="w-4 h-4" /> Nova solicitação
        </Button>
      )}

      {showForm && (
        <form onSubmit={submit} className="bg-white border border-slate2-200 rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold text-slate2-900">Conte para a gente</h2>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate2-700">Tipo de assunto</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
              className="block w-full rounded-lg border border-slate2-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {(Object.entries(CATEGORY_LABEL) as [Category, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          <Input
            label="Assunto"
            placeholder="Resuma em uma frase"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={140}
          />

          <Textarea
            label="Descrição"
            placeholder="Descreva com detalhes o que aconteceu, o que esperava e como podemos te ajudar..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={6}
          />

          <div className="grid sm:grid-cols-2 gap-3">
            <Input
              label="Email para resposta (opcional)"
              type="email"
              placeholder="Use outro email se preferir"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
            />
            <Input
              label="Telefone (opcional)"
              placeholder="(11) 99999-9999"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
            />
          </div>

          <div className="flex gap-3">
            <Button type="submit" isLoading={creating}>Enviar</Button>
            <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        <h2 className="font-semibold text-slate2-900">Minhas solicitações</h2>
        {tickets.length === 0 ? (
          <p className="text-sm text-slate2-500 text-center py-8 bg-white border border-slate2-200 rounded-2xl">
            Você ainda não enviou nenhuma solicitação.
          </p>
        ) : (
          tickets.map((t) => (
            <Link
              key={t.id}
              href={`/suporte/${t.id}`}
              className="block bg-white border border-slate2-200 rounded-2xl p-4 hover:border-brand-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-slate2-100 text-slate2-500 flex items-center justify-center flex-shrink-0">
                  <MessageCircle className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-slate2-900 truncate">{t.subject}</p>
                    {t.unread_for_user && <span className="w-2 h-2 rounded-full bg-brand-500" />}
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[t.status]}`}>
                      {STATUS_LABEL[t.status]}
                    </span>
                    <span className="text-xs text-slate2-500">{CATEGORY_LABEL[t.category]}</span>
                    <span className="text-xs text-slate2-400">· atualizado {formatRelative(t.updated_at)}</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate2-400 mt-2" />
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
