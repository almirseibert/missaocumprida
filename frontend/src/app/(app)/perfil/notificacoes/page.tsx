'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, BellRing } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useAuthStore } from '@/store/auth'
import { api, getApiErrorMessage } from '@/lib/api'
import {
  isPushSupported,
  subscribeAndRegisterWithBackend,
  unsubscribePush,
} from '@/lib/push'

const CHANNELS: Array<{ key: string; title: string; desc: string }> = [
  { key: 'new_proposal', title: 'Novas propostas', desc: 'Quando alguém envia uma proposta para seu pedido' },
  { key: 'proposal_update', title: 'Resposta a propostas', desc: 'Sua proposta foi aceita ou rejeitada' },
  { key: 'chat_message', title: 'Mensagens', desc: 'Novas mensagens no chat' },
  { key: 'schedule_update', title: 'Agendamentos', desc: 'Check-in, conclusão e confirmação de serviço' },
  { key: 'payment', title: 'Pagamentos', desc: 'Confirmações e liberações de saldo' },
  { key: 'urgent_orders', title: 'Pedidos urgentes', desc: 'Alertas de oportunidades urgentes na sua região' },
  { key: 'referral', title: 'Indicações', desc: 'Quando alguém usa seu código de indicação' },
  { key: 'cross_sell', title: 'Sugestões', desc: 'Sugestões de serviços complementares' },
  { key: 'general', title: 'Geral', desc: 'Outros avisos do sistema' },
]

export default function NotificacoesPage() {
  const router = useRouter()
  const { user, setUser } = useAuthStore()
  const [prefs, setPrefs] = useState<Record<string, boolean>>({})
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default')
  const [loading, setLoading] = useState(false)
  const [sub, setSub] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (!isPushSupported()) {
      setPermission('unsupported')
    } else {
      setPermission(Notification.permission)
    }
    const initial: Record<string, boolean> = {}
    const stored = (user?.notification_preferences ?? {}) as Record<string, boolean>
    CHANNELS.forEach((c) => {
      initial[c.key] = stored[c.key] !== false
    })
    setPrefs(initial)
  }, [user])

  async function toggle(key: string, value: boolean) {
    const next = { ...prefs, [key]: value }
    setPrefs(next)
    setLoading(true)
    setError('')
    try {
      const r = await api.put('/push/preferences', next)
      if (user) setUser({ ...user, notification_preferences: r.data.data.notification_preferences })
    } catch (err) {
      setError(getApiErrorMessage(err))
      setPrefs(prefs)
    } finally {
      setLoading(false)
    }
  }

  async function enablePush() {
    setSub(true)
    setError('')
    try {
      const ok = await subscribeAndRegisterWithBackend()
      if (ok) {
        setPermission('granted')
        setSuccess('Notificações ativadas neste navegador.')
      } else {
        setError('Não foi possível ativar. Verifique a permissão do navegador.')
      }
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setSub(false)
    }
  }

  async function disablePush() {
    setSub(true)
    try {
      await unsubscribePush()
      setSuccess('Notificações desativadas neste navegador.')
    } finally {
      setSub(false)
    }
  }

  async function sendTest() {
    setLoading(true)
    setSuccess('')
    setError('')
    try {
      await api.post('/push/test', {})
      setSuccess('Push de teste disparado! Aguarde alguns segundos.')
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-sm text-slate2-600 hover:text-slate2-900 mb-4"
      >
        <ArrowLeft size={16} /> Voltar
      </button>

      <h1 className="text-2xl font-bold mb-1">Notificações</h1>
      <p className="text-sm text-slate2-600 mb-6">
        Controle quais avisos você quer receber e em quais canais.
      </p>

      <Card className="p-5 mb-4">
        <div className="flex items-start gap-3">
          <BellRing className="text-brand-600 mt-1" size={22} />
          <div className="flex-1">
            <div className="font-semibold">Notificações no navegador</div>
            <div className="text-sm text-slate2-600 mt-1">
              {permission === 'unsupported' && 'Seu navegador não suporta push.'}
              {permission === 'default' && 'Ative para receber avisos mesmo com a aba fechada.'}
              {permission === 'granted' && 'Notificações ativadas neste navegador ✅'}
              {permission === 'denied' && 'Permissão bloqueada. Libere nas configurações do navegador.'}
            </div>
            <div className="flex gap-2 mt-3">
              {permission !== 'granted' && permission !== 'unsupported' && (
                <Button size="sm" isLoading={sub} onClick={enablePush}>Ativar</Button>
              )}
              {permission === 'granted' && (
                <>
                  <Button size="sm" variant="outline" isLoading={loading} onClick={sendTest}>
                    Enviar teste
                  </Button>
                  <Button size="sm" variant="ghost" isLoading={sub} onClick={disablePush}>
                    Desativar neste navegador
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </Card>

      {error && <div className="mb-4 text-sm text-red-600 bg-red-50 p-3 rounded">{error}</div>}
      {success && <div className="mb-4 text-sm text-emerald-700 bg-emerald-50 p-3 rounded">{success}</div>}

      <Card className="p-0 divide-y divide-slate2-100">
        {CHANNELS.map((c) => (
          <label key={c.key} className="flex items-start gap-3 p-4 cursor-pointer">
            <div className="flex-1">
              <div className="font-medium text-slate2-900">{c.title}</div>
              <div className="text-xs text-slate2-500 mt-0.5">{c.desc}</div>
            </div>
            <input
              type="checkbox"
              checked={prefs[c.key] !== false}
              onChange={(e) => toggle(c.key, e.target.checked)}
              disabled={loading}
              className="mt-1 w-5 h-5 accent-brand-600 cursor-pointer"
            />
          </label>
        ))}
      </Card>
    </div>
  )
}
