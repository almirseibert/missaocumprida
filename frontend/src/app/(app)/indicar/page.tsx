'use client'

import { useEffect, useState } from 'react'
import { Gift, Copy, Share2, Check, Wallet, Users } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { PageSpinner } from '@/components/ui/Spinner'
import { api, getApiErrorMessage } from '@/lib/api'
import { formatCurrency, formatDate } from '@/lib/utils'

interface ReferralEvent {
  id: string
  status: 'PENDING' | 'COMPLETED' | 'EXPIRED'
  created_at: string
  completed_at: string | null
  referrer_reward: number
  referred_reward: number
  referred: { id: string; name: string; avatar: string | null }
}
interface MyCodeData {
  code: string
  share_url: string
  deep_link: string
  credit_balance: number
  stats: { pending: number; completed: number; total: number }
  events: ReferralEvent[]
}

export default function IndicarPage() {
  const [data, setData] = useState<MyCodeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    api.get('/referrals/my-code')
      .then((r) => setData(r.data.data))
      .catch((e) => setError(getApiErrorMessage(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <PageSpinner />
  if (error || !data) return <div className="text-red-600">{error || 'Erro'}</div>

  function copyCode() {
    if (!data) return
    navigator.clipboard.writeText(data.share_url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  async function shareNative() {
    if (!data) return
    const text = `Use meu código ${data.code} e ganhe R$ 20 no Missão Cumprida! ${data.share_url}`
    if (navigator.share) {
      try { await navigator.share({ title: 'Missão Cumprida', text, url: data.share_url }) } catch {}
    } else {
      copyCode()
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">Indique e ganhe</h1>
      <p className="text-slate2-600 mb-6">
        Compartilhe seu código. Para cada amigo que completar o 1º serviço, você ganha <strong>R$ 30</strong> e ele recebe <strong>R$ 20</strong> de desconto.
      </p>

      {/* Saldo + código */}
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <Card className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
              <Wallet className="text-emerald-700" size={20} />
            </div>
            <div>
              <div className="text-xs text-slate2-500">Seu saldo</div>
              <div className="text-2xl font-extrabold text-emerald-700">{formatCurrency(data.credit_balance)}</div>
            </div>
          </div>
          <div className="text-xs text-slate2-500">Use no próximo pedido para abater do valor.</div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center">
              <Users className="text-brand-700" size={20} />
            </div>
            <div>
              <div className="text-xs text-slate2-500">Indicações</div>
              <div className="text-sm">
                <span className="font-bold text-brand-700">{data.stats.completed}</span> completas
                {' · '}
                <span className="text-amber-600">{data.stats.pending}</span> pendentes
              </div>
            </div>
          </div>
          <div className="text-xs text-slate2-500">Pendentes viram crédito quando o amigo completar o 1º serviço.</div>
        </Card>
      </div>

      {/* Compartilhar */}
      <Card className="p-5 mb-6">
        <div className="flex items-center gap-3 mb-3">
          <Gift className="text-brand-600" size={22} />
          <div className="font-semibold">Seu código</div>
        </div>
        <div className="flex items-stretch gap-2 mb-3">
          <div className="flex-1 px-4 py-3 bg-slate2-50 border border-slate2-200 rounded-xl">
            <div className="text-xs text-slate2-500">CÓDIGO</div>
            <div className="text-xl font-extrabold tracking-wider text-brand-700">{data.code}</div>
          </div>
          <Button onClick={copyCode} variant="outline" className="self-stretch">
            {copied ? <><Check size={16} className="mr-1" /> Copiado</> : <><Copy size={16} className="mr-1" /> Copiar link</>}
          </Button>
          <Button onClick={shareNative} className="self-stretch">
            <Share2 size={16} className="mr-1" /> Compartilhar
          </Button>
        </div>
        <div className="text-xs text-slate2-500 break-all">{data.share_url}</div>
      </Card>

      {/* Histórico */}
      <Card className="p-0">
        <div className="p-4 border-b border-slate2-100 font-semibold">Histórico</div>
        {data.events.length === 0 && (
          <div className="p-6 text-center text-sm text-slate2-500">Você ainda não indicou ninguém.</div>
        )}
        {data.events.map((e) => (
          <div key={e.id} className="p-4 border-b border-slate2-100 last:border-0 flex items-center gap-3">
            <Avatar avatar={e.referred.avatar ?? undefined} name={e.referred.name} size="md" />
            <div className="flex-1">
              <div className="font-medium">{e.referred.name}</div>
              <div className="text-xs text-slate2-500">
                Indicado em {formatDate(e.created_at)}
                {e.completed_at && ` · concluído em ${formatDate(e.completed_at)}`}
              </div>
            </div>
            {e.status === 'COMPLETED' ? (
              <Badge variant="green">+ {formatCurrency(e.referrer_reward)}</Badge>
            ) : e.status === 'PENDING' ? (
              <Badge variant="amber">Pendente</Badge>
            ) : (
              <Badge variant="gray">Expirado</Badge>
            )}
          </div>
        ))}
      </Card>
    </div>
  )
}
