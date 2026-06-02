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

  useEffect(() => {
    Promise.all([
      api.get(`/categories/${slug}`),
      api.get(`/categories/${slug}/questionnaire`),
    ]).then(([catRes, qRes]) => {
      setCategory(catRes.data.data)
      // O endpoint de questionário retorna a categoria com os campos em questionnaire_fields
      const q = qRes.data.data
      const list = Array.isArray(q) ? q : (q?.questionnaire_fields ?? [])
      setFields(list)
      setEstimatedMin(catRes.data.data.base_price_min)
      setEstimatedMax(catRes.data.data.base_price_max)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [slug])

  function setAnswer(fieldId: string, value: string | boolean) {
    setAnswers(prev => ({ ...prev, [fieldId]: value }))
    // Recalcula estimativa com price_modifier
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

  if (loading) return <ActivityIndicator className="flex-1 mt-20" color="#2563eb" />

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="flex-row items-center px-4 py-3 bg-white border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <ArrowLeft size={22} color="#374151" />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-gray-800">
          {category?.icon} {category?.name}
        </Text>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="p-5 gap-5">
        {/* Estimativa */}
        <View className="bg-blue-50 rounded-2xl p-4">
          <Text className="text-sm text-blue-700">Estimativa de preço</Text>
          <Text className="text-xl font-bold text-blue-800 mt-0.5">
            {formatCurrency(estimatedMin)} – {formatCurrency(estimatedMax)}
          </Text>
        </View>

        {/* Questionário */}
        {fields.map(field => (
          <View key={field.id}>
            <Text className="text-sm font-medium text-gray-700 mb-1.5">
              {field.question}{field.is_required ? ' *' : ''}
            </Text>
            {field.field_type === 'BOOLEAN' ? (
              <View className="flex-row items-center justify-between bg-white rounded-xl p-4 border border-gray-200">
                <Text className="text-gray-700">Sim</Text>
                <Switch
                  value={Boolean(answers[field.id])}
                  onValueChange={v => setAnswer(field.id, v)}
                  trackColor={{ true: '#2563eb' }}
                />
              </View>
            ) : field.field_type === 'SELECT' || field.field_type === 'RADIO' ? (
              <View className="gap-2">
                {(field.options ?? []).map(opt => (
                  <TouchableOpacity
                    key={opt}
                    onPress={() => setAnswer(field.id, opt)}
                    className={`flex-row items-center p-3 rounded-xl border-2 ${
                      answers[field.id] === opt ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'
                    }`}
                  >
                    <View className={`w-4 h-4 rounded-full border-2 mr-3 ${
                      answers[field.id] === opt ? 'border-blue-500 bg-blue-500' : 'border-gray-400'
                    }`} />
                    <Text className={answers[field.id] === opt ? 'text-blue-700 font-medium' : 'text-gray-700'}>
                      {opt}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <TextInput
                className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-800"
                placeholder={field.field_type === 'NUMBER' ? '0' : 'Sua resposta…'}
                keyboardType={field.field_type === 'NUMBER' ? 'numeric' : 'default'}
                multiline={field.field_type === 'TEXTAREA'}
                numberOfLines={field.field_type === 'TEXTAREA' ? 3 : 1}
                value={String(answers[field.id] ?? '')}
                onChangeText={v => setAnswer(field.id, v)}
              />
            )}
          </View>
        ))}

        {/* Endereço e data */}
        <View>
          <Text className="text-sm font-medium text-gray-700 mb-1.5">Endereço do serviço *</Text>
          <TextInput
            className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-800"
            placeholder="Rua, número, bairro"
            value={address}
            onChangeText={setAddress}
          />
        </View>
        <View>
          <Text className="text-sm font-medium text-gray-700 mb-1.5">Cidade</Text>
          <TextInput
            className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-800"
            placeholder="Lajeado, RS"
            value={city}
            onChangeText={setCity}
          />
        </View>
        <View>
          <Text className="text-sm font-medium text-gray-700 mb-1.5">Data desejada (opcional)</Text>
          <TextInput
            className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-800"
            placeholder="DD/MM/AAAA"
            value={desiredDate}
            onChangeText={setDesiredDate}
          />
        </View>
        <View>
          <Text className="text-sm font-medium text-gray-700 mb-1.5">Detalhes adicionais</Text>
          <TextInput
            className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-800"
            placeholder="Informações extras para o prestador…"
            multiline
            numberOfLines={3}
            value={description}
            onChangeText={setDescription}
          />
        </View>

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={submitting}
          className={`rounded-2xl py-4 items-center mb-4 ${submitting ? 'bg-blue-400' : 'bg-blue-600'}`}
        >
          <Text className="text-white font-bold text-base">
            {submitting ? 'Publicando…' : 'Publicar pedido'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}
