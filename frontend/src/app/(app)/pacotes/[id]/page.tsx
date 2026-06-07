'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Clock, MapPin, Star, Check, Package } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Avatar } from '@/components/ui/Avatar'
import { PageSpinner } from '@/components/ui/Spinner'
import { api, getApiErrorMessage } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { ServicePackage } from '@/types'
import { useAuthStore } from '@/store/auth'
import toast from 'react-hot-toast'

export default function PackageDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user } = useAuthStore()

  const [pkg, setPkg] = useState<ServicePackage | null>(null)
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState(false)
  const [showForm, setShowForm] = useState(false)

  // form
  const [city, setCity] = useState(user?.address_city ?? '')
  const [stateUf, setStateUf] = useState(user?.address_state ?? 'SP')
  const [neighborhood, setNeighborhood] = useState(user?.address_neighborhood ?? '')
  const [address, setAddress] = useState('')
  const [desiredDate, setDesiredDate] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    api.get(`/packages/${id}`)
      .then((r) => setPkg(r.data.data))
      .catch(() => router.replace('/pacotes'))
      .finally(() => setLoading(false))
  }, [id])

  async function purchase() {
    if (!city) { toast.error('Informe a cidade'); return }
    setPurchasing(true)
    try {
      const r = await api.post(`/packages/${id}/purchase`, {
        city, state: stateUf, neighborhood, address,
        desired_date: desiredDate ? new Date(desiredDate).toISOString() : undefined,
        notes,
        latitude: user?.latitude ?? undefined,
        longitude: user?.longitude ?? undefined,
      })
      toast.success('Pacote contratado! Realize o pagamento.')
      router.push(`/pagamento/${r.data.data.order_id}`)
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setPurchasing(false)
    }
  }

  if (loading) return <PageSpinner />
  if (!pkg) return null

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={() => router.back()} className="text-sm text-slate2-600 hover:text-slate2-900 mb-4 flex items-center gap-1.5">
        <ArrowLeft size={16} /> Voltar
      </button>

      {pkg.photos.length > 0 && (
        <div className="rounded-2xl overflow-hidden mb-5 bg-slate2-100">
          <img src={pkg.photos[0]} alt={pkg.title} className="w-full h-64 object-cover" />
        </div>
      )}

      <div className="flex items-start gap-2 mb-1">
        <div className="text-2xl">{pkg.category.icon}</div>
        <div className="flex-1">
          <div className="text-xs text-brand-700 font-semibold uppercase tracking-wide">{pkg.category.name}</div>
          <h1 className="text-2xl font-bold">{pkg.title}</h1>
        </div>
      </div>

      <div className="text-sm text-slate2-600 flex items-center gap-3 mb-4 flex-wrap">
        <span className="flex items-center gap-1"><Clock size={14} /> {pkg.duration_min} min</span>
        {pkg.distance_km != null && (
          <span className="flex items-center gap-1"><MapPin size={14} /> {pkg.distance_km.toFixed(1)} km</span>
        )}
        <span>{pkg.purchases_count} contratações</span>
      </div>

      <Card className="p-5 mb-4">
        <div className="text-xs text-emerald-700 uppercase tracking-wide font-semibold">Preço fixo</div>
        <div className="text-3xl font-extrabold text-emerald-700 mt-1 mb-1">{formatCurrency(pkg.price)}</div>
        <div className="text-xs text-slate2-500">Já inclui a parte do prestador. Taxas do app calculadas no pagamento.</div>
      </Card>

      <Card className="p-5 mb-4">
        <h2 className="font-semibold mb-2 flex items-center gap-2"><Package size={16} /> O que está incluso</h2>
        {pkg.includes.length === 0 ? (
          <div className="text-sm text-slate2-500">Nenhum item específico listado.</div>
        ) : (
          <ul className="space-y-1.5">
            {pkg.includes.map((i, idx) => (
              <li key={idx} className="text-sm flex items-start gap-2">
                <Check size={14} className="text-emerald-600 mt-0.5 flex-shrink-0" /> {i}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-5 mb-4">
        <h2 className="font-semibold mb-2">Descrição</h2>
        <p className="text-sm whitespace-pre-wrap text-slate2-700">{pkg.description}</p>
      </Card>

      <Card className="p-5 mb-6">
        <h2 className="font-semibold mb-3">Prestador</h2>
        <div className="flex items-center gap-3">
          <Avatar name={pkg.provider.name} avatar={pkg.provider.avatar ?? undefined} size="lg" />
          <div className="flex-1">
            <div className="font-bold">{pkg.provider.name}</div>
            {pkg.provider.rating_count > 0 && (
              <div className="text-sm text-amber-600 flex items-center gap-0.5">
                <Star size={12} fill="currentColor" />
                {pkg.provider.rating_avg.toFixed(1)} ({pkg.provider.rating_count} avaliações)
              </div>
            )}
            {pkg.provider.bio && (
              <p className="text-xs text-slate2-600 mt-1 line-clamp-2">{pkg.provider.bio}</p>
            )}
          </div>
        </div>
      </Card>

      {pkg.provider.id === user?.id ? (
        <Card className="p-4 bg-slate2-50 text-center text-sm text-slate2-600">Este é o seu pacote.</Card>
      ) : !showForm ? (
        <Button onClick={() => setShowForm(true)} fullWidth size="lg">
          Contratar agora — {formatCurrency(pkg.price)}
        </Button>
      ) : (
        <Card className="p-5">
          <h3 className="font-bold mb-3">Dados do serviço</h3>
          <div className="space-y-3 mb-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2"><Input label="Cidade *" value={city} onChange={(e) => setCity(e.target.value)} /></div>
              <Input label="UF" value={stateUf} onChange={(e) => setStateUf(e.target.value.toUpperCase().slice(0, 2))} />
            </div>
            <Input label="Bairro" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} />
            <Input label="Endereço (rua + número)" value={address} onChange={(e) => setAddress(e.target.value)} />
            <Input
              label="Data desejada"
              type="datetime-local"
              value={desiredDate}
              onChange={(e) => setDesiredDate(e.target.value)}
            />
            <Textarea
              label="Observações"
              placeholder="Detalhes que ajudem o prestador"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowForm(false)} disabled={purchasing}>Cancelar</Button>
            <Button onClick={purchase} isLoading={purchasing} className="flex-1">
              Contratar — {formatCurrency(pkg.price)}
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}
