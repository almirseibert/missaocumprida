import { useEffect, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { ArrowLeft } from 'lucide-react-native'
import { api, getApiError } from '../../../../src/lib/api'
import { maskDateBR, parseDateBR, isoToDateBR } from '../../../../src/lib/utils'
import { PriceEstimator } from '../../../../src/components/PriceEstimator'
import { PhotoStrip } from '../../../../src/components/PhotoStrip'
import { ServiceLocationStep, ServiceLocationValue, EMPTY_LOCATION } from '../../../../src/components/ServiceLocationStep'
import { PickedPhoto, uploadOrderPhotos } from '../../../../src/lib/photos'
import { usePublicConfig } from '../../../../src/lib/config'
import { randomUuid, maskCep } from '../../../../src/lib/ids'
import { Order } from '../../../../src/types'

interface Field {
  id: string
  question: string
  field_type: string
  options?: string[]
  is_required: boolean
  affects_price: boolean
  order: number
  help_text?: string | null
  placeholder?: string | null
}

interface CategoryDetail {
  id: string
  name: string
  icon: string
  slug: string
  base_price_min: number
  base_price_max: number
  description_hint?: string | null
  description_required?: boolean
  photo_hint?: string | null
  questionnaire_fields?: Field[]
}

function maskTime(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 4)
  return d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : d
}

