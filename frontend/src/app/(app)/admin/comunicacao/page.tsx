'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { Send, Megaphone, LifeBuoy, ChevronRight } from 'lucide-react'
import { api, getApiErrorMessage } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { PageSpinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'

const AUDIENCES = [
  { v: 'ALL', l: 'Todos os usuários' },
  { v: 'CLIENT', l: 'Clientes' },
  { v: 'PROVIDER', l: 'Prestadores' },
]

export default function AdminComunicacaoPage() {
  const { user } = useAuthStore()
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [audience, setAudience] = useState('ALL')
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (user && user.role !== 'ADMIN') router.replace('/home') }, [user, router])
  if (!user) return <PageSpinner />
  if (user.role !== 'ADMIN') return null

  const send = async () => {
    if (!title.trim() || !body.trim()) return toast.error('Preencha título e mensagem.')
    const label = AUDIENCES.find((a) => a.v === audience)?.l
    if (!confirm(`Enviar este comunicado para: ${label}?`)) return
    setBusy(true)
    try {
      const res = await api.post('/notifications/admin/broadcast', { title, body, audience })
      toast.success(res.data.message || 'Comunicado enviado')
      setTitle(''); setBody('')
    } catch (e) { toast.error(getApiErrorMessage(e)) } finally { setBusy(false) }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate2-900">Comunicação & Suporte</h1>
        <p className="text-sm text-slate2-600 mt-1">Envie comunicados e acompanhe o suporte.</p>
      </div>

      {/* Composer de broadcast */}
      <div className="bg-white border border-slate2-200 rounded-2xl p-5 space-y-3 max-w-2xl">
        <h2 className="font-semibold text-slate2-800 flex items-center gap-2"><Megaphone className="w-4 h-4 text-brand-600" /> Novo comunicado</h2>
        <div>
          <label className="text-sm font-medium text-slate2-700">Público-alvo</label>
          <select value={audience} onChange={(e) => setAudience(e.target.value)}
            className="mt-1 block w-full rounded-lg border-[1.5px] border-slate2-300 px-3 py-2.5 text-sm">
            {AUDIENCES.map((a) => <option key={a.v} value={a.v}>{a.l}</option>)}
          </select>
        </div>
        <Input label="Título" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Ex: Manutenção programada" />
        <Textarea label="Mensagem" value={body} onChange={(e) => setBody(e.target.value)} rows={4} maxLength={1000} placeholder="Conteúdo do comunicado…" />
        <Button isLoading={busy} onClick={send}><Send className="w-4 h-4 mr-1" /> Enviar comunicado</Button>
        <p className="text-[11px] text-slate2-400">Cria uma notificação no app para cada usuário e dispara push (quando habilitado).</p>
      </div>

      {/* Atalho para suporte */}
      <Link href="/admin/suporte"
        className="bg-white border border-slate2-200 rounded-2xl p-5 hover:border-brand-300 hover:shadow-sm transition-all flex items-center gap-3 max-w-2xl">
        <div className="w-10 h-10 rounded-full bg-brand-50 flex items-center justify-center text-brand-600 flex-shrink-0">
          <LifeBuoy className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-slate2-900">Tickets de suporte</h3>
          <p className="text-xs text-slate2-500 mt-0.5">Receber, tratar e responder mensagens de clientes e prestadores</p>
        </div>
        <ChevronRight className="w-4 h-4 text-slate2-400" />
      </Link>
    </div>
  )
}
