'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { api } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { PageSpinner } from '@/components/ui/Spinner'
import toast from 'react-hot-toast'
import { CheckCircle, Clock, Copy, CreditCard, QrCode, ShieldCheck } from 'lucide-react'

/**
 * Taxa de Conexão (Remap 2.0) — checkout do CLIENTE.
 * O cliente paga apenas a taxa (promoção de lançamento: 5% em vez de 10%)
 * para liberar o contato do profissional. O serviço é pago diretamente a ele.
 */

type FeeView = {
  status: string
  pct_applied: number
  regular_pct: number
  promo_active: boolean
  base_amount: number
  regular_amount: number
  credit_used: number
  expires_at?: string | null
}

type FeesData = {
  order_status: string
  viewer_side: 'CLIENT' | 'PROVIDER'
  final_price: number | null
  client_fee: FeeView | null
  provider_fee: FeeView | null
  provider_fee_due_at?: string | null
  contacts_unlocked: boolean
}

type CheckoutData = {
  pix_code?: string
  pix_qr_base64?: string | null
  init_point?: string | null
  amount: number
  base_amount: number
  credit_used: number
  surcharge_amount: number
  promo_active?: boolean
  regular_amount?: number
  dev_mode?: boolean
  covered_by_credit?: boolean
  already_paid?: boolean
}

function SimularTaxaButton({ orderId, onPaid }: { orderId: string; onPaid: () => void }) {
  const [loading, setLoading] = useState(false)
  async function simular() {
    setLoading(true)
    try {
      await api.post('/payments/fees/simulate', { order_id: orderId })
      onPaid()
    } catch {
      toast.error('Erro ao simular pagamento')
    } finally {
      setLoading(false)
    }
  }
  return (
    <Button size="sm" onClick={simular} isLoading={loading} className="w-full bg-amber-600 hover:bg-amber-700">
      Simular confirmação do PIX (dev)
    </Button>
  )
}