/** Hora local HH:MM de um ISO (sem Intl — Hermes). */
function isoToTime(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function NovoPedidoScreen() {
  const { slug, editar } = useLocalSearchParams<{ slug: string; editar?: string }>()
  const config = usePublicConfig()
  const [category, setCategory] = useState<CategoryDetail | null>(null)
  const [fields, setFields] = useState<Field[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [description, setDescription] = useState('')
  const [desiredDate, setDesiredDate] = useState('')
  const [desiredTime, setDesiredTime] = useState('')
  const [photos, setPhotos] = useState<PickedPhoto[]>([])
  const [location, setLocation] = useState<ServiceLocationValue>(EMPTY_LOCATION)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [focused, setFocused] = useState<string | null>(null)
  const [isUrgent, setIsUrgent] = useState(false)
  const [editingOrder, setEditingOrder] = useState<Order | null>(null)
  const [clientRequestId] = useState(randomUuid)

  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const qRes = await api.get(`/categories/${slug}/questionnaire`)
        if (!alive) return
        const cat = qRes.data.data as CategoryDetail
        setCategory(cat)
        setFields((cat.questionnaire_fields ?? []).filter((f) => f.field_type !== 'PHOTO').sort((a, b) => a.order - b.order))
        if (editar) {
          const o = (await api.get(`/orders/${editar}`)).data.data as Order
          if (!alive) return
          setEditingOrder(o)
          setAnswers(Object.fromEntries(Object.entries(o.answers ?? {}).map(([k, v]) => [k, String(v)])))
          setDescription(o.description ?? '')
          setDesiredDate(isoToDateBR(o.desired_date))
          setDesiredTime(isoToTime(o.desired_date))
          setPhotos((o.photos ?? []).map((url) => ({ uri: url, remoteUrl: url })))
          setIsUrgent(!!o.is_urgent)
          setLocation({
            mode: o.location_source === 'GPS_AT_SITE' ? 'AT_SITE' : 'ADDRESS',
            cep: o.cep ? maskCep(o.cep) : '',
            street: o.address ?? '',
            number: o.address_number ?? '',
            complement: o.address_complement ?? '',
            neighborhood: o.neighborhood ?? '',
            city: o.city ?? '',
            state: o.state ?? '',
            latitude: o.latitude ?? null,
            longitude: o.longitude ?? null,
            accuracy: o.location_accuracy_m ?? null,
            location_source: o.location_source === 'GPS_AT_SITE' || o.location_source === 'ADDRESS_GEOCODED' ? o.location_source : null,
          })
        }
      } catch (err) {
        if (alive) setLoadError(getApiError(err))
      } finally {
        if (alive) setLoading(false)
      }
    }
    load()
    return () => { alive = false }
  }, [slug, editar])

  function setAnswer(fieldId: string, value: string) {
    setAnswers((prev) => ({ ...prev, [fieldId]: value }))
  }

  async function handleSubmit() {
    if (!category) return
    const required = fields.filter((f) => f.is_required && f.field_type !== 'BOOLEAN' && !answers[f.id])
    if (required.length) {
      Alert.alert('Atenção', `Responda: ${required.map((f) => f.question).join(', ')}`)
      return
    }
    if (category.description_required && description.trim().length < 5) {
      Alert.alert('Atenção', 'Descreva o serviço que você precisa.')
      return
    }
    let dateIso: string | null = null
    if (desiredDate) {
      const d = parseDateBR(desiredDate)
      if (!d) { Alert.alert('Data inválida', 'Use o formato DD/MM/AAAA (ou deixe em branco).'); return }
      const t = /^\d{2}:\d{2}$/.test(desiredTime) ? desiredTime : '12:00'
      dateIso = `${d}T${t}:00-03:00`
    }
    if (!location.mode) {
      Alert.alert('Local do serviço', 'Responda se você está no local do serviço agora.')
      return
    }
    if (!location.street.trim() || !location.number.trim() || !location.city.trim()) {
      Alert.alert('Local do serviço', 'Informe rua, número e cidade.')
      return
    }

    setSubmitting(true)
    try {
      const photoUrls = await uploadOrderPhotos(photos)
      const content = {
        description,
        answers,
        desired_date: dateIso,
        address: location.street,
        address_number: location.number,
        address_complement: location.complement,
        neighborhood: location.neighborhood,
        city: location.city,
        state: location.state,
        cep: location.cep || null,
        latitude: location.latitude,
        longitude: location.longitude,
        location_source: location.latitude != null ? location.location_source : null,
        location_accuracy_m: location.accuracy,
        photos: photoUrls,
      }
      if (editingOrder) {
        const res = await api.patch(`/orders/${editingOrder.id}`, content)
        Alert.alert('Pedido atualizado', res.data.message ?? 'Alterações salvas.', [
          { text: 'OK', onPress: () => router.replace(`/(app)/pedido/${editingOrder.id}`) },
        ])
        return
      }
      const { data } = await api.post('/orders', {
        ...content,
        category_id: category.id,
        is_urgent: isUrgent,
        client_request_id: clientRequestId,
      })
      Alert.alert('Pedido criado!', 'Aguarde as propostas dos prestadores.', [
        { text: 'Ver pedido', onPress: () => router.replace(`/(app)/pedido/${data.data.id}`) },
      ])
    } catch (err) {
      Alert.alert('Erro', getApiError(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <ActivityIndicator className="flex-1 mt-20" color="#059669" />
  if (loadError || !category) {
    return (
      <SafeAreaView className="flex-1 bg-paper items-center justify-center p-6">
        <Text className="font-sans text-slate2-700 text-center mb-4">{loadError ?? 'Categoria não encontrada.'}</Text>
        <TouchableOpacity onPress={() => router.back()} className="px-5 py-3 rounded-xl bg-brand-700">
          <Text className="font-display-bold text-white">Voltar</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  const inputCls = (key: string) =>
    `bg-white border rounded-xl px-4 py-3 text-slate2-900 font-sans ${focused === key ? 'border-brand-500' : 'border-slate2-300'}`
  const chip = (active: boolean) =>
    `flex-row items-center gap-3 p-3.5 rounded-xl border-2 ${active ? 'border-brand-700 bg-brand-50' : 'border-slate2-200 bg-white'}`

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <View className="flex-row items-center px-4 py-3 bg-white border-b border-slate2-100">
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Voltar" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => router.back()} className="mr-3">
          <ArrowLeft size={22} color="#334155" />
        </TouchableOpacity>
        <View className="w-10 h-10 bg-brand-50 rounded-xl items-center justify-center mr-2.5">
          <Text style={{ fontSize: 20 }}>{category.icon}</Text>
        </View>
        <View className="flex-1">
          <Text className="font-display-extrabold text-base text-slate2-900" numberOfLines={1}>
            {editingOrder ? 'Editar pedido' : category.name}
          </Text>
          <Text className="font-sans text-xs text-slate2-500">
            {editingOrder ? category.name : 'Estimativa atualizada em tempo real'}
          </Text>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="p-5 gap-5" keyboardShouldPersistTaps="handled">
        {editingOrder && (
          <View className="rounded-xl border border-amber-200 bg-amber-50 p-3">
            <Text className="font-sans text-xs text-amber-800">
              Quem já mandou proposta será avisado da alteração e poderá ajustar o valor.
            </Text>
          </View>
        )}

        <PriceEstimator
          categorySlug={category.slug ?? (slug as string)}
          answers={answers as any}
          fallbackMin={category.base_price_min}
          fallbackMax={category.base_price_max}
          onEstimate={() => {}}
        />

        {fields.map((field) => (
          <View key={field.id}>
            <Text className="font-display-semibold text-sm text-slate2-900 mb-2">
              {field.question}{field.is_required && field.field_type !== 'BOOLEAN' ? ' *' : ''}
            </Text>
            {field.help_text ? <Text className="font-sans text-xs text-slate2-500 mb-2">{field.help_text}</Text> : null}
            {field.field_type === 'BOOLEAN' ? (
              <View className="flex-row gap-2.5">
                {['Sim', 'Não'].map((opt) => {
                  const v = answers[field.id]
                  const active = opt === 'Sim' ? v === 'Sim' || v === 'true' : v === 'Não' || v === 'false'
                  return (
                    <TouchableOpacity key={opt} onPress={() => setAnswer(field.id, opt)} className={`flex-1 ${chip(active)} justify-center`}>
                      <Text className={active ? 'font-display-bold text-sm text-brand-700' : 'font-display-medium text-sm text-slate2-800'}>{opt}</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            ) : field.field_type === 'SELECT' || field.field_type === 'RADIO' ? (
              <View className="gap-2.5">
                {(field.options ?? []).map((opt) => {
                  const active = answers[field.id] === opt
                  return (
                    <TouchableOpacity key={opt} onPress={() => setAnswer(field.id, opt)} className={chip(active)}>
                      <View
                        className="w-5 h-5 rounded-full"
                        style={{ borderWidth: active ? 6 : 2, borderColor: active ? '#059669' : '#CBD5E1', backgroundColor: '#fff' }}
                      />
                      <Text className={active ? 'font-display-bold text-sm text-brand-700' : 'font-display-medium text-sm text-slate2-800'}>{opt}</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            ) : field.field_type === 'DATE' ? (
              <TextInput
                className={inputCls(field.id)}
                placeholder="DD/MM/AAAA"
                placeholderTextColor="#94A3B8"
                keyboardType="number-pad"
                value={isoToDateBR(answers[field.id]) || answers[field.id] || ''}
                onChangeText={(v) => {
                  const masked = maskDateBR(v)
                  const parsed = parseDateBR(masked)
                  setAnswer(field.id, parsed ?? masked)
                }}
                onFocus={() => setFocused(field.id)}
                onBlur={() => setFocused(null)}
              />
            ) : (
              <TextInput
                className={inputCls(field.id)}
                placeholder={field.placeholder || (field.field_type === 'NUMBER' ? '0' : 'Sua resposta…')}
                placeholderTextColor="#94A3B8"
                keyboardType={field.field_type === 'NUMBER' ? 'numeric' : 'default'}
                multiline={field.field_type === 'TEXTAREA'}
                numberOfLines={field.field_type === 'TEXTAREA' ? 3 : 1}
                value={answers[field.id] ?? ''}
                onChangeText={(v) => setAnswer(field.id, v)}
                onFocus={() => setFocused(field.id)}
                onBlur={() => setFocused(null)}
              />
            )}
          </View>
        ))}

        <View>
          <Text className="font-display-semibold text-sm text-slate2-900 mb-2">
            {category.description_required ? 'Descreva o serviço *' : 'Detalhes adicionais'}
          </Text>
          <TextInput
            className={inputCls('desc')}
            placeholder={category.description_hint || 'Informações extras para o prestador…'}
            placeholderTextColor="#94A3B8"
            multiline
            numberOfLines={4}
            value={description}
            onChangeText={setDescription}
            onFocus={() => setFocused('desc')}
            onBlur={() => setFocused(null)}
          />
          <Text className="font-sans text-xs text-slate2-400 mt-1.5">
            Não informe telefone, e-mail ou redes sociais — o contato é liberado após as taxas de conexão.
          </Text>
        </View>

        <View>
          <Text className="font-display-semibold text-sm text-slate2-900 mb-1">Fotos do serviço (opcional)</Text>
          <Text className="font-sans text-xs text-slate2-500 mb-2.5">
            Ajudam o prestador a entender o que você precisa e a fazer uma proposta mais precisa.
          </Text>
          <PhotoStrip photos={photos} onChange={setPhotos} max={config.max_order_photos} hint={category.photo_hint} />
        </View>

        <View className="flex-row gap-3">
          <View className="flex-1">
            <Text className="font-display-semibold text-sm text-slate2-900 mb-2">Data desejada</Text>
            <TextInput
              className={inputCls('date')}
              placeholder="DD/MM/AAAA"
              placeholderTextColor="#94A3B8"
              keyboardType="number-pad"
              value={desiredDate}
              onChangeText={(v) => setDesiredDate(maskDateBR(v))}
              onFocus={() => setFocused('date')}
              onBlur={() => setFocused(null)}
            />
          </View>
          <View className="w-28">
            <Text className="font-display-semibold text-sm text-slate2-900 mb-2">Horário</Text>
            <TextInput
              className={inputCls('time')}
              placeholder="HH:MM"
              placeholderTextColor="#94A3B8"
              keyboardType="number-pad"
              value={desiredTime}
              onChangeText={(v) => setDesiredTime(maskTime(v))}
              onFocus={() => setFocused('time')}
              onBlur={() => setFocused(null)}
            />
          </View>
        </View>

        {!editingOrder && (
          <TouchableOpacity
            onPress={() => setIsUrgent(!isUrgent)}
            className={`rounded-2xl p-4 border-2 ${isUrgent ? 'border-rose-500 bg-rose-50' : 'border-slate2-200 bg-white'}`}
          >
            <View className="flex-row items-start gap-3">
              <View className={`w-5 h-5 rounded border-2 items-center justify-center mt-0.5 ${isUrgent ? 'bg-rose-600 border-rose-600' : 'border-slate2-300'}`}>
                {isUrgent && <Text className="text-white text-xs">✓</Text>}
              </View>
              <View className="flex-1">
                <View className="flex-row items-center gap-2 mb-1">
                  <Text className="font-semibold text-slate2-900">🚨 Preciso urgente</Text>
                  {isUrgent && <Text className="text-[10px] bg-rose-600 text-white px-2 py-0.5 rounded-full">+25%</Text>}
                </View>
                <Text className="text-xs text-slate2-600">Notifica prestadores próximos imediatamente. Prazo: 2h.</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}

        {/* Última etapa: local exato do serviço */}
        <ServiceLocationStep value={location} onChange={setLocation} />

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={submitting}
          className={`rounded-2xl py-4 items-center mb-6 ${submitting ? 'bg-brand-400' : 'bg-brand-700'}`}
        >
          <Text className="font-display-bold text-white text-base">
            {submitting ? 'Enviando…' : editingOrder ? 'Salvar alterações' : 'Publicar pedido →'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}
