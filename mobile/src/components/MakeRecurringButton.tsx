import { useMemo, useState } from 'react'
import { View, Text, TouchableOpacity, Modal, TextInput, ScrollView, Alert } from 'react-native'
import { Repeat } from 'lucide-react-native'
import { api, getApiError } from '../lib/api'
import { Schedule } from '../types'
import { Button } from './ui/Button'
import { formatCurrency } from '../lib/utils'

type Frequency = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY'

const FREQS: { value: Frequency; label: string }[] = [
  { value: 'WEEKLY', label: 'Semanal' },
  { value: 'BIWEEKLY', label: 'Quinzenal' },
  { value: 'MONTHLY', label: 'Mensal' },
]
const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

interface Props {
  schedule: Schedule
  onCreated?: () => void
}

export function MakeRecurringButton({ schedule, onCreated }: Props) {
  const order = schedule.order
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const initial = useMemo(() => {
    const d = schedule.scheduled_at ? new Date(schedule.scheduled_at) : new Date()
    return {
      weekday: d.getDay(),
      day_of_month: d.getDate(),
      time_slot: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
    }
  }, [schedule.scheduled_at])

  const [frequency, setFrequency] = useState<Frequency>('WEEKLY')
  const [weekday, setWeekday] = useState(initial.weekday)
  const [dayOfMonth, setDayOfMonth] = useState(String(initial.day_of_month))
  const [timeSlot, setTimeSlot] = useState(initial.time_slot)
  const [baseValue, setBaseValue] = useState(
    String((order as any)?.final_price ?? (schedule as any).hourly_amount ?? 0),
  )
  const [discountPct, setDiscountPct] = useState('10')

  if (!order?.category_id || !schedule.provider_id) return null
  const baseNum = Number(baseValue) || 0
  const discountNum = Number(discountPct) || 0
  const finalPrice = baseNum * (1 - discountNum / 100)

  async function submit() {
    if (baseNum <= 0) {
      Alert.alert('Atenção', 'Informe o valor por ocorrência')
      return
    }
    if (!/^\d{2}:\d{2}$/.test(timeSlot)) {
      Alert.alert('Atenção', 'Use o formato HH:MM')
      return
    }
    setSaving(true)
    try {
      const body: any = {
        provider_id: schedule.provider_id,
        category_id: order!.category_id,
        frequency,
        time_slot: timeSlot,
        base_value: baseNum,
        discount_pct: discountNum / 100,
        title: order!.title,
        description: order!.description,
        answers: (order as any)!.answers || {},
        address: order!.address || undefined,
        neighborhood: order!.neighborhood || undefined,
        city: order!.city || 'São Paulo',
        state: order!.state || 'SP',
        latitude: order!.latitude || undefined,
        longitude: order!.longitude || undefined,
      }
      if (frequency === 'MONTHLY') body.day_of_month = Number(dayOfMonth)
      else body.weekday = weekday

      await api.post('/subscriptions', body)
      Alert.alert('Sucesso', 'Assinatura criada!')
      setOpen(false)
      onCreated?.()
    } catch (err) {
      Alert.alert('Erro', getApiError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        className="bg-brand-50 border border-brand-100 rounded-2xl p-4 flex-row items-center gap-3"
      >
        <View className="w-10 h-10 bg-brand-700 rounded-xl items-center justify-center">
          <Repeat size={20} color="#fff" />
        </View>
        <View className="flex-1">
          <Text className="font-display-semibold text-slate2-900">
            Tornar este serviço recorrente
          </Text>
          <Text className="text-xs text-slate2-600 mt-0.5">
            Contrate {schedule.provider?.name || 'este prestador'} toda semana/mês com desconto.
          </Text>
        </View>
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl max-h-[90%]">
            <View className="p-5 border-b border-slate2-100">
              <Text className="font-display-bold text-lg text-slate2-900">Nova assinatura</Text>
              <Text className="text-xs text-slate2-500 mt-1">
                {order.title} · com {schedule.provider?.name}
              </Text>
            </View>

            <ScrollView className="px-5" contentContainerStyle={{ paddingVertical: 16, gap: 16 }}>
              <View>
                <Text className="text-sm font-medium text-slate2-700 mb-2">Frequência</Text>
                <View className="flex-row gap-2">
                  {FREQS.map((f) => (
                    <TouchableOpacity
                      key={f.value}
                      onPress={() => setFrequency(f.value)}
                      className={`px-4 py-2 rounded-xl border ${
                        frequency === f.value
                          ? 'bg-brand-700 border-brand-700'
                          : 'bg-white border-slate2-300'
                      }`}
                    >
                      <Text
                        className={`text-sm ${
                          frequency === f.value ? 'text-white' : 'text-slate2-700'
                        }`}
                      >
                        {f.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {frequency === 'MONTHLY' ? (
                <View>
                  <Text className="text-sm font-medium text-slate2-700 mb-2">Dia do mês</Text>
                  <TextInput
                    keyboardType="number-pad"
                    value={dayOfMonth}
                    onChangeText={setDayOfMonth}
                    className="border border-slate2-300 rounded-xl px-3 py-2.5 text-slate2-900"
                  />
                </View>
              ) : (
                <View>
                  <Text className="text-sm font-medium text-slate2-700 mb-2">Dia da semana</Text>
                  <View className="flex-row gap-1.5 flex-wrap">
                    {WEEKDAYS.map((w, i) => (
                      <TouchableOpacity
                        key={w}
                        onPress={() => setWeekday(i)}
                        className={`px-3 py-2 rounded-xl border ${
                          weekday === i
                            ? 'bg-brand-700 border-brand-700'
                            : 'bg-white border-slate2-300'
                        }`}
                      >
                        <Text
                          className={`text-xs ${
                            weekday === i ? 'text-white' : 'text-slate2-700'
                          }`}
                        >
                          {w}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              <View>
                <Text className="text-sm font-medium text-slate2-700 mb-2">Horário (HH:MM)</Text>
                <TextInput
                  value={timeSlot}
                  onChangeText={setTimeSlot}
                  placeholder="08:00"
                  className="border border-slate2-300 rounded-xl px-3 py-2.5 text-slate2-900"
                />
              </View>

              <View>
                <Text className="text-sm font-medium text-slate2-700 mb-2">
                  Valor por ocorrência (R$)
                </Text>
                <TextInput
                  keyboardType="decimal-pad"
                  value={baseValue}
                  onChangeText={setBaseValue}
                  className="border border-slate2-300 rounded-xl px-3 py-2.5 text-slate2-900"
                />
              </View>

              <View>
                <Text className="text-sm font-medium text-slate2-700 mb-2">Desconto (%)</Text>
                <TextInput
                  keyboardType="decimal-pad"
                  value={discountPct}
                  onChangeText={setDiscountPct}
                  className="border border-slate2-300 rounded-xl px-3 py-2.5 text-slate2-900"
                />
                <Text className="text-xs text-slate2-500 mt-1">
                  Desconto sobre o pedido avulso. Padrão 10%.
                </Text>
              </View>

              <View className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                <Text className="text-emerald-700 font-display-semibold">
                  {formatCurrency(finalPrice)} por ocorrência
                </Text>
                <Text className="text-xs text-emerald-600 mt-0.5">
                  Economia de {formatCurrency(baseNum - finalPrice)} vs. preço avulso
                </Text>
              </View>
            </ScrollView>

            <View className="flex-row gap-2 p-5 border-t border-slate2-100">
              <Button
                variant="secondary"
                onPress={() => setOpen(false)}
                disabled={saving}
                fullWidth
              >
                Cancelar
              </Button>
              <Button onPress={submit} loading={saving} fullWidth>
                Criar
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </>
  )
}
