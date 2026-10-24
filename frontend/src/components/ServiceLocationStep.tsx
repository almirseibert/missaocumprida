'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { Crosshair, Loader2, MapPin, Search } from 'lucide-react'
import { api } from '@/lib/api'

/**
 * Local exato do serviço.
 * Pergunta final do pedido: "Você está agora no local onde o serviço será
 * prestado?" — se SIM, captura o GPS do aparelho (alta precisão) e preenche o
 * endereço; se NÃO, o cliente informa CEP + número e o endereço é convertido
 * em coordenadas. O endereço exato só é liberado ao prestador depois que as
 * duas taxas de conexão forem pagas.
 */
export interface ServiceLocationValue {
  mode: 'AT_SITE' | 'ADDRESS' | null
  cep: string
  street: string
  number: string
  complement: string
  neighborhood: string
  city: string
  state: string
  latitude: number | null
  longitude: number | null
  accuracy: number | null
  location_source: 'GPS_AT_SITE' | 'ADDRESS_GEOCODED' | null
}

export const EMPTY_LOCATION: ServiceLocationValue = {
  mode: null, cep: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '',
  latitude: null, longitude: null, accuracy: null, location_source: null,
}

const MAX_ACCURACY_M = 100

function maskCep(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 8)
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Seu navegador não permite obter a localização.'))
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 })
  })
}

