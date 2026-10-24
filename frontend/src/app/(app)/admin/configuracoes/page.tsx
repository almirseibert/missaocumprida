'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Settings, Percent, Save } from 'lucide-react'
import { api, getApiErrorMessage } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { PageSpinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'

/**
 * Configurações da plataforma (Remap 2.0): taxas de conexão, promoção de
 * lançamento, prazos e repasses — editáveis em runtime, sem redeploy.
 * Os apps leem via GET /config/public; o cálculo é sempre do servidor.
 */

type SettingsData = {
  fee_client_pct: number
  fee_provider_pct: number
  fee_regular_pct: number
  fee_promo_active: boolean
  fee_min: number
  provider_fee_timeout_hours: number
  proposal_min_ratio: number
  gateway_surcharge_card: number
  gateway_surcharge_pix: number
  max_order_photos: number
  max_service_photos: number
}

const PCT_FIELDS: Array<{ key: keyof SettingsData; label: string; hint: string }> = [
  { key: 'fee_client_pct', label: 'Taxa do cliente (%)', hint: 'Percentual vigente cobrado do cliente ao aceitar' },
  { key: 'fee_provider_pct', label: 'Taxa do prestador (%)', hint: 'Percentual vigente cobrado do prestador' },
  { key: 'fee_regular_pct', label: 'Taxa cheia (%)', hint: 'Valor exibido riscado quando a promoção está ativa' },
  { key: 'gateway_surcharge_pix', label: 'Repasse Pix (%)', hint: 'Acréscimo do meio de pagamento sobre a taxa' },
  { key: 'gateway_surcharge_card', label: 'Repasse cartão (%)', hint: 'Acréscimo do meio de pagamento sobre a taxa' },
  { key: 'proposal_min_ratio', label: 'Piso da proposta (%)', hint: '% do preço mínimo da categoria (antifraude)' },
]

export default function AdminConfiguracoesPage() {
  const { user } = useAuthStore()
  const router = useRouter()
  const [settings, setSettings] = useState<SettingsData | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (user && user.role !== 'ADMIN') router.replace('/home') }, [user, router])

  useEffect(() => {
    if (user?.role !== 'ADMIN') return
    api.get('/config')
      .then((r) => setSettings(r.data.data))
      .catch((e) => toast.error(getApiErrorMessage(e)))
  }, [user])

  if (!user) return <PageSpinner />
  if (user.role !== 'ADMIN') return null
  if (!settings) return <PageSpinner />

  const setPct = (key: keyof SettingsData, raw: string) => {
    const v = parseFloat(raw.replace(',', '.'))
    if (isNaN(v)) return
    // Uma casa decimal: 7,5% → 0.075 (antes arredondava para 8%)
    setSettings({ ...settings, [key]: Math.round(v * 10) / 1000 } as SettingsData)
  }

  const save = async () => {
    setSaving(true)
    try {
      const res = await api.put('/config', settings)
      setSettings(res.data.data)
      toast.success('Configurações salvas — apps refletem em até 1 minuto')
    } catch (e) {
      toast.error(getApiErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate2-900 flex items-center gap-2">
          <Settings className="w-6 h-6 text-brand-600" /> Configurações da plataforma
        </h1>
        <p className="text-sm text-slate2-600 mt-1">
          Taxas de conexão e prazos em tempo real — sem precisar publicar nova versão.
        </p>
      </div>

      {/* Promoção de lançamento */}
      <div className="bg-white border border-slate2-200 rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-slate2-800 flex items-center gap-2">
              <Percent className="w-4 h-4 text-accent-600" /> Promoção de lançamento
            </h2>
            <p className="text-xs text-slate2-500 mt-0.5">
              Com a promoção ativa, os apps exibem a taxa cheia riscada
              (&ldquo;de {Math.round(settings.fee_regular_pct * 1000) / 10}% por {Math.round(settings.fee_client_pct * 1000) / 10}%&rdquo;).
            </p>
          </div>
          <button
            onClick={() => setSettings({ ...settings, fee_promo_active: !settings.fee_promo_active })}
            className={`relative w-12 h-7 rounded-full transition-colors ${settings.fee_promo_active ? 'bg-accent-600' : 'bg-slate2-300'}`}
          >
            <span
              className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all ${settings.fee_promo_active ? 'left-6' : 'left-1'}`}
            />
          </button>
        </div>
      </div>

      {/* Percentuais */}
      <div className="bg-white border border-slate2-200 rounded-2xl p-5">
        <h2 className="font-semibold text-slate2-800 mb-4">Percentuais</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {PCT_FIELDS.map((f) => (
            <div key={f.key}>
              <label className="text-sm font-medium text-slate2-700">{f.label}</label>
              <div className="relative mt-1">
                <input
                  type="number"
                  step="0.5"
                  min={0}
                  value={Math.round((settings[f.key] as number) * 1000) / 10}
                  onChange={(e) => setPct(f.key, e.target.value)}
                  className="block w-full rounded-lg border-[1.5px] border-slate2-300 px-3 py-2.5 text-sm pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate2-400 text-sm">%</span>
              </div>
              <p className="text-[11px] text-slate2-400 mt-1">{f.hint}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Valores e prazos */}
      <div className="bg-white border border-slate2-200 rounded-2xl p-5">
        <h2 className="font-semibold text-slate2-800 mb-4">Valores e prazos</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-slate2-700">Taxa mínima por lado (R$)</label>
            <input
              type="number"
              step="0.1"
              min={0}
              value={settings.fee_min}
              onChange={(e) => {
                const v = parseFloat(e.target.value.replace(',', '.'))
                if (!isNaN(v)) setSettings({ ...settings, fee_min: v })
              }}
              className="mt-1 block w-full rounded-lg border-[1.5px] border-slate2-300 px-3 py-2.5 text-sm"
            />
            <p className="text-[11px] text-slate2-400 mt-1">Piso antifraude para propostas baratas</p>
          </div>
          <div>
            <label className="text-sm font-medium text-slate2-700">Prazo do prestador (horas)</label>
            <input
              type="number"
              step="1"
              min={1}
              max={168}
              value={settings.provider_fee_timeout_hours}
              onChange={(e) => {
                const v = parseFloat(e.target.value)
                if (!isNaN(v)) setSettings({ ...settings, provider_fee_timeout_hours: v })
              }}
              className="mt-1 block w-full rounded-lg border-[1.5px] border-slate2-300 px-3 py-2.5 text-sm"
            />
            <p className="text-[11px] text-slate2-400 mt-1">
              Depois disso o cliente é recreditado e o pedido reabre
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-slate2-700">Fotos por pedido</label>
            <input
              type="number"
              step="1"
              min={1}
              max={20}
              value={settings.max_order_photos}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10)
                if (!isNaN(v)) setSettings({ ...settings, max_order_photos: v })
              }}
              className="mt-1 block w-full rounded-lg border-[1.5px] border-slate2-300 px-3 py-2.5 text-sm"
            />
            <p className="text-[11px] text-slate2-400 mt-1">Opcionais em todos os serviços (1 a 20)</p>
          </div>
          <div>
            <label className="text-sm font-medium text-slate2-700">Fotos por etapa do serviço</label>
            <input
              type="number"
              step="1"
              min={1}
              max={20}
              value={settings.max_service_photos}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10)
                if (!isNaN(v)) setSettings({ ...settings, max_service_photos: v })
              }}
              className="mt-1 block w-full rounded-lg border-[1.5px] border-slate2-300 px-3 py-2.5 text-sm"
            />
            <p className="text-[11px] text-slate2-400 mt-1">Check-in e conclusão do prestador (1 a 20)</p>
          </div>
        </div>
      </div>

      <Button onClick={save} isLoading={saving} size="lg">
        <Save className="w-4 h-4 mr-2" /> Salvar configurações
      </Button>
    </div>
  )
}
