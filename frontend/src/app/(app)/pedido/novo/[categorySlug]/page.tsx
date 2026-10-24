'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { ArrowLeft, Upload, X, Calendar, Clock } from 'lucide-react'
import { api, getApiErrorMessage } from '@/lib/api'
import { Category, Order, QuestionnaireField } from '@/types'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { PageSpinner } from '@/components/ui/Spinner'
import { PriceEstimator } from '@/components/PriceEstimator'
import { usePublicConfig } from '@/hooks/usePublicConfig'
import { ServiceLocationStep, ServiceLocationValue, EMPTY_LOCATION } from '@/components/ServiceLocationStep'

interface CategoryWithQuestionnaire extends Category {
  questionnaire_fields: QuestionnaireField[]
}

type FormValues = {
  description: string
  desired_date: string
  desired_time: string
}

function newRequestId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(16).padStart(8, '0').slice(-8)}-0000-4000-8000-${Math.random().toString(16).slice(2, 14).padEnd(12, '0')}`
}

/** Data/hora local (yyyy-mm-dd / hh:mm) para preencher os inputs na edição. */
function splitLocalDateTime(iso?: string | null): { date: string; time: string } {
  if (!iso) return { date: '', time: '' }
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return { date: '', time: '' }
  const pad = (n: number) => String(n).padStart(2, '0')
  return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` }
}

