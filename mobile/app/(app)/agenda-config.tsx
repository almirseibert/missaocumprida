import { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  Alert, TextInput,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { ArrowLeft, Plus, Trash2, Save, CalendarDays } from 'lucide-react-native'
import { api, getApiError } from '../../src/lib/api'

type Rule = { id?: string; weekday: number; start_time: string; end_time: string; slot_min: number; category_id: string | null }
type Exception = { id: string; date: string; blocked: boolean; note: string | null }

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export default function AgendaConfigScreen() {
  const [rules, setRules] = useState<Rule[]>([])
  const [exceptions, setExceptions] = useState<Exception[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [exDate, setExDate] = useState('')
  const [exNote, setExNote] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await api.get('/users/me/availability')
      const d = res.data.data
      setRules(d.rules || [])
      setExceptions(d.exceptions || [])
    } catch {
      setRules([]); setExceptions([])
    } finally {
      setLoading(false)
    }
  }

  function addRule() {
    setRules([...rules, { weekday: 1, start_time: '08:00', end_time: '17:00', slot_min: 60, category_id: null }])
  }

  function updateRule(idx: number, patch: Partial<Rule>) {
    setRules(rules.map((r, i) => i === idx ? { ...r, ...patch } : r))
  }

  function removeRule(idx: number) {
    setRules(rules.filter((_, i) => i !== idx))
  }

  async function save() {
    setSaving(true)
    try {
      await api.put('/users/me/availability', { rules })
      Alert.alert('Sucesso', 'Agenda salva!')
      await load()
    } catch (err) {
      Alert.alert('Erro', getApiError(err))
    } finally {
      setSaving(false)
    }
  }

  async function addException() {
    if (!exDate) return Alert.alert('Erro', 'Informe a data (YYYY-MM-DD)')
    try {
      await api.post('/users/me/availability/exception', {
        date: exDate, blocked: true, note: exNote || undefined,
      })
      setExDate(''); setExNote('')
      await load()
    } catch (err) {
      Alert.alert('Erro', getApiError(err))
    }
  }

  async function removeException(id: string) {
    try {
      await api.delete(`/users/me/availability/exception/${id}`)
      await load()
    } catch (err) {
      Alert.alert('Erro', getApiError(err))
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-slate2-50" edges={['top']}>
      <View className="flex-row items-center px-4 py-3 bg-white border-b border-slate2-100 gap-2">
        <TouchableOpacity onPress={() => router.back()} className="p-1">
          <ArrowLeft size={22} color="#0F172A" />
        </TouchableOpacity>
        <CalendarDays size={20} color="#7C3AED" />
        <Text className="text-lg font-semibold text-slate2-900">Minha agenda</Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#7C3AED" />
        </View>
      ) : (
        <ScrollView className="flex-1 p-4">
          <View className="bg-white rounded-2xl p-4 mb-4">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="font-semibold text-slate2-900">Horários disponíveis</Text>
              <TouchableOpacity onPress={addRule} className="bg-brand-700 px-3 py-1.5 rounded-lg flex-row items-center gap-1">
                <Plus size={14} color="#fff" />
                <Text className="text-white text-sm">Nova</Text>
              </TouchableOpacity>
            </View>
            {rules.length === 0 ? (
              <Text className="text-slate2-500 italic text-center py-4">Nenhuma regra cadastrada.</Text>
            ) : rules.map((r, idx) => (
              <View key={idx} className="bg-slate2-50 rounded-xl p-3 mb-2">
                <View className="flex-row mb-2 flex-wrap">
                  {WEEKDAYS.map((d, i) => (
                    <TouchableOpacity
                      key={i}
                      onPress={() => updateRule(idx, { weekday: i })}
                      className={`px-2 py-1 rounded-lg mr-1 mb-1 ${r.weekday === i ? 'bg-brand-700' : 'bg-white border border-slate2-200'}`}
                    >
                      <Text className={`text-xs ${r.weekday === i ? 'text-white' : 'text-slate2-700'}`}>{d}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View className="flex-row items-center gap-2">
                  <TextInput
                    value={r.start_time}
                    onChangeText={(v: string) => updateRule(idx, { start_time: v })}
                    placeholder="08:00"
                    className="border border-slate2-200 rounded-lg px-2 py-1.5 bg-white w-20 text-center"
                  />
                  <Text className="text-slate2-500">até</Text>
                  <TextInput
                    value={r.end_time}
                    onChangeText={(v: string) => updateRule(idx, { end_time: v })}
                    placeholder="17:00"
                    className="border border-slate2-200 rounded-lg px-2 py-1.5 bg-white w-20 text-center"
                  />
                  <Text className="text-xs text-slate2-600">slot</Text>
                  <TextInput
                    value={String(r.slot_min)}
                    onChangeText={(v: string) => updateRule(idx, { slot_min: Number(v) || 60 })}
                    keyboardType="numeric"
                    className="border border-slate2-200 rounded-lg px-2 py-1.5 bg-white w-14 text-center"
                  />
                  <TouchableOpacity onPress={() => removeRule(idx)} className="ml-auto p-1">
                    <Trash2 size={16} color="#E11D48" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            <TouchableOpacity onPress={save} disabled={saving} className="bg-brand-700 py-3 rounded-xl mt-2 flex-row items-center justify-center gap-2">
              {saving ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Save size={16} color="#fff" />
                  <Text className="text-white font-semibold">Salvar regras</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View className="bg-white rounded-2xl p-4">
            <Text className="font-semibold text-slate2-900 mb-1">Dias bloqueados</Text>
            <Text className="text-xs text-slate2-500 mb-3">Bloqueie datas específicas (folgas, viagens)</Text>
            <View className="flex-row gap-2 mb-3">
              <TextInput
                value={exDate}
                onChangeText={setExDate}
                placeholder="YYYY-MM-DD"
                className="flex-1 border border-slate2-200 rounded-lg px-3 py-2 bg-white"
              />
              <TouchableOpacity onPress={addException} className="bg-rose-600 px-3 py-2 rounded-lg">
                <Plus size={16} color="#fff" />
              </TouchableOpacity>
            </View>
            <TextInput
              value={exNote}
              onChangeText={setExNote}
              placeholder="Observação (opcional)"
              className="border border-slate2-200 rounded-lg px-3 py-2 bg-white mb-3"
            />
            {exceptions.map(e => (
              <View key={e.id} className="flex-row items-center justify-between p-3 bg-rose-50 rounded-xl mb-2">
                <Text className="text-sm">
                  <Text className="font-medium">{e.date.slice(0, 10).split('-').reverse().join('/')}</Text>
                  {e.note ? ` — ${e.note}` : ''}
                </Text>
                <TouchableOpacity onPress={() => removeException(e.id)}>
                  <Trash2 size={14} color="#E11D48" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  )
}
