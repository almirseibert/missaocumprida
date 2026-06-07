'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { loadStripe } from '@stripe/stripe-js'
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'
import { api } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { PageSpinner } from '@/components/ui/Spinner'
import toast from 'react-hot-toast'
import { CheckCircle, AlertCircle, Lock, CreditCard, QrCode } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import type { Order } from '@/types'

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null

const PIX_ACCOUNT = 'lezinho_3010@hotmail.com'

type CheckoutData = {
  client_secret?: string
  pix_code?: string
  pix_qr_base64?: string | null
  mp_payment_id?: string
  amount: number
  base_amount: number
  gateway_fee_pct: number
  gateway_fee: number
  payment_method: string
  dev_mode?: boolean
}

// ---------------------------------------------------------------------------
// Botão de simulação de pagamento (apenas desenvolvimento)
// ---------------------------------------------------------------------------
function SimularPagamentoButton({ orderId, onPaid }: { orderId: string; onPaid: () => void }) {
  const [loading, setLoading] = useState(false)
  async function simular() {
    setLoading(true)
    try {
      await api.post('/payments/simulate', { order_id: orderId })
      onPaid()
    } catch {
      toast.error('Erro ao simular pagamento')
    } finally {
      setLoading(false)
    }
  }
  return (
    <Button size="sm" onClick={simular} isLoading={loading} className="w-full bg-amber-600 hover:bg-amber-700">
      Simular confirmação do PIX
    </Button>
  )
}

