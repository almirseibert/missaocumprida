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
import { CheckCircle, AlertCircle, Lock } from 'lucide-react'
import type { Order, Payment } from '@/types'

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null

// ---------------------------------------------------------------------------
// Formulário de pagamento (dentro do Elements provider)
// ---------------------------------------------------------------------------
function CheckoutForm({ order, payment }: { order: Order; payment: Payment }) {
  const stripe = useStripe()
  const elements = useElements()
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return

    setLoading(true)
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/pedido/${order.id}?paid=1`,
      },
    })

    if (error) {
      toast.error(error.message ?? 'Erro ao processar pagamento')
      setLoading(false)
    }
    // Em caso de sucesso, o Stripe redireciona para return_url
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Resumo financeiro */}
      <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">Valor do serviço</span>
          <span className="font-medium">{formatCurrency(order.final_price ?? 0)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Taxa de serviço (10%)</span>
          <span className="font-medium">{formatCurrency(order.client_fee_value ?? 0)}</span>
        </div>
        <div className="flex justify-between border-t pt-2 text-base font-bold">
          <span>Total a pagar</span>
          <span className="text-blue-600">{formatCurrency(payment.amount)}</span>
        </div>
      </div>

      {/* Stripe Payment Element */}
      <div>
        <PaymentElement />
      </div>

      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Lock className="w-3 h-3" />
        <span>Pagamento seguro via Stripe. Seus dados são criptografados.</span>
      </div>

      <Button type="submit" isLoading={loading} disabled={!stripe || !elements} className="w-full" size="lg">
        Pagar {formatCurrency(payment.amount)}
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
  const [order, setOrder] = useState<Order | null>(null)
  const [payment, setPayment] = useState<Payment | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Verificar se retornou do Stripe após pagamento bem-sucedido
  const paidParam = searchParams.get('payment_intent')
  const [justPaid, setJustPaid] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const [orderRes, paymentRes] = await Promise.all([
          api.get(`/orders/${orderId}`),
          api.get(`/payments/order/${orderId}`),
        ])
        setOrder(orderRes.data.data)
        setPayment(paymentRes.data.data)

        // Buscar client_secret — só está disponível no momento do aceite.
        // Se a página foi aberta direto, tentamos re-criar (dev mode)
        const cs = searchParams.get('cs')
        if (cs) {
          setClientSecret(cs)
        }

        if (paymentRes.data.data.status !== 'PENDING') {
          setJustPaid(true)
        }
      } catch {
        toast.error('Erro ao carregar dados do pagamento')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [orderId, searchParams])

  // Simular pagamento em modo dev (sem Stripe configurado)
  async function handleSimulate() {
    try {
      await api.post('/payments/simulate', { order_id: orderId })
      toast.success('Pagamento simulado com sucesso!')
      setJustPaid(true)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Erro')
    }
  }

  if (loading) return <PageSpinner />

  if (!order || !payment) {
    return (
      <div className="max-w-md mx-auto mt-12 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <p className="text-gray-600">Pagamento não encontrado.</p>
        <Button variant="outline" onClick={() => router.back()} className="mt-4">Voltar</Button>
      </div>
    )
  }

  if (justPaid || payment.status === 'PAID' || payment.status === 'RELEASED') {
    return (
      <div className="max-w-md mx-auto mt-12">
        <Card>
          <CardBody className="text-center py-10">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Pagamento confirmado!</h2>
            <p className="text-gray-500 mb-6">
              O valor de {formatCurrency(payment.amount)} foi recebido com sucesso.
              O serviço está agendado.
            </p>
            <Button onClick={() => router.push(`/pedido/${orderId}`)}>Ver pedido</Button>
          </CardBody>
        </Card>
      </div>
    )
  }

  const isStripeConfigured = !!stripePromise && !!clientSecret

  return (
    <div className="max-w-lg mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Pagamento</h1>
        <p className="text-gray-500 text-sm mt-1">{order.title}</p>
      </div>

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-gray-700 flex items-center gap-2">
            <Lock className="w-4 h-4" />
            Pagamento seguro (escrow)
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            O valor fica retido até você confirmar a conclusão do serviço.
          </p>
        </CardHeader>
        <CardBody>
          {isStripeConfigured ? (
            <Elements stripe={stripePromise} options={{ clientSecret, locale: 'pt-BR' }}>
              <CheckoutForm order={order} payment={payment} />
            </Elements>
          ) : (
            <div className="space-y-4">
              {/* Resumo financeiro */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Valor do serviço</span>
                  <span className="font-medium">{formatCurrency(order.final_price ?? 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Taxa de serviço (10%)</span>
                  <span className="font-medium">{formatCurrency(order.client_fee_value ?? 0)}</span>
                </div>
                <div className="flex justify-between border-t pt-2 text-base font-bold">
                  <span>Total</span>
                  <span className="text-blue-600">{formatCurrency(payment.amount)}</span>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                Stripe não configurado. Use o botão abaixo para simular o pagamento (apenas em desenvolvimento).
              </div>

              <Button onClick={handleSimulate} className="w-full" size="lg">
                Simular pagamento de {formatCurrency(payment.amount)}
              </Button>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  )
}
