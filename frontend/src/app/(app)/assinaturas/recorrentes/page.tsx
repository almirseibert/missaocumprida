'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Repeat, Pause, Play, X, SkipForward, Calendar } from 'lucide-react'
import { api, getApiErrorMessage } from '@/lib/api'
import { PageSpinner } from '@/components/ui/Spinner'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { toast } from 'react-hot-toast'

type Subscription = {
  id: string
  frequency: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY'
  weekday: number | null
  day_of_month: number | null
  time_slot: string
  base_value: number
  discount_pct: number
  status: 'ACTIVE' | 'PAUSED' | 'CANCELLED'
  next_occurrence: string
  title: string
  city: string
  provider: { id: string; name: string; avatar: string | null; rating_avg: number }
  category: { name: string; icon: string }
}

const FREQ_LABEL = { WEEKLY: 'Semanal', BIWEEKLY: 'Quinzenal', MONTHLY: 'Mensal' } as const
const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export default function AssinaturasPage() {
  const [subs, setSubs] = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<'client' | 'provider'>('client')

  useEffect(() => {
    load()
  }, [role])

  async function load() {
    setLoading(true)
    try {
      const res = await api.get(`/subscriptions?role=${role}`)
      setSubs(res.data.data || [])
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  async function patch(id: string, body: any) {
    try {
      await api.patch(`/subscriptions/${id}`, body)
      await load()
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    }
  }

  async function cancel(id: string) {
    if (!confirm('Cancelar esta assinatura? Ocorrências futuras não serão geradas.')) return
    try {
      await api.delete(`/subscriptions/${id}`)
      await load()
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    }
  }

  async function skipNext(id: string) {
    try {
      await api.post(`/subscriptions/${id}/skip-next`, {})
      toast.success('Próxima ocorrência pulada')
      await load()
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    }
  }

  if (loading) return <PageSpinner />

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Repeat className="w-6 h-6 text-brand-700" /> Assinaturas
        </h1>
        <div className="flex items-center gap-2">
          <div className="bg-slate2-100 rounded-xl p-1 flex">
            <button onClick={() => setRole('client')} className={`px-3 py-1.5 rounded-lg text-sm ${role === 'client' ? 'bg-white shadow' : ''}`}>Como cliente</button>
            <button onClick={() => setRole('provider')} className={`px-3 py-1.5 rounded-lg text-sm ${role === 'provider' ? 'bg-white shadow' : ''}`}>Como prestador</button>
          </div>
          {role === 'client' && (
            <Link href="/assinaturas/nova" className="bg-brand-700 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-brand-800">
              + Nova
            </Link>
          )}
        </div>
      </div>

      {subs.length === 0 ? (
        <Card className="p-8 text-center">
          <Repeat className="w-12 h-12 text-slate2-400 mx-auto mb-3" />
          <p className="text-slate2-600">Nenhuma assinatura {role === 'client' ? 'contratada' : 'recebida'} ainda.</p>
          {role === 'client' && (
            <Link href="/home" className="text-brand-700 underline text-sm mt-2 inline-block">
              Contratar um serviço recorrente
            </Link>
          )}
        </Card>
      ) : (
        subs.map((sub) => {
          const finalPrice = sub.base_value * (1 - sub.discount_pct)
          return (
            <Card key={sub.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="font-semibold text-slate2-900">{sub.title}</h2>
                    {sub.status === 'PAUSED' && <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Pausada</span>}
                    {sub.status === 'CANCELLED' && <span className="text-[10px] bg-slate2-200 text-slate2-600 px-2 py-0.5 rounded-full">Cancelada</span>}
                  </div>
                  <p className="text-xs text-slate2-500">{sub.category.name} · {sub.city}</p>
                  <div className="text-sm text-slate2-700 mt-2 space-y-1">
                    <div>📅 {FREQ_LABEL[sub.frequency]}{sub.weekday != null ? ` · ${WEEKDAYS[sub.weekday]}` : sub.day_of_month != null ? ` · dia ${sub.day_of_month}` : ''} às {sub.time_slot}</div>
                    <div>💰 R$ {finalPrice.toFixed(2)} por ocorrência <span className="text-emerald-600 text-xs">(-{(sub.discount_pct * 100).toFixed(0)}%)</span></div>
                    <div className="text-xs text-slate2-500"><Calendar className="w-3 h-3 inline" /> Próxima: {new Date(sub.next_occurrence).toLocaleDateString('pt-BR')} às {new Date(sub.next_occurrence).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                </div>
              </div>
              {sub.status !== 'CANCELLED' && (
                <div className="flex gap-2 mt-3 pt-3 border-t flex-wrap">
                  {sub.status === 'ACTIVE' ? (
                    <Button variant="ghost" onClick={() => patch(sub.id, { status: 'PAUSED' })}>
                      <Pause className="w-4 h-4" /> Pausar
                    </Button>
                  ) : (
                    <Button variant="ghost" onClick={() => patch(sub.id, { status: 'ACTIVE' })}>
                      <Play className="w-4 h-4" /> Retomar
                    </Button>
                  )}
                  {role === 'client' && sub.status === 'ACTIVE' && (
                    <Button variant="ghost" onClick={() => skipNext(sub.id)}>
                      <SkipForward className="w-4 h-4" /> Pular próxima
                    </Button>
                  )}
                  <Button variant="ghost" onClick={() => cancel(sub.id)} className="text-rose-600 ml-auto">
                    <X className="w-4 h-4" /> Cancelar
                  </Button>
                </div>
              )}
            </Card>
          )
        })
      )}
    </div>
  )
}