// ---------------------------------------------------------------------------
// Pagamento via PIX — Mercado Pago
// ---------------------------------------------------------------------------
function PixCheckoutForm({ checkout, orderId }: { checkout: CheckoutData; orderId: string }) {
  const router = useRouter()
  const [copied, setCopied] = useState(false)
  const [polling, setPolling] = useState(true)

  // Polling: verifica se o pagamento foi confirmado a cada 5s
  useEffect(() => {
    if (!polling) return
    const interval = setInterval(async () => {
      try {
        const res = await api.get(`/payments/order/${orderId}`)
        const status = res.data.data?.status
        if (status === 'PAID' || status === 'RELEASED') {
          setPolling(false)
          toast.success('Pagamento PIX confirmado!')
          router.push(`/pedido/${orderId}`)
        }
      } catch { /* ignora */ }
    }, 5000)
    return () => clearInterval(interval)
  }, [polling, orderId, router])

  function copyCode() {
    if (!checkout.pix_code) return
    navigator.clipboard.writeText(checkout.pix_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const feePctLabel = `${Math.round(checkout.gateway_fee_pct * 100)}%`

  return (
    <div className="space-y-5">
      <div className="bg-slate2-50 rounded-xl p-4 space-y-2 text-sm">
        <div className="flex justify-between text-slate2-600">
          <span>Valor do serviço (c/ taxa plataforma)</span>
          <span>{formatCurrency(checkout.base_amount)}</span>
        </div>
        <div className="flex justify-between text-slate2-500">
          <span>Taxa de processamento ({feePctLabel} — PIX)</span>
          <span>+ {formatCurrency(checkout.gateway_fee)}</span>
        </div>
        <div className="flex justify-between border-t pt-2 font-bold text-base">
          <span>Total</span>
          <span className="text-green-600">{formatCurrency(checkout.amount)}</span>
        </div>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-4 text-center">
        <p className="text-sm font-semibold text-green-800">Escaneie o QR Code ou use o código Copia e Cola</p>

        {checkout.pix_qr_base64 && (
          <div className="flex justify-center">
            <img
              src={`data:image/png;base64,${checkout.pix_qr_base64}`}
              alt="QR Code PIX"
              className="w-48 h-48 rounded-lg border border-green-200"
            />
          </div>
        )}

        {checkout.pix_code && (
          <div className="space-y-2">
            <div className="bg-white border border-green-200 rounded-lg p-3 text-xs text-slate2-600 break-all font-mono select-all text-left">
              {checkout.pix_code}
            </div>
            <Button variant="outline" size="sm" onClick={copyCode} className="w-full">
              {copied ? '✓ Código copiado!' : 'Copiar código PIX'}
            </Button>
          </div>
        )}

        <div className="flex items-center justify-center gap-2 text-xs text-green-700">
          <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
          <span>Aguardando confirmação do pagamento…</span>
        </div>

        {checkout.dev_mode && (
          <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 space-y-2">
            <p className="text-xs font-bold text-amber-800">⚠ Modo desenvolvimento — PIX simulado</p>
            <p className="text-xs text-amber-700">O QR Code acima é fictício. Use o botão abaixo para simular a confirmação do pagamento.</p>
            <SimularPagamentoButton orderId={orderId} onPaid={() => {
              setPolling(false)
              toast.success('Pagamento PIX confirmado!')
              router.push(`/pedido/${orderId}`)
            }} />
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Formulário de pagamento (dentro do Elements provider)
// ---------------------------------------------------------------------------
function CheckoutForm({ checkout, orderId }: { checkout: CheckoutData; orderId: string }) {
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return

    setLoading(true)
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/pagamento/${orderId}`,
      },
    })

    if (error) {
      toast.error(error.message ?? 'Erro ao processar pagamento')
      setLoading(false)
    }
  }

  const feePctLabel = `${Math.round(checkout.gateway_fee_pct * 100)}%`

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Breakdown */}
      <div className="bg-slate2-50 rounded-xl p-4 space-y-2 text-sm">
        <div className="flex justify-between text-slate2-600">
          <span>Valor do serviço (c/ taxa plataforma)</span>
          <span>{formatCurrency(checkout.base_amount)}</span>
        </div>
        <div className="flex justify-between text-slate2-500">
          <span>
            Taxa de processamento ({feePctLabel} —{' '}
            {checkout.payment_method === 'pix' ? 'PIX' : 'Cartão'})
          </span>
          <span>+ {formatCurrency(checkout.gateway_fee)}</span>
        </div>
        <div className="flex justify-between border-t pt-2 font-bold text-base">
          <span>Total</span>
          <span className="text-brand-700">{formatCurrency(checkout.amount)}</span>
        </div>
      </div>

      {checkout.payment_method === 'pix' && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-xs text-green-700">
          <p className="font-medium">Pagamento via PIX</p>
          <p className="mt-0.5">Um QR Code será gerado. Você tem <strong>60 minutos</strong> para concluir o pagamento.</p>
          <p className="mt-1 text-green-600">Conta de destino: <strong>{PIX_ACCOUNT}</strong></p>
        </div>
      )}

      <PaymentElement />

      <div className="flex items-center gap-2 text-xs text-slate2-500">
        <Lock className="w-3 h-3" />
        <span>Pagamento seguro via Stripe. Seus dados são criptografados.</span>
      </div>

      <Button type="submit" isLoading={loading} disabled={!stripe || !elements} className="w-full" size="lg">
        Pagar {formatCurrency(checkout.amount)}
      </Button>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Página principal
// ---------------------------------------------------------------------------
export default function PagamentoPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user, setUser } = useAuthStore()

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [justPaid, setJustPaid] = useState(false)
  const [selectedMethod, setSelectedMethod] = useState<'card' | 'pix' | null>(null)
  const [checkout, setCheckout] = useState<CheckoutData | null>(null)
  const [creatingCheckout, setCreatingCheckout] = useState(false)
  const [cpfInput, setCpfInput] = useState('')
  const [savingCpf, setSavingCpf] = useState(false)
  const [needsCpf, setNeedsCpf] = useState(false)

  const redirectStatus = searchParams.get('redirect_status')
  const paymentIntentParam = searchParams.get('payment_intent')

    // Retorno do Stripe após redirecionamento (pagamento por cartão)
  useEffect(() => {
    if (redirectStatus === 'succeeded' && paymentIntentParam) {
      api.post('/payments/confirm-intent', { payment_intent_id: paymentIntentParam }).catch(() => {})
      setJustPaid(true)
    }
  }, [redirectStatus, paymentIntentParam])

  useEffect(() => {
    async function load() {
      try {
        const orderRes = await api.get(`/orders/${orderId}`)
        setOrder(orderRes.data.data)

        // Verifica se já existe pagamento confirmado
        try {
          const payRes = await api.get(`/payments/order/${orderId}`)
          const payStatus = payRes.data.data?.status
          if (payStatus === 'PAID' || payStatus === 'RELEASED') {
            setJustPaid(true)
          }
        } catch {
          // Nenhum pagamento ainda — normal para pedidos ACCEPTED
        }
      } catch {
        toast.error('Erro ao carregar dados do pagamento')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [orderId])

  async function saveCpfAndPay() {
    const digits = cpfInput.replace(/\D/g, '')
    if (digits.length !== 11 && digits.length !== 14) {
      toast.error('CPF inválido. Digite os 11 dígitos do CPF.')
      return
    }
    setSavingCpf(true)
    try {
      const res = await api.put('/users/me', { cpf: cpfInput })
      setUser(res.data.data)
      setNeedsCpf(false)
      await doCreateCheckout('pix')
    } catch {
      toast.error('Erro ao salvar CPF')
    } finally {
      setSavingCpf(false)
    }
  }

  async function doCreateCheckout(method: 'card' | 'pix') {
    setCreatingCheckout(true)
    setCheckout(null)
    try {
      const res = await api.post('/payments/create-checkout', { order_id: orderId, method })
      const data = res.data.data
      if (data.already_paid) {
        setJustPaid(true)
        return
      }
      setCheckout(data)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Erro ao preparar pagamento')
      setSelectedMethod(null)
    } finally {
      setCreatingCheckout(false)
    }
  }

  async function selectMethod(method: 'card' | 'pix') {
    if (creatingCheckout) return
    setSelectedMethod(method)
    setCheckout(null)
    setNeedsCpf(false)

    if (method === 'pix' && !user?.cpf) {
      setNeedsCpf(true)
      return
    }
    await doCreateCheckout(method)
  }

  if (loading) return <PageSpinner />

  if (justPaid) {
    return (
      <div className="max-w-md mx-auto mt-12">
        <Card>
          <CardBody className="text-center py-10">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-slate2-800 mb-2">Pagamento confirmado!</h2>
            <p className="text-slate2-500 mb-6">
              Seu pagamento foi recebido com sucesso. O serviço está agendado.
            </p>
            <Button onClick={() => router.push(`/pedido/${orderId}`)}>Ver pedido</Button>
          </CardBody>
        </Card>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="max-w-md mx-auto mt-12 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <p className="text-slate2-600">Pedido não encontrado.</p>
        <Button variant="outline" onClick={() => router.back()} className="mt-4">Voltar</Button>
      </div>
    )
  }

  const baseAmount = order.client_total ?? order.final_price ?? 0

  return (
    <div className="max-w-lg mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate2-800">Pagamento</h1>
        <p className="text-slate2-500 text-sm mt-1">{order.title}</p>
      </div>

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-slate2-700 flex items-center gap-2">
            <Lock className="w-4 h-4" />
            Pagamento seguro (escrow)
          </h2>
          <p className="text-xs text-slate2-500 mt-1">
            O valor fica retido até você confirmar a conclusão do serviço.
          </p>
        </CardHeader>
        <CardBody className="space-y-5">
          {/* Seleção de método de pagamento */}
          <div>
            <p className="text-sm font-medium text-slate2-700 mb-2">Escolha o método de pagamento</p>
            <div className={cn('gap-3', stripePromise ? 'grid grid-cols-2' : 'flex justify-center')}>
              {stripePromise && (
              <button
                onClick={() => selectMethod('card')}
                disabled={creatingCheckout}
                className={cn(
                  'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors text-sm',
                  selectedMethod === 'card'
                    ? 'border-brand-500 bg-brand-50 text-brand-800'
                    : 'border-slate2-200 hover:border-slate2-300 text-slate2-600'
                )}
              >
                <CreditCard className="w-6 h-6" />
                <span className="font-medium">Cartão</span>
                <span className="text-xs text-slate2-500">Taxa 4%</span>
              </button>
              )}

              <button
                onClick={() => selectMethod('pix')}
                disabled={creatingCheckout}
                className={cn(
                  'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors text-sm',
                  selectedMethod === 'pix'
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-slate2-200 hover:border-slate2-300 text-slate2-600'
                )}
              >
                <QrCode className="w-6 h-6" />
                <span className="font-medium">PIX</span>
                <span className="text-xs text-slate2-500">Taxa 1%</span>
              </button>
            </div>

            {/* Fee preview before checkout is created */}
            {!checkout && selectedMethod && !creatingCheckout && (
              <div className="mt-3 text-xs text-slate2-500 bg-slate2-50 rounded-lg p-2 text-center">
                Preparando checkout…
              </div>
            )}
            {!selectedMethod && (
              <p className="mt-2 text-xs text-slate2-400 text-center">
                Valor do serviço: {formatCurrency(baseAmount)} + taxa de processamento
              </p>
            )}
          </div>

          {/* Coleta de CPF (obrigatório para PIX) */}
          {needsCpf && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-amber-800">CPF obrigatório para pagamento via PIX</p>
              <p className="text-xs text-amber-700">O Mercado Pago exige o CPF do pagador. Informe abaixo — será salvo no seu perfil.</p>
              <input
                type="text"
                placeholder="000.000.000-00"
                value={cpfInput}
                onChange={e => setCpfInput(e.target.value)}
                maxLength={18}
                className="w-full border border-amber-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <Button onClick={saveCpfAndPay} isLoading={savingCpf} className="w-full bg-green-600 hover:bg-green-700">
                Salvar CPF e gerar PIX
              </Button>
            </div>
          )}

          {/* PIX checkout */}
          {checkout && checkout.payment_method === 'pix' && (
            <PixCheckoutForm checkout={checkout} orderId={orderId} />
          )}

          {/* Formulário de pagamento por cartão (Stripe) */}
          {checkout && checkout.payment_method === 'card' && stripePromise && checkout.client_secret && (
            <Elements
              stripe={stripePromise}
              options={{ clientSecret: checkout.client_secret, locale: 'pt-BR' }}
            >
              <CheckoutForm checkout={checkout} orderId={orderId} />
            </Elements>
          )}

          {creatingCheckout && (
            <div className="text-center py-4">
              <div className="inline-block w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-slate2-500 mt-2">Preparando checkout…</p>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  )
}
