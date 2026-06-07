'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck, Check, X, Star, TrendingUp, Award } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PageSpinner } from '@/components/ui/Spinner'
import { api, getApiErrorMessage } from '@/lib/api'
import { toast } from 'react-hot-toast'

const BENEFITS = [
  { icon: ShieldCheck, title: 'Selo Verificado ✓ azul', desc: 'Visível em perfil, propostas e cards do feed.' },
  { icon: Star, title: 'Boost gratuito de nível 1', desc: 'Suas propostas sempre aparecem com destaque.' },
  { icon: TrendingUp, title: '1.3x na posição da busca', desc: 'Mais visibilidade nos resultados orgânicos.' },
  { icon: Award, title: 'Antecedentes verificados', desc: 'Clientes confiam mais e contratam mais rápido.' },
]

export default function VerificarPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<any>(null)
  const [step, setStep] = useState<'landing' | 'form' | 'subscribe'>('landing')
  const [fullName, setFullName] = useState('')
  const [docNumber, setDocNumber] = useState('')
  const [consent, setConsent] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    try {
      const res = await api.get('/verification/me')
      setStatus(res.data.data)
      if (res.data.data?.verification_data && !res.data.data?.active_subscription) setStep('subscribe')
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  async function submitData() {
    if (!consent) return toast.error('É necessário consentir com a checagem de antecedentes')
    setSubmitting(true)
    try {
      await api.post('/verification/start', {
        full_name: fullName, document_number: docNumber, background_check_consent: consent,
      })
      toast.success('Dados recebidos. Próximo passo: ativar assinatura.')
      setStep('subscribe')
      await load()
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function activate() {
    setSubmitting(true)
    try {
      await api.post('/verification/subscribe', { payment_method: 'PIX' })
      toast.success('Selo Verificado Pro ativado!')
      await load()
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function cancel() {
    if (!confirm('Cancelar Verificado Pro? O selo será removido imediatamente.')) return
    setSubmitting(true)
    try {
      await api.post('/verification/cancel', {})
      toast.success('Assinatura cancelada')
      await load()
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <PageSpinner />

  const isPro = status?.is_verified_pro && status?.active_subscription

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <div className="text-center py-6">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-blue-600 mb-3">
          <ShieldCheck className="w-12 h-12 text-white" />
        </div>
        <h1 className="text-3xl font-bold">Profissional Verificado</h1>
        <p className="text-slate2-600 mt-2">Conquiste mais clientes com o selo de confiança.</p>
        <p className="text-2xl font-bold text-blue-600 mt-3">R$ 29,90<span className="text-sm text-slate2-500">/mês</span></p>
      </div>

      {isPro && (
        <Card className="p-5 bg-emerald-50 border-emerald-300">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-10 h-10 text-emerald-600" />
            <div className="flex-1">
              <h2 className="font-bold text-emerald-900">Você é Verificado Pro ✓</h2>
              <p className="text-sm text-emerald-700">
                Ativo até {new Date(status.active_subscription.current_period_end).toLocaleDateString('pt-BR')}
              </p>
            </div>
            <Button variant="ghost" onClick={cancel} disabled={submitting} className="text-rose-600">
              <X className="w-4 h-4" /> Cancelar
            </Button>
          </div>
        </Card>
      )}

      {!isPro && (
        <>
          <Card className="p-6">
            <h2 className="font-bold text-lg mb-4">Benefícios inclusos</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {BENEFITS.map((b) => (
                <div key={b.title} className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                    <b.icon className="w-5 h-5 text-blue-700" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{b.title}</h3>
                    <p className="text-xs text-slate2-600">{b.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {step === 'landing' && (
            <Button onClick={() => setStep('form')} className="w-full" size="lg">
              Quero ser Verificado Pro
            </Button>
          )}

          {step === 'form' && (
            <Card className="p-6 space-y-3">
              <h2 className="font-bold">Dados para verificação</h2>
              <div>
                <label className="text-xs text-slate2-600">Nome completo</label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-slate2-600">CPF</label>
                <Input value={docNumber} onChange={(e) => setDocNumber(e.target.value)} placeholder="000.000.000-00" />
              </div>
              <label className="flex items-start gap-2 pt-2 cursor-pointer">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" />
                <span className="text-sm text-slate2-700">
                  Autorizo a Missão Cumprida a consultar meus antecedentes cíveis e criminais.
                </span>
              </label>
              <Button onClick={submitData} disabled={submitting || !fullName || !docNumber} className="w-full">
                {submitting ? 'Enviando...' : 'Enviar dados'}
              </Button>
            </Card>
          )}

          {step === 'subscribe' && (
            <Card className="p-6 text-center space-y-3">
              <Check className="w-10 h-10 text-emerald-600 mx-auto" />
              <h2 className="font-bold">Dados recebidos!</h2>
              <p className="text-sm text-slate2-600">Ative agora sua assinatura mensal de R$ 29,90 para começar a usar o selo.</p>
              <Button onClick={activate} disabled={submitting} className="w-full" size="lg">
                {submitting ? 'Ativando...' : 'Ativar Verificado Pro — R$ 29,90/mês'}
              </Button>
              <p className="text-[11px] text-slate2-500">
                Cobrança recorrente mensal. Cancele a qualquer momento.
              </p>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