export default function TaxaConexaoPage() {
  const router = useRouter()
  const params = useParams<{ orderId: string }>()
  const orderId = params.orderId

  const [fees, setFees] = useState<FeesData | null>(null)
  const [checkout, setCheckout] = useState<CheckoutData | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState<'' | 'pix' | 'card'>('')
  const [copied, setCopied] = useState(false)

  const loadFees = useCallback(async () => {
    try {
      const res = await api.get(`/payments/fees/order/${orderId}`)
      setFees(res.data.data)
    } catch {
      // pedido sem taxas (fluxo antigo) ou sem acesso
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => { loadFees() }, [loadFees])
  useEffect(() => {
    const interval = setInterval(loadFees, 5000)
    return () => clearInterval(interval)
  }, [loadFees])

  async function gerarPix() {
    setGenerating('pix')
    try {
      const res = await api.post('/payments/fees/checkout', { order_id: orderId, method: 'pix' })
      const d: CheckoutData = res.data.data
      if (d.already_paid || d.covered_by_credit) {
        if (d.covered_by_credit) toast.success('Taxa coberta pelo seu crédito!')
        await loadFees()
        return
      }
      setCheckout(d)
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao gerar o PIX')
    } finally {
      setGenerating('')
    }
  }

  async function pagarComCartao() {
    setGenerating('card')
    try {
      const res = await api.post('/payments/fees/checkout', { order_id: orderId, method: 'card' })
      const d: CheckoutData = res.data.data
      if (d.already_paid || d.covered_by_credit) {
        if (d.covered_by_credit) toast.success('Taxa coberta pelo seu crédito!')
        await loadFees()
        return
      }
      if (d.init_point) {
        // Checkout Pro do Mercado Pago; ao voltar, o polling detecta a confirmação
        window.location.href = d.init_point
        return
      }
      if (d.dev_mode) {
        setCheckout(d)
        toast('Modo desenvolvimento — confirme pela simulação abaixo.', { icon: '⚠️' })
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao iniciar o checkout com cartão')
    } finally {
      setGenerating('')
    }
  }

  function copyCode() {
    if (!checkout?.pix_code) return
    navigator.clipboard.writeText(checkout.pix_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  if (loading) return <PageSpinner />
  if (!fees || !fees.client_fee) {
    return (
      <div className="max-w-lg mx-auto py-10 text-center text-slate2-500">
        Este pedido não possui taxa de conexão pendente.
      </div>
    )
  }

  const clientFee = fees.client_fee
  const clientPaid = ['PAID', 'COVERED'].includes(clientFee.status)

  // ---- Contato liberado ----
  if (fees.contacts_unlocked) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center space-y-4">
        <CheckCircle className="w-16 h-16 text-accent-600 mx-auto" />
        <h1 className="text-2xl font-bold text-slate2-900">Contato liberado!</h1>
        <p className="text-slate2-500">
          O profissional confirmou. Telefone, endereço e chat já estão disponíveis.
          O pagamento do serviço é combinado diretamente com ele.
        </p>
        <Button onClick={() => router.push(`/pedido/${orderId}`)}>Ver pedido</Button>
      </div>
    )
  }

  // ---- Cliente pagou, aguardando prestador ----
  if (clientPaid) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center space-y-4">
        <Clock className="w-16 h-16 text-brand-600 mx-auto" />
        <h1 className="text-2xl font-bold text-slate2-900">Aguardando o profissional</h1>
        <p className="text-slate2-500">
          Sua taxa foi confirmada. Agora o profissional paga a taxa dele para o
          contato ser liberado dos dois lados.
        </p>
        {fees.provider_fee_due_at && (
          <p className="text-sm text-slate2-400">
            Prazo do profissional: {new Date(fees.provider_fee_due_at).toLocaleString('pt-BR')}
          </p>
        )}
        <div className="bg-trust-50 border border-trust-100 rounded-xl p-4 text-sm text-trust-700 flex items-start gap-2 text-left">
          <ShieldCheck className="w-5 h-5 flex-shrink-0" />
          <span>
            Garantia de Conexão: se ele não confirmar no prazo, sua taxa volta como
            crédito automaticamente e você escolhe outra proposta.
          </span>
        </div>
      </div>
    )
  }

  const pctLabel = `${Math.round(clientFee.pct_applied * 100)}%`
  const regularLabel = `${Math.round(clientFee.regular_pct * 100)}%`

  return (
    <div className="max-w-lg mx-auto space-y-4 pb-10">
      <h1 className="text-2xl font-bold text-slate2-900">Taxa de Conexão</h1>
      <p className="text-sm text-slate2-500 -mt-2">
        Você paga apenas a taxa para liberar o contato do profissional. O serviço
        é pago diretamente a ele, do jeito que vocês combinarem.
      </p>

      {/* Breakdown com promo riscada */}
      <Card>
        <CardBody className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate2-500">Valor da proposta</span>
            <span className="font-medium text-slate2-800">{formatCurrency(fees.final_price ?? 0)}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate2-500">
              Taxa de conexão ({pctLabel})
              {clientFee.promo_active && (
                <span className="ml-2 text-[10px] font-bold text-accent-700 bg-accent-50 rounded-full px-2 py-0.5">
                  PROMOÇÃO DE LANÇAMENTO
                </span>
              )}
            </span>
            <span className="text-right">
              {clientFee.promo_active && (
                <span className="block text-xs text-slate2-400 line-through">
                  {regularLabel} = {formatCurrency(clientFee.regular_amount)}
                </span>
              )}
              <span className="font-bold text-accent-700">{formatCurrency(clientFee.base_amount)}</span>
            </span>
          </div>
          <p className="text-xs text-slate2-400 border-t border-slate2-100 pt-2">
            + repasse do meio de pagamento (1% Pix · 4% cartão) · seus créditos são abatidos automaticamente
          </p>
        </CardBody>
      </Card>

      <div className="bg-trust-50 border border-trust-100 rounded-xl p-4 text-sm text-trust-700 flex items-start gap-2">
        <ShieldCheck className="w-5 h-5 flex-shrink-0" />
        <span>
          Garantia de Conexão: se o profissional cancelar ou não confirmar, sua
          taxa volta como crédito automaticamente.
        </span>
      </div>

      {!checkout ? (
        <div className="space-y-2.5">
          <Button onClick={gerarPix} isLoading={generating === 'pix'} disabled={generating !== ''} className="w-full" size="lg">
            <QrCode className="w-5 h-5 mr-2" /> Pagar taxa com Pix (+1%)
          </Button>
          <Button
            variant="secondary"
            onClick={pagarComCartao}
            isLoading={generating === 'card'}
            disabled={generating !== ''}
            className="w-full"
            size="lg"
          >
            <CreditCard className="w-5 h-5 mr-2" /> Pagar com cartão (+4%)
          </Button>
        </div>
      ) : (
        <Card>
          <CardBody className="space-y-4">
            <div className="text-center">
              <p className="text-xs uppercase tracking-wider text-slate2-400">Total a pagar</p>
              <p className="text-3xl font-extrabold text-slate2-900">{formatCurrency(checkout.amount)}</p>
              {checkout.promo_active && checkout.regular_amount ? (
                <p className="text-xs text-slate2-400 line-through mt-1">
                  sem promoção: {formatCurrency(checkout.regular_amount)}
                </p>
              ) : null}
            </div>

            <div className="text-sm space-y-1.5 border-y border-slate2-100 py-3">
              <div className="flex justify-between">
                <span className="text-slate2-500">Taxa de conexão</span>
                <span>{formatCurrency(checkout.base_amount)}</span>
              </div>
              {checkout.credit_used > 0 && (
                <div className="flex justify-between text-accent-700">
                  <span>Crédito aplicado</span>
                  <span>− {formatCurrency(checkout.credit_used)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate2-500">
                <span>Repasse Pix (1%)</span>
                <span>+ {formatCurrency(checkout.surcharge_amount)}</span>
              </div>
            </div>

            {checkout.pix_qr_base64 && (
              <div className="flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`data:image/png;base64,${checkout.pix_qr_base64}`}
                  alt="QR Code PIX"
                  className="w-52 h-52 border-2 border-slate2-200 rounded-2xl p-2"
                />
              </div>
            )}

            {checkout.pix_code && (
              <div className="space-y-2">
                <p className="text-xs text-slate2-500 font-mono bg-slate2-50 border border-slate2-200 rounded-lg p-2 break-all line-clamp-3">
                  {checkout.pix_code}
                </p>
                <Button variant="secondary" onClick={copyCode} className="w-full">
                  <Copy className="w-4 h-4 mr-2" />
                  {copied ? 'Código copiado!' : 'Copiar código PIX'}
                </Button>
              </div>
            )}

            {checkout.dev_mode && <SimularTaxaButton orderId={orderId} onPaid={loadFees} />}

            <p className="text-xs text-accent-700 bg-accent-50 border border-accent-100 rounded-lg p-2.5 text-center">
              Aguardando o pagamento — confirmação automática. Depois avisamos o
              profissional para ele pagar a taxa dele.
            </p>
          </CardBody>
        </Card>
      )}
    </div>
  )
}