export function ServiceLocationStep({
  value,
  onChange,
}: {
  value: ServiceLocationValue
  onChange: (v: ServiceLocationValue) => void
}) {
  const [locating, setLocating] = useState(false)
  const [lookingCep, setLookingCep] = useState(false)
  const [geocoding, setGeocoding] = useState(false)
  const set = (patch: Partial<ServiceLocationValue>) => onChange({ ...value, ...patch })

  async function captureAtSite() {
    setLocating(true)
    try {
      const pos = await getPosition()
      const { latitude, longitude, accuracy } = pos.coords
      const next: ServiceLocationValue = {
        ...value,
        mode: 'AT_SITE',
        latitude,
        longitude,
        accuracy: Math.round(accuracy),
        location_source: 'GPS_AT_SITE',
      }
      if (accuracy > MAX_ACCURACY_M) {
        toast(`A precisão do GPS está baixa (±${Math.round(accuracy)} m). Se puder, vá para perto de uma janela e tente de novo.`, { icon: '📡', duration: 6000 })
      }
      try {
        const r = await api.post('/geo/reverse', { latitude, longitude })
        const a = r.data.data
        next.street = a.street || next.street
        next.number = a.number || next.number
        next.neighborhood = a.neighborhood || next.neighborhood
        next.city = a.city || next.city
        next.state = a.state || next.state
        next.cep = a.cep ? maskCep(a.cep) : next.cep
      } catch {
        // sem endereço automático: o cliente preenche, as coordenadas já valem
      }
      onChange(next)
      toast.success('Localização do serviço capturada')
    } catch (err) {
      const e = err as GeolocationPositionError | Error
      const msg = 'code' in e && e.code === 1
        ? 'Você não permitiu o acesso à localização. Informe o endereço pelo CEP.'
        : 'Não foi possível obter sua localização. Informe o endereço pelo CEP.'
      toast.error(msg)
      onChange({ ...value, mode: 'ADDRESS', location_source: null, latitude: null, longitude: null, accuracy: null })
    } finally {
      setLocating(false)
    }
  }

  async function lookupCep(cepMasked: string) {
    const cep = cepMasked.replace(/\D/g, '')
    if (cep.length !== 8) return
    setLookingCep(true)
    try {
      const r = await api.get(`/geo/cep/${cep}`)
      const a = r.data.data
      onChange({
        ...value,
        cep: maskCep(cep),
        street: a.street || value.street,
        neighborhood: a.neighborhood || value.neighborhood,
        city: a.city || value.city,
        state: a.state || value.state,
        latitude: null, longitude: null, accuracy: null, location_source: null,
      })
    } catch {
      toast.error('CEP não encontrado. Preencha o endereço manualmente.')
    } finally {
      setLookingCep(false)
    }
  }

  async function geocode() {
    if (!value.city || (!value.street && !value.cep)) {
      toast.error('Informe ao menos a rua e a cidade')
      return
    }
    setGeocoding(true)
    try {
      const r = await api.post('/geo/geocode', {
        street: value.street, number: value.number, neighborhood: value.neighborhood,
        city: value.city, state: value.state, cep: value.cep,
      })
      const g = r.data.data
      set({ latitude: g.latitude, longitude: g.longitude, location_source: 'ADDRESS_GEOCODED', accuracy: null })
      toast.success('Endereço localizado no mapa')
    } catch {
      toast('Não achamos o endereço exato no mapa — ele será localizado ao publicar.', { icon: 'ℹ️' })
    } finally {
      setGeocoding(false)
    }
  }

  const input = 'block w-full rounded-lg border border-slate2-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'

  return (
    <div className="bg-white rounded-2xl border border-slate2-200 p-6 space-y-4">
      <div>
        <h2 className="font-semibold text-slate2-900 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-brand-600" /> Local do serviço
        </h2>
        <p className="text-sm text-slate2-700 mt-2 font-medium">Você está agora no local onde o serviço será prestado?</p>
        <div className="flex flex-wrap gap-2 mt-2">
          <button
            type="button"
            onClick={captureAtSite}
            disabled={locating}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
              value.mode === 'AT_SITE' ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-slate2-300 text-slate2-700 hover:border-slate2-400'
            }`}
          >
            {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crosshair className="w-4 h-4" />}
            Sim, estou no local
          </button>
          <button
            type="button"
            onClick={() => set({ mode: 'ADDRESS', location_source: value.location_source === 'GPS_AT_SITE' ? null : value.location_source, ...(value.location_source === 'GPS_AT_SITE' ? { latitude: null, longitude: null, accuracy: null } : {}) })}
            className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
              value.mode === 'ADDRESS' ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-slate2-300 text-slate2-700 hover:border-slate2-400'
            }`}
          >
            Não, vou informar o endereço
          </button>
        </div>
        {value.mode === 'AT_SITE' && value.latitude != null && (
          <p className="text-xs text-green-700 mt-2">
            ✓ Localização capturada{value.accuracy ? ` (precisão ±${value.accuracy} m)` : ''}. Confira o endereço abaixo.
          </p>
        )}
      </div>

      {value.mode && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1 space-y-1">
              <label className="text-sm font-medium text-slate2-700">CEP</label>
              <div className="relative">
                <input
                  value={value.cep}
                  inputMode="numeric"
                  placeholder="00000-000"
                  onChange={(e) => {
                    const v = maskCep(e.target.value)
                    set({ cep: v })
                    if (value.mode === 'ADDRESS' && v.replace(/\D/g, '').length === 8) lookupCep(v)
                  }}
                  className={input}
                />
                {lookingCep && <Loader2 className="w-4 h-4 animate-spin absolute right-2 top-2.5 text-slate2-400" />}
              </div>
            </div>
            <div className="col-span-2 space-y-1">
              <label className="text-sm font-medium text-slate2-700">Rua *</label>
              <input value={value.street} onChange={(e) => set({ street: e.target.value })} className={input} placeholder="Nome da rua" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate2-700">Número *</label>
              <input value={value.number} onChange={(e) => set({ number: e.target.value })} className={input} placeholder="123" />
            </div>
            <div className="col-span-2 space-y-1">
              <label className="text-sm font-medium text-slate2-700">Complemento</label>
              <input value={value.complement} onChange={(e) => set({ complement: e.target.value })} className={input} placeholder="Apto, bloco, casa dos fundos…" />
            </div>
          </div>
          <div className="grid grid-cols-6 gap-3">
            <div className="col-span-3 space-y-1">
              <label className="text-sm font-medium text-slate2-700">Bairro</label>
              <input value={value.neighborhood} onChange={(e) => set({ neighborhood: e.target.value })} className={input} />
            </div>
            <div className="col-span-2 space-y-1">
              <label className="text-sm font-medium text-slate2-700">Cidade *</label>
              <input value={value.city} onChange={(e) => set({ city: e.target.value })} className={input} />
            </div>
            <div className="col-span-1 space-y-1">
              <label className="text-sm font-medium text-slate2-700">UF</label>
              <input value={value.state} maxLength={2} onChange={(e) => set({ state: e.target.value.toUpperCase() })} className={`${input} uppercase`} />
            </div>
          </div>
          {value.mode === 'ADDRESS' && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={geocode}
                disabled={geocoding}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate2-300 text-xs font-medium hover:bg-slate2-50 disabled:opacity-50"
              >
                {geocoding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                Localizar no mapa
              </button>
              {value.location_source === 'ADDRESS_GEOCODED' && <span className="text-xs text-green-700">✓ Endereço localizado</span>}
            </div>
          )}
          <p className="text-xs text-slate2-500">
            🔒 O prestador vê só o bairro e a região até que vocês dois paguem a taxa de conexão. Depois disso ele recebe o endereço completo e o ponto exato no mapa.
          </p>
        </div>
      )}
    </div>
  )
}