export default function NovoOrderPage() {
  const { categorySlug } = useParams<{ categorySlug: string }>()
  const searchParams = useSearchParams()
  const editId = searchParams.get('editar')
  const router = useRouter()

  const [category, setCategory] = useState<CategoryWithQuestionnaire | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [photos, setPhotos] = useState<File[]>([])
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([])
  // Fotos que o pedido já tinha (edição)
  const [existingPhotos, setExistingPhotos] = useState<string[]>([])
  const [location, setLocation] = useState<ServiceLocationValue>(EMPTY_LOCATION)
  const [isUrgent, setIsUrgent] = useState(false)
  const [editingOrder, setEditingOrder] = useState<Order | null>(null)
  const { max_order_photos: maxPhotos } = usePublicConfig()
  // Id deste formulário: se a rede cair e o pedido for reenviado, o servidor
  // devolve o mesmo pedido em vez de criar outro.
  const [clientRequestId] = useState(newRequestId)

  const { register, handleSubmit, reset } = useForm<FormValues>()

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get(`/categories/${categorySlug}/questionnaire`)
        setCategory(res.data.data)
        if (editId) {
          const o = (await api.get(`/orders/${editId}`)).data.data as Order
          setEditingOrder(o)
          setAnswers(Object.fromEntries(Object.entries(o.answers ?? {}).map(([k, v]) => [k, String(v)])))
          setExistingPhotos(o.photos ?? [])
          setIsUrgent(!!o.is_urgent)
          const dt = splitLocalDateTime(o.desired_date)
          reset({ description: o.description ?? '', desired_date: dt.date, desired_time: dt.time })
          setLocation({
            mode: o.location_source === 'GPS_AT_SITE' ? 'AT_SITE' : 'ADDRESS',
            cep: o.cep ? `${o.cep.slice(0, 5)}-${o.cep.slice(5)}` : '',
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
      } catch {
        toast.error(editId ? 'Pedido não encontrado' : 'Categoria não encontrada')
        router.back()
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [categorySlug, editId, router, reset])

  const handleAnswerChange = (fieldId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [fieldId]: value }))
  }

  const totalPhotos = existingPhotos.length + photos.length

  const handlePhotoAdd = useCallback((files: FileList | null) => {
    if (!files) return
    const room = Math.max(0, maxPhotos - existingPhotos.length - photos.length)
    const newFiles = Array.from(files).slice(0, room)
    if (files.length > newFiles.length) toast(`Máximo de ${maxPhotos} fotos por pedido`)
    const newPreviews = newFiles.map((f) => URL.createObjectURL(f))
    setPhotos((p) => [...p, ...newFiles])
    setPhotoPreviews((p) => [...p, ...newPreviews])
  }, [photos.length, existingPhotos.length, maxPhotos])

  const removePhoto = (idx: number) => {
    setPhotos((p) => p.filter((_, i) => i !== idx))
    setPhotoPreviews((p) => p.filter((_, i) => i !== idx))
  }

  const onSubmit = async (formData: FormValues) => {
    if (!category) return
    setSubmitting(true)

    try {
      // Validate required fields (Sim/Não e fotos nunca são obrigatórios)
      const requiredFields = (category.questionnaire_fields ?? []).filter(
        (f) => f.is_required && f.field_type !== 'PHOTO' && f.field_type !== 'BOOLEAN',
      )
      for (const field of requiredFields) {
        if (!answers[field.id]) {
          toast.error(`Campo obrigatório: ${field.question}`)
          return
        }
      }
      if (category.description_required && (formData.description ?? '').trim().length < 5) {
        toast.error('Descreva o serviço que você precisa')
        return
      }
      if (!location.mode) {
        toast.error('Responda se você está no local do serviço agora')
        return
      }
      if (!location.street.trim() || !location.number.trim() || !location.city.trim()) {
        toast.error('Informe rua, número e cidade do local do serviço')
        return
      }

      // Fotos novas vão ANTES do pedido: se o upload falhar, nada é criado pela metade
      let newUrls: string[] = []
      if (photos.length > 0) {
        const fd = new FormData()
        photos.forEach((f) => fd.append('photos', f))
        const up = await api.post('/orders/photos', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        newUrls = up.data.data.urls
      }

      const desired_date = formData.desired_date && formData.desired_time
        ? new Date(`${formData.desired_date}T${formData.desired_time}`).toISOString()
        : formData.desired_date ? new Date(`${formData.desired_date}T12:00`).toISOString() : null

      const content = {
        description: formData.description,
        answers,
        desired_date,
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
        photos: [...existingPhotos, ...newUrls],
      }

      if (editingOrder) {
        const res = await api.patch(`/orders/${editingOrder.id}`, content)
        toast.success(res.data.message || 'Pedido atualizado')
        router.push(`/pedido/${editingOrder.id}`)
        return
      }

      const res = await api.post('/orders', {
        ...content,
        category_id: category.id,
        is_urgent: isUrgent,
        client_request_id: clientRequestId,
      })
      toast.success('Pedido criado! Aguarde propostas dos prestadores.')
      router.push(`/pedido/${res.data.data.id}`)
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const renderField = (field: QuestionnaireField) => {
    const value = answers[field.id] || ''
    const label = (
      <>
        <label className="text-sm font-medium text-slate2-700">
          {field.question}
          {field.is_required && field.field_type !== 'BOOLEAN' && <span className="text-red-500 ml-1">*</span>}
        </label>
        {field.help_text && <p className="text-xs text-slate2-500">{field.help_text}</p>}
      </>
    )
    const inputClass = 'block w-full rounded-lg border border-slate2-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent'
    const chip = (active: boolean) =>
      `px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
        active ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate2-300 text-slate2-700 hover:border-slate2-400'
      }`

    switch (field.field_type) {
      case 'TEXT':
      case 'NUMBER':
        return (
          <div key={field.id} className="space-y-1">
            {label}
            <input
              type={field.field_type === 'NUMBER' ? 'number' : 'text'}
              placeholder={field.placeholder || ''}
              value={value}
              onChange={(e) => handleAnswerChange(field.id, e.target.value)}
              className={inputClass}
            />
          </div>
        )
      case 'TEXTAREA':
        return (
          <div key={field.id} className="space-y-1">
            {label}
            <textarea
              placeholder={field.placeholder || ''}
              value={value}
              onChange={(e) => handleAnswerChange(field.id, e.target.value)}
              rows={3}
              className={`${inputClass} resize-none`}
            />
          </div>
        )
      case 'SELECT':
        return (
          <div key={field.id} className="space-y-1">
            {label}
            <select value={value} onChange={(e) => handleAnswerChange(field.id, e.target.value)} className={inputClass}>
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
            {label}
            <div className="flex flex-wrap gap-2">
              {(field.options || []).map((opt) => (
                <button key={opt} type="button" onClick={() => handleAnswerChange(field.id, opt)} className={chip(value === opt)}>
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )
      case 'BOOLEAN': {
        // Respostas antigas gravadas como 'true'/'false'
        const yes = value === 'Sim' || value === 'true'
        const no = value === 'Não' || value === 'false'
        return (
          <div key={field.id} className="space-y-2">
            {label}
            <div className="flex gap-3">
              <button type="button" onClick={() => handleAnswerChange(field.id, 'Sim')} className={chip(yes)}>Sim</button>
              <button type="button" onClick={() => handleAnswerChange(field.id, 'Não')} className={chip(no)}>Não</button>
            </div>
          </div>
        )
      }
      case 'DATE':
        return (
          <div key={field.id} className="space-y-1">
            {label}
            <input
              type="date"
              value={value}
              min={new Date().toISOString().split('T')[0]}
              onChange={(e) => handleAnswerChange(field.id, e.target.value)}
              className={inputClass}
            />
          </div>
        )
      default:
        return null // fotos ficam no bloco de fotos
    }
  }

  if (loading) return <PageSpinner />
  if (!category) return null

  const questions = (category.questionnaire_fields ?? []).filter((f) => f.field_type !== 'PHOTO').sort((a, b) => a.order - b.order)

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-slate2-100 transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate2-600" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate2-900">{editingOrder ? 'Editar pedido' : category.name}</h1>
          <p className="text-sm text-slate2-500">{editingOrder ? category.name : category.description}</p>
        </div>
      </div>

      {editingOrder && (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Quem já mandou proposta será avisado da alteração e poderá ajustar o valor.
        </div>
      )}

      {/* Estimativa dinâmica de preço */}
      <div className="mb-6">
        <PriceEstimator
          categorySlug={category.slug}
          answers={answers}
          state={location.state || undefined}
          fallbackMin={category.base_price_min}
          fallbackMax={category.base_price_max}
          onEstimate={() => {}}
        />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {questions.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate2-200 p-6 space-y-5">
            <h2 className="font-semibold text-slate2-900">Detalhes do Serviço</h2>
            {questions.map(renderField)}
          </div>
        )}

        {/* Urgência (não muda depois de publicado) */}
        {!editingOrder && (
          <div className={`rounded-2xl border-2 p-5 transition-colors ${isUrgent ? 'border-rose-500 bg-rose-50' : 'border-slate2-200 bg-white'}`}>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={isUrgent} onChange={(e) => setIsUrgent(e.target.checked)} className="mt-1 w-5 h-5 accent-rose-600" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🚨</span>
                  <h2 className="font-semibold text-slate2-900">Preciso urgente</h2>
                  {isUrgent && <span className="text-xs bg-rose-600 text-white px-2 py-0.5 rounded-full">+25% no valor</span>}
                </div>
                <p className="text-xs text-slate2-600 mt-1">Notifica prestadores próximos (raio 10km) imediatamente. Prazo de aceite: 2h.</p>
              </div>
            </label>
          </div>
        )}

        {/* Description */}
        <div className="bg-white rounded-2xl border border-slate2-200 p-6">
          <h2 className="font-semibold text-slate2-900 mb-4">
            {category.description_required ? 'Descreva o serviço' : 'Descrição adicional'}
            {category.description_required && <span className="text-red-500 ml-1">*</span>}
          </h2>
          <Textarea
            placeholder={category.description_hint || 'Descreva detalhes importantes sobre o serviço que precisar...'}
            {...register('description')}
          />
          <p className="text-xs text-slate2-400 mt-2">
            Não informe telefone, e-mail ou redes sociais — o contato é liberado após a confirmação das taxas de conexão.
          </p>
        </div>

        {/* Photos — opcionais em todos os serviços */}
        <div className="bg-white rounded-2xl border border-slate2-200 p-6">
          <h2 className="font-semibold text-slate2-900 mb-1">
            Fotos do serviço <span className="text-xs font-normal text-slate2-400">(opcional)</span>
          </h2>
          <p className="text-xs text-slate2-500 mb-1">
            Até {maxPhotos} fotos. Ajudam o prestador a entender o que você precisa e a fazer uma proposta mais precisa.
          </p>
          {category.photo_hint ? (
            <p className="text-xs text-brand-700 mb-4">Sugestão: {category.photo_hint}</p>
          ) : (
            <div className="mb-4" />
          )}

          <div className="flex flex-wrap gap-3">
            {existingPhotos.map((src) => (
              <div key={src} className="relative w-24 h-24 rounded-xl overflow-hidden border border-slate2-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setExistingPhotos((p) => p.filter((u) => u !== src))}
                  className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            ))}
            {photoPreviews.map((src, i) => (
              <div key={src} className="relative w-24 h-24 rounded-xl overflow-hidden border border-slate2-200">
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

            {totalPhotos < maxPhotos && (
              <label className="w-24 h-24 rounded-xl border-2 border-dashed border-slate2-300 flex flex-col items-center justify-center cursor-pointer hover:border-brand-400 hover:bg-brand-50 transition-colors">
                <Upload className="w-5 h-5 text-slate2-400" />
                <span className="text-xs text-slate2-400 mt-1">Adicionar</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handlePhotoAdd(e.target.files)} />
              </label>
            )}
          </div>
        </div>

        {/* Data */}
        <div className="bg-white rounded-2xl border border-slate2-200 p-6">
          <h2 className="font-semibold text-slate2-900 mb-4">Quando?</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate2-700 flex items-center gap-1">
                <Calendar className="w-4 h-4" /> Data preferida
              </label>
              <input
                type="date"
                min={new Date().toISOString().split('T')[0]}
                className="block w-full rounded-lg border border-slate2-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                {...register('desired_date')}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate2-700 flex items-center gap-1">
                <Clock className="w-4 h-4" /> Horário preferido
              </label>
              <input
                type="time"
                className="block w-full rounded-lg border border-slate2-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                {...register('desired_time')}
              />
            </div>
          </div>
        </div>

        {/* Local exato do serviço — última etapa */}
        <ServiceLocationStep value={location} onChange={setLocation} />

        <Button type="submit" fullWidth size="lg" isLoading={submitting} className="sticky bottom-4 shadow-lg shadow-brand-200">
          {editingOrder ? 'Salvar alterações' : 'Publicar Pedido'}
        </Button>
      </form>
    </div>
  )
}
