'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, Plus, Trash2, Save, CalendarDays, Ban } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PageSpinner } from '@/components/ui/Spinner'
import { api, getApiErrorMessage } from '@/lib/api'
import { toast } from 'react-hot-toast'

type Rule = { id?: string; weekday: number; start_time: string; end_time: string; slot_min: number; category_id: string | null }
type Exception = { id: string; date: string; blocked: boolean; start_time: string | null; end_time: string | null; note: string | null }

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export default function AgendaConfigPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [rules, setRules] = useState<Rule[]>([])
  const [exceptions, setExceptions] = useState<Exception[]>([])
  const [saving, setSaving] = useState(false)
  const [exDate, setExDate] = useState('')
  const [exNote, setExNote] = useState('')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await api.get('/users/me/availability')
      setRules(res.data.data.rules || [])
      setExceptions(res.data.data.exceptions || [])
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  function addRule() {
    setRules([...rules, { weekday: 1, start_time: '08:00', end_time: '17:00', slot_min: 60, category_id: null }])
  }

  function updateRule(idx: number, patch: Partial<Rule>) {
    setRules(rules.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }

  function removeRule(idx: number) {
    setRules(rules.filter((_, i) => i !== idx))
  }

  async function saveRules() {
    setSaving(true)
    try {
      await api.put('/users/me/availability', { rules })
      toast.success('Agenda salva!')
      await load()
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  async function addException() {
    if (!exDate) return toast.error('Selecione uma data')
    try {
      await api.post('/users/me/availability/exception', {
        date: exDate, blocked: true, note: exNote || undefined,
      })
      setExDate(''); setExNote('')
      await load()
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    }
  }

  async function removeException(id: string) {
    try {
      await api.delete(`/users/me/availability/exception/${id}`)
      await load()
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    }
  }

  if (loading) return <PageSpinner />

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <div className="flex items-center gap-2">
        <button onClick={() => router.back()} className="p-1">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold">Minha agenda</h1>
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-brand-700" /> Horários disponíveis
            </h2>
            <p className="text-sm text-slate2-600">Quando você está disponível para atender. Clientes verão estes slots no seu perfil público.</p>
          </div>
          <Button variant="ghost" onClick={addRule}><Plus className="w-4 h-4" /> Nova regra</Button>
        </div>
        {rules.length === 0 ? (
          <p className="text-sm text-slate2-500 italic text-center py-6">Nenhuma regra cadastrada. Adicione horários para começar.</p>
        ) : (
          <div className="space-y-3">
            {rules.map((r, idx) => (
              <div key={idx} className="flex items-center gap-2 flex-wrap p-3 bg-slate2-50 rounded-xl">
                <select
                  value={r.weekday}
                  onChange={(e) => updateRule(idx, { weekday: Number(e.target.value) })}
                  className="border border-slate2-200 rounded-lg px-2 py-1.5 text-sm bg-white"
                >
                  {WEEKDAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
                <Input
                  type="time"
                  value={r.start_time}
                  onChange={(e) => updateRule(idx, { start_time: e.target.value })}
                  className="w-28"
                />
                <span className="text-slate2-500">até</span>
                <Input
                  type="time"
                  value={r.end_time}
                  onChange={(e) => updateRule(idx, { end_time: e.target.value })}
                  className="w-28"
                />
                <div className="flex items-center gap-1">
                  <span className="text-xs text-slate2-600">slot</span>
                  <Input
                    type="number"
                    value={r.slot_min}
                    onChange={(e) => updateRule(idx, { slot_min: Number(e.target.value) })}
                    className="w-20"
                    min={15}
                    max={480}
                  />
                  <span className="text-xs text-slate2-600">min</span>
                </div>
                <button
                  onClick={() => removeRule(idx)}
                  className="ml-auto p-1.5 hover:bg-rose-50 rounded-lg text-rose-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="mt-4 pt-4 border-t flex justify-end">
          <Button onClick={saveRules} disabled={saving}>
            <Save className="w-4 h-4" /> {saving ? 'Salvando...' : 'Salvar regras'}
          </Button>
        </div>
      </Card>

      <Card className="p-5">
        <div className="mb-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Ban className="w-5 h-5 text-rose-600" /> Dias bloqueados
          </h2>
          <p className="text-sm text-slate2-600">Bloqueie datas específicas (folgas, viagens, etc.)</p>
        </div>
        <div className="flex gap-2 flex-wrap items-end">
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs text-slate2-600">Data</label>
            <Input type="date" value={exDate} onChange={(e) => setExDate(e.target.value)} />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-slate2-600">Observação (opcional)</label>
            <Input value={exNote} onChange={(e) => setExNote(e.target.value)} placeholder="Ex: feriado" />
          </div>
          <Button onClick={addException}><Plus className="w-4 h-4" /> Bloquear</Button>
        </div>
        {exceptions.length > 0 && (
          <div className="mt-4 space-y-2">
            {exceptions.map((e) => (
              <div key={e.id} className="flex items-center justify-between p-3 bg-rose-50 rounded-xl">
                <div className="text-sm">
                  <span className="font-medium">{e.date.slice(0, 10).split('-').reverse().join('/')}</span>
                  {e.note && <span className="text-slate2-600 ml-2">— {e.note}</span>}
                </div>
                <button onClick={() => removeException(e.id)} className="text-rose-600 p-1">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
