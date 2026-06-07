'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Calendar as CalIcon, Clock, Check } from 'lucide-react'
import { api, getApiErrorMessage } from '@/lib/api'
import { toast } from 'react-hot-toast'

type Day = { date: string; slots: string[] }
type Category = { id: string; name: string; slug: string }

export default function AgendarPage() {
  const router = useRouter()
  const { providerId } = useParams<{ providerId: string }>()
  const [provider, setProvider] = useState<any>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [categoryId, setCategoryId] = useState<string>('')
  const [days, setDays] = useState<Day[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [agreedPrice, setAgreedPrice] = useState('')
  const [title, setTitle] = useState('')
  const [city, setCity] = useState('')
  const [booking, setBooking] = useState(false)

  useEffect(() => {
    load()
  }, [providerId])

  async function load() {
    setLoading(true)
    try {
      const [pRes, slotsRes, catRes] = await Promise.all([
        api.get(`/users/${providerId}`),
        api.get(`/users/${providerId}/availability`),
        api.get('/categories/groups'),
      ])
      setProvider(pRes.data.data)
      setDays(slotsRes.data.data.days || [])
      const all: Category[] = []
      ;(catRes.data.data || []).forEach((g: any) => (g.categories || []).forEach((c: Category) => all.push(c)))
      setCategories(all)
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  async function book() {
    if (!selectedDay || !selectedSlot || !categoryId || !title || !city || !agreedPrice) {
      return toast.error('Preencha todos os campos')
    }
    setBooking(true)
    try {
      const scheduledAt = new Date(`${selectedDay}T${selectedSlot}:00.000Z`).toISOString()
      const res = await api.post('/orders/direct-book', {
        provider_id: providerId,
        category_id: categoryId,
        scheduled_at: scheduledAt,
        title,
        city,
        agreed_price: Number(agreedPrice),
      })
      const orderId = res.data.data.order_id
      router.push(`/pagamento/${orderId}`)
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setBooking(false)
    }
  }

  if (loading) return <div className="p-8 text-center">Carregando...</div>

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <button onClick={() => router.back()} className="flex items-center gap-2 text-slate2-600">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>
      {provider && (
        <div className="bg-white rounded-2xl p-5 border border-slate2-100 flex items-center gap-4">
          {provider.avatar
            ? <img src={provider.avatar} alt={provider.name} className="w-16 h-16 rounded-full object-cover" />
            : <div className="w-16 h-16 rounded-full bg-brand-100 flex items-center justify-center text-2xl font-bold text-brand-700">{provider.name?.[0]}</div>}
          <div>
            <h1 className="text-xl font-bold">{provider.name}</h1>
            <p className="text-sm text-slate2-600">Agendar diretamente</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl p-5 border border-slate2-100">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <CalIcon className="w-5 h-5 text-brand-700" /> Escolha um horário
        </h2>
        {days.length === 0 ? (
          <p className="text-sm text-slate2-500 italic">Este prestador ainda não definiu horários disponíveis.</p>
        ) : (
          <div className="space-y-3">
            {days.slice(0, 14).map((d) => (
              <div key={d.date}>
                <button
                  onClick={() => setSelectedDay(d.date === selectedDay ? null : d.date)}
                  className={`w-full text-left px-3 py-2 rounded-xl ${selectedDay === d.date ? 'bg-brand-700 text-white' : 'bg-slate2-50 hover:bg-slate2-100'}`}
                >
                  <span className="font-medium">{d.date.split('-').reverse().join('/')}</span>
                  <span className="ml-2 text-xs opacity-75">{d.slots.length} horários</span>
                </button>
                {selectedDay === d.date && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {d.slots.map((s) => (
                      <button
                        key={s}
                        onClick={() => setSelectedSlot(s)}
                        className={`px-3 py-1.5 rounded-lg text-sm border ${selectedSlot === s ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-slate2-200 hover:border-brand-500'}`}
                      >
                        <Clock className="w-3 h-3 inline mr-1" />{s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedDay && selectedSlot && (
        <div className="bg-white rounded-2xl p-5 border border-slate2-100 space-y-3">
          <h2 className="text-lg font-semibold">Dados do agendamento</h2>
          <div>
            <label className="text-xs text-slate2-600">Categoria</label>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full border border-slate2-200 rounded-xl px-3 py-2 bg-white">
              <option value="">Selecione...</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate2-600">Título do serviço</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full border border-slate2-200 rounded-xl px-3 py-2" placeholder="Ex: Limpeza de apartamento" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate2-600">Cidade</label>
              <input value={city} onChange={(e) => setCity(e.target.value)} className="w-full border border-slate2-200 rounded-xl px-3 py-2" />
            </div>
            <div>
              <label className="text-xs text-slate2-600">Valor combinado (R$)</label>
              <input type="number" value={agreedPrice} onChange={(e) => setAgreedPrice(e.target.value)} className="w-full border border-slate2-200 rounded-xl px-3 py-2" />
            </div>
          </div>
          <button
            onClick={book}
            disabled={booking}
            className="w-full bg-emerald-600 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Check className="w-5 h-5" /> {booking ? 'Reservando...' : `Reservar ${selectedDay.split('-').reverse().join('/')} às ${selectedSlot}`}
          </button>
        </div>
      )}
    </div>
  )
}
