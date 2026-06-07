import { useEffect, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, Switch,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { ArrowLeft } from 'lucide-react-native'
import { api, getApiError } from '../../../../src/lib/api'
import { formatCurrency } from '../../../../src/lib/utils'
import { PriceEstimator } from '../../../../src/components/PriceEstimator'

interface Field {
  id: string
  question: string
  field_type: string
  options?: string[]
  is_required: boolean
  affects_price: boolean
  price_modifier?: Record<string, number>
  order: number
}

interface CategoryDetail {
  id: string
  name: string
  icon: string
  slug: string
  base_price_min: number
  base_price_max: number
}

export default function NovoPedidoScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const [category, setCategory] = useState<CategoryDetail | null>(null)
  const [fields, setFields] = useState<Field[]>([])
  const [answers, setAnswers] = useState<Record<string, string | boolean>>({})
  const [description, setDescription] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [desiredDate, setDesiredDate] = useState('')
  const [estimatedMin, setEstimatedMin] = useState(0)
  const [estimatedMax, setEstimatedMax] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [focused, setFocused] = useState<string | null>(null)
  const [isUrgent, setIsUrgent] = useState(false)

  useEffect(() => {
    Promise.all([
      api.get(`/categories/${slug}`),
      api.get(`/categories/${slug}/questionnaire`),
    ]).then(([catRes, qRes]) => {
      setCategory(catRes.data.data)
      const q = qRes.data.data
      const list = Array.isArray(q) ? q : (q?.questionnaire_fields ?? [])
      setFields(list)
      setEstimatedMin(catRes.data.data.base_price_min)
      setEstimatedMax(catRes.data.data.base_price_max)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [slug])

  function setAnswer(fieldId: string, value: string | boolean) {
    setAnswers(prev => ({ ...prev, [fieldId]: value }))
    const field = fields.find(f => f.id === fieldId)
    if (field?.affects_price && field.price_modifier && category) {
      const mod = field.price_modifier[String(value)] ?? 1
      setEstimatedMin(category.base_price_min * mod)
      setEstimatedMax(category.base_price_max * mod)
    }
  }

  async function handleSubmit() {
    if (!address) { Alert.alert('Atenção', 'Informe o endereço do serviço.'); return }
    const required = fields.filter(f => f.is_required && !answers[f.id])
    if (required.length) {
      Alert.alert('Atenção', `Responda: ${required.map(f => f.question).join(', ')}`)
      return
    }
    setSubmitting(true)
    try {
      const { data } = await api.post('/orders', {
        category_id: category!.id,
        description,
        answers,
        address,
        city,
        desired_date: desiredDate || undefined,
        estimated_price_min: estimatedMin,
        estimated_price_max: estimatedMax,
        is_urgent: isUrgent,
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

  if (loading) return <ActivityIndicator className="flex-1 mt-20" color="#1D4ED8" />

  return (
    <SafeAreaView className="flex-1 bg-slate2-50">
      {/* Header — segue mockup "Novo Pedido — Questionário" */}
      <View className="flex-row items-center px-4 py-3 bg-white border-b border-slate2-100">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <ArrowLeft size={22} color="#334155" />
        </TouchableOpacity>
        <View className="w-10 h-10 bg-brand-50 rounded-xl items-center justify-center mr-2.5">
          <Text style={{ fontSize: 20 }}>{category?.icon}</Text>
        </View>
        <View className="flex-1">
          <Text className="font-display-extrabold text-base text-slate2-900" numberOfLines={1}>
            {category?.name}
          </Text>
          <Text className="font-sans text-xs text-slate2-500">
            Estimativa atualizada em tempo real
          </Text>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="p-5 gap-5">
        {/* Estimativa dinâmica */}
        {category && (
          <PriceEstimator
            categorySlug={category.slug ?? (slug as string)}
            answers={answers as any}
            fallbackMin={category.base_price_min}
            fallbackMax={category.base_price_max}
            onEstimate={(mn, mx) => { setEstimatedMin(mn); setEstimatedMax(mx) }}
          />
        )}

        {/* Questionário */}
        {fields.map(field => (
          <View key={field.id}>
            <Text className="font-display-semibold text-sm text-slate2-900 mb-2">
              {field.question}{field.is_required ? ' *' : ''}
            </Text>
            {field.field_type === 'BOOLEAN' ? (
              <View className="flex-row items-center justify-between bg-white rounded-xl p-4 border border-slate2-200">
                <Text className="font-sans text-slate2-700">Sim</Text>
                <Switch
                  value={Boolean(answers[field.id])}
                  onValueChange={v => setAnswer(field.id, v)}
                  trackColor={{ true: '#1D4ED8' }}
                />
              </View>
            ) : field.field_type === 'SELECT' || field.field_type === 'RADIO' ? (
              <View className="gap-2.5">
                {(field.options ?? []).map(opt => {
                  const active = answers[field.id] === opt
                  return (
                    <TouchableOpacity
                      key={opt}
                      onPress={() => setAnswer(field.id, opt)}
                      className={`flex-row items-center gap-3 p-3.5 rounded-xl border-2 ${
                        active
                          ? 'border-brand-700 bg-brand-50'
                          : 'border-slate2-200 bg-white'
                      }`}
                    >
                      <View
                        className="w-5 h-5 rounded-full"
                        style={{
                          borderWidth: active ? 6 : 2,
                          borderColor: active ? '#1D4ED8' : '#CBD5E1',
                          backgroundColor: '#fff',
                        }}
                      />
                      <Text
                        className={
                          active
                            ? 'font-display-bold text-sm text-brand-700'
                            : 'font-display-medium text-sm text-slate2-800'
                        }
                      >
                        {opt}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            ) : (
              <TextInput
                className={`bg-white border rounded-xl px-4 py-3 text-slate2-900 font-sans ${
                  focused === field.id ? 'border-brand-500' : 'border-slate2-300'
                }`}
                placeholder={field.field_type === 'NUMBER' ? '0' : 'Sua resposta…'}
                placeholderTextColor="#94A3B8"
                keyboardType={field.field_type === 'NUMBER' ? 'numeric' : 'default'}
                multiline={field.field_type === 'TEXTAREA'}
                numberOfLines={field.field_type === 'TEXTAREA' ? 3 : 1}
                value={String(answers[field.id] ?? '')}
                onChangeText={v => setAnswer(field.id, v)}
                onFocus={() => setFocused(field.id)}
                onBlur={() => setFocused(null)}
              />
            )}
          </View>
        ))}

        {/* Endereço e data */}
        {[
          { key: 'address',  label: 'Endereço do serviço *', value: address,     setter: setAddress,     placeholder: 'Rua, número, bairro' },
          { key: 'city',     label: 'Cidade',                value: city,        setter: setCity,        placeholder: 'Lajeado, RS' },
          { key: 'date',     label: 'Data desejada (opcional)', value: desiredDate, setter: setDesiredDate, placeholder: 'DD/MM/AAAA' },
        ].map(({ key, label, value, setter, placeholder }) => (
          <View key={key}>
            <Text className="font-display-semibold text-sm text-slate2-900 mb-2">
              {label}
            </Text>
            <TextInput
              className={`bg-white border rounded-xl px-4 py-3 text-slate2-900 font-sans ${
                focused === key ? 'border-brand-500' : 'border-slate2-300'
              }`}
              placeholder={placeholder}
              placeholderTextColor="#94A3B8"
              value={value}
              onChangeText={setter}
              onFocus={() => setFocused(key)}
              onBlur={() => setFocused(null)}
            />
          </View>
        ))}
        <View>
          <Text className="font-display-semibold text-sm text-slate2-900 mb-2">
            Detalhes adicionais
          </Text>
          <TextInput
            className={`bg-white border rounded-xl px-4 py-3 text-slate2-900 font-sans ${
              focused === 'desc' ? 'border-brand-500' : 'border-slate2-300'
            }`}
            placeholder="Informações extras para o prestador…"
            placeholderTextColor="#94A3B8"
            multiline
            numberOfLines={3}
            value={description}
            onChangeText={setDescription}
            onFocus={() => setFocused('desc')}
            onBlur={() => setFocused(null)}
          />
        </View>

        <TouchableOpacity
          onPress={() => setIsUrgent(!isUrgent)}
          className={`rounded-2xl p-4 mb-4 border-2 ${isUrgent ? 'border-rose-500 bg-rose-50' : 'border-slate2-200 bg-white'}`}
        >
          <View className="flex-row items-start gap-3">
            <View className={`w-5 h-5 rounded border-2 items-center justify-center mt-0.5 ${isUrgent ? 'bg-rose-600 border-rose-600' : 'border-slate2-300'}`}>
              {isUrgent && <Text className="text-white text-xs">✓</Text>}
            </View>
            <View className="flex-1">
              <View className="flex-row items-center gap-2 mb-1">
                <Text className="font-semibold text-slate2-900">🚨 Preciso urgente</Text>
                {isUrgent && (
                  <Text className="text-[10px] bg-rose-600 text-white px-2 py-0.5 rounded-full">+25%</Text>
                )}
              </View>
              <Text className="text-xs text-slate2-600">
                Notifica prestadores próximos imediatamente. Prazo: 2h.
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={submitting}
          className={`rounded-2xl py-4 items-center mb-4 ${
            submitting ? 'bg-brand-400' : 'bg-brand-700'
          }`}
        >
          <Text className="font-display-bold text-white text-base">
            {submitting ? 'Publicando…' : 'Publicar pedido →'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}
