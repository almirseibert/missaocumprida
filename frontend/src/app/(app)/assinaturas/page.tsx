'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ShieldCheck, Check, AlertTriangle, Smartphone, RefreshCw, Repeat } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { api, getApiErrorMessage } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { PageSpinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import { formatCurrency, formatDate } from '@/lib/utils'
import { usePublicConfig } from '@/hooks/usePublicConfig'

/**
 * Assinaturas — central da assinatura Pro (clientes e prestadores).
 * A compra é feita no app Android (Google Play). Aqui o usuário vê o status,
 * os benefícios do perfil dele e como assinar/gerenciar.
 */
const PLAY_APP_URL = 'https://play.google.com/store/apps/details?id=com.missaocumpridabr.app'
const PLAY_SUBSCRIPTIONS_URL = 'https://play.google.com/store/account/subscriptions?package=com.missaocumpridabr.app'

type ProStatus = {
  role: string
  pro: {
    active: boolean
    expires_at: string | null
    since: string | null
    source: 'PLAY' | 'ADMIN' | null
    will_renew: boolean
    billing_issue: boolean
  }
  eligible: boolean
  ineligible_reason: string | null
  monthly_value: number
  benefits: { client: string[]; provider: string[] }
}

export default function AssinaturasPage() {
  const { user, fetchMe } = useAuthStore()
  const { recurring_enabled: recurringEnabled } = usePublicConfig()
  const [status, setStatus] = useState<ProStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  async function load() {
    try {
      const res = await api.get('/verification/me')
      setStatus(res.data.data)
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  async function sync() {
    setSyncing(true)
    try {
      const res = await api.post('/verification/sync')
      setStatus(res.data.data)
      await fetchMe?.()
      toast.success(res.data.data?.synced ? 'Assinatura conferida com a Google Play' : 'Status atualizado')
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setSyncing(false)
    }
  }

  if (loading) return <PageSpinner />
  if (!status) return null

  const isProvider = status.role === 'PROVIDER' || status.role === 'BOTH' || user?.role === 'PROVIDER' || user?.role === 'BOTH'
  const benefits = isProvider ? status.benefits.provider : status.benefits.client
  const pro = status.pro

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate2-900 flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-blue-600" /> Assinatura Pro
        </h1>
        <p className="text-sm text-slate2-600 mt-1">
          {isProvider ? 'Mais visibilidade e confiança para fechar mais serviços.' : 'Economia na taxa de conexão e prioridade no atendimento.'}
        </p>
      </div>

      {/* Status */}
      <div className={`rounded-2xl border p-5 ${pro.active ? 'border-blue-200 bg-blue-50' : 'border-slate2-200 bg-white'}`}>
        {pro.active ? (
          <>
            <p className="font-semibold text-blue-900 flex items-center gap-2"><Check className="w-5 h-5" /> Você é Pro</p>
            <p className="text-sm text-blue-800 mt-1">
              {pro.source === 'ADMIN'
                ? `Selo concedido pela equipe${pro.expires_at ? ` até ${formatDate(pro.expires_at)}` : ''}.`
                : pro.will_renew
                  ? `Renova automaticamente${pro.expires_at ? ` em ${formatDate(pro.expires_at)}` : ''}.`
                  : `Renovação cancelada — o selo fica ativo até ${pro.expires_at ? formatDate(pro.expires_at) : 'o fim do período pago'}.`}
            </p>
            {pro.billing_issue && (
              <p className="text-sm text-amber-800 mt-2 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5" />
                Não conseguimos cobrar a renovação. Atualize a forma de pagamento na Google Play para não perder o selo.
              </p>
            )}
          </>
        ) : (
          <>
            <p className="font-semibold text-slate2-900">Você ainda não é Pro</p>
            <p className="text-sm text-slate2-600 mt-1">{formatCurrency(status.monthly_value)}/mês, cancele quando quiser.</p>
          </>
        )}
      </div>

      {/* Benefícios */}
      <div className="bg-white rounded-2xl border border-slate2-200 p-5">
        <h2 className="font-semibold text-slate2-800 mb-3">O que você ganha</h2>
        <ul className="space-y-2">
          {benefits.map((b) => (
            <li key={b} className="flex items-start gap-2 text-sm text-slate2-700">
              <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" /> {b}
            </li>
          ))}
        </ul>
        {!isProvider && (
          <p className="text-xs text-slate2-500 mt-3">
            Também oferece serviços? Ative o perfil de prestador em{' '}
            <Link href="/perfil/editar" className="text-brand-700 underline">Meu perfil</Link> para ter os benefícios de profissional.
          </p>
        )}
      </div>

      {/* Como assinar / gerenciar */}
      <div className="bg-white rounded-2xl border border-slate2-200 p-5 space-y-3">
        {!pro.active && !status.eligible && status.ineligible_reason && (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
            {status.ineligible_reason}{' '}
            <Link href="/verificacao" className="underline font-medium">Enviar documentos</Link>
          </p>
        )}
        {!pro.active && (
          <div className="flex items-start gap-3">
            <Smartphone className="w-5 h-5 text-slate2-500 mt-0.5" />
            <div className="text-sm text-slate2-700">
              A assinatura é feita pelo aplicativo <strong>Missão Cumprida</strong> no Android, com pagamento pela Google Play.
              <div className="mt-2">
                <a href={PLAY_APP_URL} target="_blank" rel="noopener noreferrer" className="text-brand-700 font-semibold underline">
                  Abrir o app na Google Play
                </a>
              </div>
            </div>
          </div>
        )}
        {pro.active && pro.source !== 'ADMIN' && (
          <a href={PLAY_SUBSCRIPTIONS_URL} target="_blank" rel="noopener noreferrer" className="inline-block text-sm text-brand-700 font-semibold underline">
            Gerenciar ou cancelar na Google Play
          </a>
        )}
        <div>
          <Button variant="secondary" size="sm" onClick={sync} isLoading={syncing}>
            <RefreshCw className="w-4 h-4" /> Já assinei — atualizar status
          </Button>
        </div>
        <p className="text-xs text-slate2-400">
          Assinatura mensal renovada automaticamente pela Google Play até você cancelar. Ao assinar você concorda com os{' '}
          <Link href="/termos" className="underline">Termos de Uso</Link> e a{' '}
          <Link href="/privacidade" className="underline">Política de Privacidade</Link>.
        </p>
      </div>

      {recurringEnabled && (
        <Link href="/assinaturas/recorrentes" className="flex items-center gap-2 text-sm text-slate2-600 hover:text-slate2-900">
          <Repeat className="w-4 h-4" /> Serviços recorrentes contratados
        </Link>
      )}
    </div>
  )
}
