'use client'

import { useMemo, useState } from 'react'
import { Repeat } from 'lucide-react'
import toast from 'react-hot-toast'
import { api, getApiErrorMessage } from '@/lib/api'
import { Schedule } from '@/types'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'

type Frequency = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY'

const FREQ_OPTIONS: { value: Frequency; label: string }[] = [
  { value: 'WEEKLY', label: 'Semanal' },
  { value: 'BIWEEKLY', label: 'Quinzenal' },
  { value: 'MONTHLY', label: 'Mensal' },
]
const WEEKDAY_OPTIONS = [
  { value: '0', label: 'Domingo' },
  { value: '1', label: 'Segunda' },
  { value: '2', label: 'Terça' },
  { value: '3', label: 'Quarta' },
  { value: '4', label: 'Quinta' },
  { value: '5', label: 'Sexta' },
  { value: '6', label: 'Sábado' },
]

interface Props {
  schedule: Schedule
  onCreated?: (subId: string) => void
}

export function MakeRecurringButton({ schedule, onCreated }: Props) {
  const order = schedule.order
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const initial = useMemo(() => {
    const d = schedule.scheduled_at ? new Date(schedule.scheduled_at) : new Date()
    return {
      weekday: String(d.getDay()),
      day_of_month: String(d.getDate()),
      time_slot: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
    }
  }, [schedule.scheduled_at])

  const [frequency, setFrequency] = useState<Frequency>('WEEKLY')
  const [weekday, setWeekday] = useState(initial.weekday)
  const [dayOfMonth, setDayOfMonth] = useState(initial.day_of_month)
  const [timeSlot, setTimeSlot] = useState(initial.time_slot)
  const [baseValue, setBaseValue] = useState(
    order?.final_price ?? schedule.hourly_amount ?? 0,
  )
  const [discountPct, setDiscountPct] = useState(10)

  if (!order?.category_id || !schedule.provider_id) return null
  const finalPrice = baseValue * (1 - discountPct / 100)

  async function submit() {
    if (baseValue <= 0) {
      toast.error('Informe o valor por ocorrência')
      return
    }
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        provider_id: schedule.provider_id,
        category_id: order!.category_id,
        frequency,
        time_slot: timeSlot,
        base_value: baseValue,
        discount_pct: discountPct / 100,
        title: order!.title,
        description: order!.description,
        answers: order!.answers || {},
        address: order!.address || undefined,
        neighborhood: order!.neighborhood || undefined,
        city: order!.city || 'São Paulo',
        state: order!.state || 'SP',
        latitude: order!.latitude || undefined,
        longitude: order!.longitude || undefined,
      }
      if (frequency === 'MONTHLY') body.day_of_month = Number(dayOfMonth)
      else body.weekday = Number(weekday)

      const res = await api.post('/subscriptions', body)
      toast.success('Assinatura criada!')
      setOpen(false)
      onCreated?.(res.data.data?.id)
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-br from-brand-50 to-violet-50 border border-brand-100 text-left hover:shadow-sm transition"
      >
        <div className="w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center flex-shrink-0">
          <Repeat className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <div className="font-semibold text-slate2-900">Tornar este serviço recorrente</div>
          <div className="text-xs text-slate2-600">
            Contrate {schedule.provider?.name || 'este prestador'} toda semana/mês com desconto.
          </div>
        </div>
      </button>

      <Modal isOpen={open} onClose={() => setOpen(false)} title="Nova assinatura" size="md">
        <div className="space-y-4">
          <div className="text-sm bg-slate2-50 rounded-xl p-3">
            <div className="font-medium text-slate2-900">{order.title}</div>
            <div className="text-xs text-slate2-500">
              com {schedule.provider?.name} · {order.category?.name}
            </div>
          </div>

          <Select
            label="Frequência"
            value={frequency}
            options={FREQ_OPTIONS}
            onChange={(e) => setFrequency(e.target.value as Frequency)}
          />

          {frequency === 'MONTHLY' ? (
            <Input
              label="Dia do mês"
              type="number"
              min={1}
              max={31}
              value={dayOfMonth}
              onChange={(e) => setDayOfMonth(e.target.value)}
            />
          ) : (
            <Select
              label="Dia da semana"
              value={weekday}
              options={WEEKDAY_OPTIONS}
              onChange={(e) => setWeekday(e.target.value)}
            />
          )}

          <Input
            label="Horário"
            type="time"
            value={timeSlot}
            onChange={(e) => setTimeSlot(e.target.value)}
          />

          <Input
            label="Valor por ocorrência (R$)"
            type="number"
            min={0}
            step={0.01}
            value={baseValue}
            onChange={(e) => setBaseValue(Number(e.target.value))}
          />

          <Input
            label="Desconto (%)"
            type="number"
            min={0}
            max={50}
            value={discountPct}
            onChange={(e) => setDiscountPct(Number(e.target.value))}
            helpText="Desconto sobre o pedido avulso. Padrão 10%."
          />

          <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-sm">
            <div className="text-emerald-700 font-semibold">
              R$ {finalPrice.toFixed(2)} por ocorrência
            </div>
            <div className="text-xs text-emerald-600">
              Economia de R$ {(baseValue - finalPrice).toFixed(2)} vs. preço avulso
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving} className="flex-1">
              Cancelar
            </Button>
            <Button onClick={submit} disabled={saving} className="flex-1">
              {saving ? 'Criando...' : 'Criar assinatura'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
