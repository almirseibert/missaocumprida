'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { ArrowLeft, Upload, X, MapPin, Calendar, Clock, Loader2, Navigation } from 'lucide-react'
import { api, getApiErrorMessage } from '@/lib/api'
import { Category, QuestionnaireField } from '@/types'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { PageSpinner } from '@/components/ui/Spinner'
import { formatCurrency } from '@/lib/utils'

interface CategoryWithQuestionnaire extends Category {
  questionnaire_fields: QuestionnaireField[]
}

interface PriceRange {
  min: number
  max: number
}

export default function NovoOrderPage() {
  const { categorySlug } = useParams<{ categorySlug: string }>()
  const router = useRouter()

  const [category, setCategory] = useState<CategoryWithQuestionnaire | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [photos, setPhotos] = useState<File[]>([])
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([])
  const [priceRange, setPriceRange] = useState<PriceRange | null>(null)
  const [gpsCoords, setGpsCoords] = useState<{ latitude: number; longitude: number } | null>(null)
  const [gettingGps, setGettingGps] = useState(false)

  const { register, handleSubmit, formState: { errors }, watch } = useForm<{
    description: string
    desired_date: string
    desired_time: string
    address: string
    neighborhood: string
    city: string
    state: string
  }>()

  useEffect(() => {
    api.get(`/categories/${categorySlug}/questionnaire`).then((res) => {
      setCategory(res.data.data)
    }).catch(() => {
      toast.error('Categoria não encontrada')
      router.back()
    }).finally(() => setLoading(false))
  }, [categorySlug, router])

  // Fetch price estimate whenever answers change
  useEffect(() => {
    if (!category) return
    const filledAnswers = Object.keys(answers).length
    if (filledAnswers === 0) {
      setPriceRange({ min: category.base_price_min, max: category.base_price_max })
    }
  }, [answers, category])

  const handleAnswerChange = (fieldId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [fieldId]: value }))
  }

  const handlePhotoAdd = useCallback((files: FileList | null) => {
    if (!files) return
    const newFiles = Array.from(files).slice(0, 5 - photos.length)
    const newPreviews = newFiles.map((f) => URL.createObjectURL(f))
    setPhotos((p) => [...p, ...newFiles])
    setPhotoPreviews((p) => [...p, ...newPreviews])
  }, [photos.length])

  const removePhoto = (idx: number) => {
    setPhotos((p) => p.filter((_, i) => i !== idx))
    setPhotoPreviews((p) => p.filter((_, i) => i !== idx))
  }

  const captureGps = () => {
    if (!navigator.geolocation) { toast.error('Geolocalização não suportada'); return }
    setGettingGps(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude })
        setGettingGps(false)
        toast.success('Localização capturada!')
      },
      () => { setGettingGps(false); toast.error('Não foi possível obter localização') },
      { timeout: 10000 }
    )
  }

  const onSubmit = async (formData: { description: string; desired_date: string; desired_time: string; address: string; neighborhood: string; city: string; state: string }) => {
    if (!category) return
    setSubmitting(true)

    try {
      // Validate required fields
      const requiredFields = (category.questionnaire_fields ?? []).filter((f) => f.is_required && f.field_type !== 'PHOTO')
      for (const field of requiredFields) {
        if (!answers[field.id]) {
          toast.error(`Campo obrigatório: ${field.question}`)
          setSubmitting(false)
          return
        }
      }

      // Create order
      const desired_date = formData.desired_date && formData.desired_time
        ? new Date(`${formData.desired_date}T${formData.desired_time}`).toISOString()
        : formData.desired_date ? new Date(formData.desired_date).toISOString() : undefined

      const payload = {
        category_id: category.id,
        description: formData.description,
        answers,
        desired_date,
        address: formData.address,
        neighborhood: formData.neighborhood,
        city: formData.city,
        state: formData.state,
        ...(gpsCoords ?? {}),
      }

      const res = await api.post('/orders', payload)
      const order = res.data.data
      const orderId = order.id

      // Upload photos if any
      if (photos.length > 0) {
        const fd = new FormData()
        photos.forEach((f) => fd.append('photos', f))
        await api.post(`/orders/${orderId}/photos`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      }

      toast.success('Pedido criado! Aguarde propostas dos prestadores.')
      router.push(`/pedido/${orderId}`)
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const renderField = (field: QuestionnaireField) => {
    const value = answers[field.id] || ''

    switch (field.field_type) {
      case 'TEXT':
      case 'NUMBER':
        return (
          <div key={field.id} className="space-y-1">
            <label className="text-sm font-medium text-gray-700">
              {field.question}
              {field.is_required && <span className="text-red-500 ml-1">*</span>}
            </label>
            {field.help_text && <p className="text-xs text-gray-500">{field.help_text}</p>}
            <input
              type={field.field_type === 'NUMBER' ? 'number' : 'text'}
              placeholder={field.placeholder || ''}
              value={value}
              onChange={(e) => handleAnswerChange(field.id, e.target.value)}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>
        )

      case 'TEXTAREA':
        return (
          <div key={field.id} className="space-y-1">
            <label className="text-sm font-medium text-gray-700">
              {field.question}
              {field.is_required && <span className="text-red-500 ml-1">*</span>}
            </label>
            {field.help_text && <p className="text-xs text-gray-500">{field.help_text}</p>}
            <textarea
              placeholder={field.placeholder || ''}
              value={value}
              onChange={(e) => handleAnswerChange(field.id, e.target.value)}
              rows={3}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>
        )

      case 'SELECT':
        return (
          <div key={field.id} className="space-y-1">
            <label className="text-sm font-medium text-gray-700">
              {field.question}
              {field.is_required && <span className="text-red-500 ml-1">*</span>}
            </label>
            {field.help_text && <p className="text-xs text-gray-500">{field.help_text}</p>}
            <select
              value={value}
              onChange={(e) => handleAnswerChange(field.id, e.target.value)}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            >
              <option value="">Selecione...</option>
              {(field.options || []).map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        )

      case 'RADIO':
        return (
          <div key={field.id} className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              {field.question}
              {field.is_required && <span className="text-red-500 ml-1">*</span>}
            </label>
            {field.help_text && <p className="text-xs text-gray-500">{field.help_text}</p>}
            <div className="flex flex-wrap gap-2">
              {(field.options || []).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => handleAnswerChange(field.id, opt)}
                  className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    value === opt
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-gray-300 text-gray-700 hover:border-gray-400'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )

      case 'BOOLEAN':
        return (
          <div key={field.id} className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              {field.question}
              {field.is_required && <span className="text-red-500 ml-1">*</span>}
            </label>
            {field.help_text && <p className="text-xs text-gray-500">{field.help_text}</p>}
            <div className="flex gap-3">
              {['Sim', 'Não'].map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => handleAnswerChange(field.id, opt)}
                  className={`px-6 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    value === opt
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-gray-300 text-gray-700 hover:border-gray-400'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )

      case 'DATE':
        return (
          <div key={field.id} className="space-y-1">
            <label className="text-sm font-medium text-gray-700">
              {field.question}
              {field.is_required && <span className="text-red-500 ml-1">*</span>}
            </label>
            {field.help_text && <p className="text-xs text-gray-500">{field.help_text}</p>}
            <input
              type="date"
              value={value}
              min={new Date().toISOString().split('T')[0]}
              onChange={(e) => handleAnswerChange(field.id, e.target.value)}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>
        )

      case 'PHOTO':
        return null // handled separately in the photo upload section

      default:
        return null
    }
  }

  if (loading) return <PageSpinner />
  if (!category) return null

  const photoRequired = (category.questionnaire_fields ?? []).some((f) => f.field_type === 'PHOTO' && f.is_required)

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{category.name}</h1>
          <p className="text-sm text-gray-500">{category.description}</p>
        </div>
      </div>

      {/* Price estimate */}
      <div className="bg-brand-50 border border-brand-200 rounded-xl p-4 mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs text-brand-600 font-medium uppercase tracking-wide">Estimativa de preço</p>
          <p className="text-lg font-bold text-brand-700">
            {formatCurrency(category.base_price_min)} – {formatCurrency(category.base_price_max)}
          </p>
          <p className="text-xs text-brand-500">O preço final será definido pelo prestador</p>
        </div>
        {category.estimated_hours && (
          <div className="text-right">
            <p className="text-xs text-brand-600">Duração estimada</p>
            <p className="font-bold text-brand-700">{category.estimated_hours}h</p>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Questionnaire */}
        {(category.questionnaire_fields ?? []).filter((f) => f.field_type !== 'PHOTO').length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
            <h2 className="font-semibold text-gray-900">Detalhes do Serviço</h2>
            {(category.questionnaire_fields ?? [])
              .filter((f) => f.field_type !== 'PHOTO')
              .sort((a, b) => a.order - b.order)
              .map(renderField)}
          </div>
        )}

        {/* Description */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Descrição adicional</h2>
          <Textarea
            placeholder="Descreva detalhes importantes sobre o serviço que precisar..."
            {...register('description')}
          />
        </div>

        {/* Photos */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-1">
            Fotos do local / serviço
            {photoRequired && <span className="text-red-500 ml-1">*</span>}
          </h2>
          <p className="text-xs text-gray-500 mb-4">Até 5 fotos. Ajuda os prestadores a fazer uma proposta mais precisa.</p>

          <div className="flex flex-wrap gap-3">
            {photoPreviews.map((src, i) => (
              <div key={i} className="relative w-24 h-24 rounded-xl overflow-hidden border border-gray-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removePhoto(i)}
                  className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            ))}

            {photos.length < 5 && (
              <label className="w-24 h-24 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-brand-400 hover:bg-brand-50 transition-colors">
                <Upload className="w-5 h-5 text-gray-400" />
                <span className="text-xs text-gray-400 mt-1">Adicionar</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => handlePhotoAdd(e.target.files)}
                />
              </label>
            )}
          </div>
        </div>

        {/* Schedule & Location */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Agendamento e Local</h2>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                <Calendar className="w-4 h-4" /> Data preferida
              </label>
              <input
                type="date"
                min={new Date().toISOString().split('T')[0]}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                {...register('desired_date')}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                <Clock className="w-4 h-4" /> Horário preferido
              </label>
              <input
                type="time"
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                {...register('desired_time')}
              />
            </div>
          </div>

          <div className="space-y-3">
            {/* GPS capture */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                <Navigation className="w-4 h-4" /> Localização GPS
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={captureGps}
                  disabled={gettingGps}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  {gettingGps
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Navigation className="w-4 h-4 text-brand-500" />}
                  {gpsCoords ? 'Atualizar localização' : 'Usar minha localização'}
                </button>
                {gpsCoords && (
                  <span className="text-xs text-green-600 font-medium">
                    ✓ GPS capturado
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400">
                Recomendado — permite que prestadores vejam a distância até o local do serviço
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                <MapPin className="w-4 h-4" /> Endereço completo
              </label>
              <input
                placeholder="Rua e número (ex: Av. Paulista, 1000)"
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                {...register('address')}
              />
              <p className="text-xs text-gray-400">
                Endereço exato só é revelado ao prestador após aceite da proposta
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Bairro</label>
                <input
                  placeholder="Nome do bairro"
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  {...register('neighborhood')}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Cidade</label>
                <input
                  placeholder="Cidade"
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  {...register('city')}
                />
              </div>
            </div>

            <div className="w-24">
              <input
                placeholder="UF"
                maxLength={2}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-brand-500"
                {...register('state')}
              />
            </div>
          </div>
        </div>

        <Button
          type="submit"
          fullWidth
          size="lg"
          isLoading={submitting}
          className="sticky bottom-4 shadow-lg shadow-brand-200"
        >
          Publicar Pedido
        </Button>
      </form>
    </div>
  )
}
