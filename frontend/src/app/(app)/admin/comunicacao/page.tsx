'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { Send, Megaphone, LifeBuoy, ChevronRight, MonitorSmartphone, Trash2 } from 'lucide-react'
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

const ANN_AUDIENCES = [
  { v: 'ALL', l: 'Todos os usuários' },
  { v: 'CLIENTS', l: 'Clientes' },
  { v: 'PROVIDERS', l: 'Prestadores' },
]

type Announcement = {
  id: string
  title: string
  body: string
  type: 'POPUP' | 'BANNER'
  audience: string
  is_active: boolean
  push_sent_at: string | null
  created_at: string
}

export default function AdminComunicacaoPage() {
  const { user } = useAuthStore()
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [audience, setAudience] = useState('ALL')
  const [busy, setBusy] = useState(false)

  // ---- Avisos no app (pop-up/banner) ----
  const [annTitle, setAnnTitle] = useState('')
  const [annBody, setAnnBody] = useState('')
  const [annType, setAnnType] = useState<'POPUP' | 'BANNER'>('POPUP')
  const [annAudience, setAnnAudience] = useState('ALL')
  const [annPush, setAnnPush] = useState(true)
  const [annBusy, setAnnBusy] = useState(false)
  const [announcements, setAnnouncements] = useState<Announcement[]>([])

  const loadAnnouncements = useCallback(() => {
    api.get('/announcements/admin')
      .then((r) => setAnnouncements(r.data.data ?? []))
      .catch(() => {})
  }, [])

  useEffect(() => { if (user && user.role !== 'ADMIN') router.replace('/home') }, [user, router])
  useEffect(() => { if (user?.role === 'ADMIN') loadAnnouncements() }, [user, loadAnnouncements])
  if (!user) return <PageSpinner />
  if (user.role !== 'ADMIN') return null

  const createAnnouncement = async () => {
    if (!annTitle.trim() || !annBody.trim()) return toast.error('Preencha título e mensagem do aviso.')
    setAnnBusy(true)
    try {
      await api.post('/announcements/admin', {
        title: annTitle, body: annBody, type: annType, audience: annAudience, send_push: annPush,
      })
      toast.success(annPush ? 'Aviso criado e push enviado!' : 'Aviso criado!')
      setAnnTitle(''); setAnnBody('')
      loadAnnouncements()
    } catch (e) { toast.error(getApiErrorMessage(e)) } finally { setAnnBusy(false) }
  }

  const deactivateAnnouncement = async (id: string) => {
    if (!confirm('Desativar este aviso? Ele some dos apps imediatamente.')) return
    try {
      await api.delete(`/announcements/admin/${id}`)
      loadAnnouncements()
    } catch (e) { toast.error(getApiErrorMessage(e)) }
  }

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

      {/* Avisos no app (pop-up/banner + push) */}
      <div className="bg-white border border-slate2-200 rounded-2xl p-5 space-y-3 max-w-2xl">
        <h2 className="font-semibold text-slate2-800 flex items-center gap-2">
          <MonitorSmartphone className="w-4 h-4 text-accent-600" /> Aviso no app (pop-up/banner)
        </h2>
        <p className="text-xs text-slate2-500 -mt-1">
          Pop-up aparece uma vez ao abrir o app; banner fica fixo na home enquanto ativo.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-slate2-700">Formato</label>
            <select value={annType} onChange={(e) => setAnnType(e.target.value as 'POPUP' | 'BANNER')}
              className="mt-1 block w-full rounded-lg border-[1.5px] border-slate2-300 px-3 py-2.5 text-sm">
              <option value="POPUP">Pop-up (modal)</option>
              <option value="BANNER">Banner (faixa na home)</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate2-700">Público-alvo</label>
            <select value={annAudience} onChange={(e) => setAnnAudience(e.target.value)}
              className="mt-1 block w-full rounded-lg border-[1.5px] border-slate2-300 px-3 py-2.5 text-sm">
              {ANN_AUDIENCES.map((a) => <option key={a.v} value={a.v}>{a.l}</option>)}
            </select>
          </div>
        </div>
        <Input label="Título" value={annTitle} onChange={(e) => setAnnTitle(e.target.value)} maxLength={80} placeholder="Ex: Promoção de lançamento — taxa de 5%!" />
        <Textarea label="Mensagem" value={annBody} onChange={(e) => setAnnBody(e.target.value)} rows={3} maxLength={500} placeholder="Conteúdo do aviso…" />
        <label className="flex items-center gap-2 text-sm text-slate2-700">
          <input type="checkbox" checked={annPush} onChange={(e) => setAnnPush(e.target.checked)} className="rounded" />
          Enviar push para a audiência também
        </label>
        <Button isLoading={annBusy} onClick={createAnnouncement}>
          <Megaphone className="w-4 h-4 mr-1" /> Publicar aviso
        </Button>

        {announcements.length > 0 && (
          <div className="border-t border-slate2-100 pt-3 space-y-2">
            <p className="text-xs font-semibold text-slate2-500 uppercase tracking-wide">Últimos avisos</p>
            {announcements.slice(0, 8).map((a) => (
              <div key={a.id} className="flex items-center gap-2 text-sm">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${a.type === 'POPUP' ? 'bg-violet-50 text-violet-700' : 'bg-amber-50 text-amber-700'}`}>
                  {a.type === 'POPUP' ? 'Pop-up' : 'Banner'}
                </span>
                <span className={`flex-1 truncate ${a.is_active ? 'text-slate2-800' : 'text-slate2-400 line-through'}`}>
                  {a.title}
                </span>
                {a.push_sent_at && <span className="text-[10px] text-slate2-400">push ✓</span>}
                {a.is_active && (
                  <button onClick={() => deactivateAnnouncement(a.id)} className="text-slate2-400 hover:text-rose-600">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
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
