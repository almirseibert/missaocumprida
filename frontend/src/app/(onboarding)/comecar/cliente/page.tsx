'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MapPin, Search, ShoppingBag, Star, Check, ArrowRight } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useAuthStore } from '@/store/auth'
import { api, getApiErrorMessage } from '@/lib/api'

const TOTAL_STEPS = 3

export default function OnboardingClientePage() {
  const router = useRouter()
  const { user, setUser } = useAuthStore()
  const [step, setStep] = useState<number>(
    (user?.onboarding_state?.client?.step as number) ?? 0
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function patchState(next: number, completed = false, data?: Record<string, unknown>) {
    setLoading(true)
    setError('')
    try {
      const r = await api.put('/users/me/onboarding', {
        flow: 'client',
        step: next,
        completed,
        data,
      })
      if (user) setUser({ ...user, onboarding_state: r.data.data.onboarding_state })
    } catch (err) {
      setError(getApiErrorMessage(err))
      throw err
    } finally {
      setLoading(false)
    }
  }

  async function handleSkip() {
    try { await patchState(step, true, { skipped: true }) } catch { /* segue para o home mesmo assim */ }
    router.replace('/home')
  }

  async function advance() {
    if (step >= TOTAL_STEPS - 1) {
      try { await patchState(TOTAL_STEPS, true) } catch { return }
      router.replace('/home')
    } else {
      try { await patchState(step + 1) } catch { return }
      setStep(step + 1)
    }
  }

  async function useLocation() {
    if (!navigator.geolocation) {
      setError('Geolocalização indisponível neste navegador.')
      return
    }
    setLoading(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await api.put('/users/me', {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          })
          await advance()
        } catch (err) {
          setError(getApiErrorMessage(err))
          setLoading(false)
        }
      },
      () => {
        setError('Permissão de localização negada.')
        setLoading(false)
      }
    )
  }

  return (
    <div>
      <Progress current={step + 1} total={TOTAL_STEPS} />

      {step === 0 && (
        <StepShell
          title="Como funciona"
          subtitle="3 passos simples para resolver seu serviço."
          icon={<ShoppingBag className="text-brand-600" size={28} />}
        >
          <ol className="space-y-4 mb-6">
            <Item icon={<Search size={18} />} title="1. Peça" desc="Escolha o serviço e descreva o que precisa." />
            <Item icon={<ShoppingBag size={18} />} title="2. Receba propostas" desc="Prestadores próximos enviam orçamentos." />
            <Item icon={<Star size={18} />} title="3. Avalie" desc="Pague seguro pelo app e avalie no fim." />
          </ol>
          <Button onClick={advance} isLoading={loading} className="w-full">
            Continuar <ArrowRight size={16} className="ml-1" />
          </Button>
        </StepShell>
      )}

      {step === 1 && (
        <StepShell
          title="Sua localização"
          subtitle="Para encontrar prestadores perto de você."
          icon={<MapPin className="text-brand-600" size={28} />}
        >
          <p className="text-sm text-slate2-600 mb-4">
            Liberar a localização ajuda o app a recomendar profissionais qualificados
            no seu raio e estimar valores mais precisos.
          </p>
          <div className="flex gap-2">
            <Button onClick={useLocation} isLoading={loading} className="flex-1">
              Usar minha localização
            </Button>
            <Button variant="outline" onClick={advance} disabled={loading}>
              Pular
            </Button>
          </div>
        </StepShell>
      )}

      {step === 2 && (
        <StepShell
          title="Pronto!"
          subtitle="Você já pode pedir seu primeiro serviço."
          icon={<Check className="text-emerald-600" size={28} />}
        >
          <p className="text-sm text-slate2-600 mb-6">
            Comece pela tela inicial — ali estão todas as categorias e busca rápida.
          </p>
          <Button onClick={advance} isLoading={loading} className="w-full">
            Ir para o início
          </Button>
        </StepShell>
      )}

      {error && <div className="mt-4 text-sm text-red-600">{error}</div>}

      <button
        onClick={handleSkip}
        disabled={loading}
        className="mt-6 text-sm text-slate2-500 hover:text-slate2-700 disabled:opacity-50"
      >
        Pular por enquanto
      </button>
    </div>
  )
}

function Progress({ current, total }: { current: number; total: number }) {
  const pct = Math.min(100, Math.round((current / total) * 100))
  return (
    <div className="mb-6">
      <div className="flex justify-between text-xs text-slate2-500 mb-2">
        <span>Passo {Math.min(current, total)} de {total}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 bg-slate2-100 rounded-full overflow-hidden">
        <div className="h-full bg-brand-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function StepShell({
  title, subtitle, icon, children,
}: {
  title: string; subtitle: string; icon: React.ReactNode; children: React.ReactNode
}) {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-12 h-12 rounded-full bg-brand-50 flex items-center justify-center">{icon}</div>
        <div>
          <div className="text-xl font-bold">{title}</div>
          <div className="text-sm text-slate2-600">{subtitle}</div>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </Card>
  )
}

function Item({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <li className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div>
        <div className="font-semibold text-sm">{title}</div>
        <div className="text-xs text-slate2-600">{desc}</div>
      </div>
    </li>
  )
}
