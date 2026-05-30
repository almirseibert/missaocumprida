'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { ArrowLeft, MapPin, Calendar, DollarSign, User, Check, X as XIcon, MessageCircle, EyeOff, CreditCard, CheckCircle2, Clock } from 'lucide-react'
import dynamic from 'next/dynamic'

const BlurredMapView = dynamic(
  () => import('@/components/BlurredMapView').then(m => ({ default: m.BlurredMapView })),
  { ssr: false, loading: () => <div className="h-48 bg-gray-100 rounded-xl animate-pulse" /> }
)
import { api, getApiErrorMessage } from '@/lib/api'
import { Order, Proposal, Payment } from '@/types'
import { useAuthStore } from '@/store/auth'
import { PageSpinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Textarea } from '@/components/ui/Textarea'
import {
  formatCurrency,
  formatDateTime,
  formatDate,
  ORDER_STATUS_LABEL,
  ORDER_STATUS_COLOR,
} from '@/lib/utils'

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user } = useAuthStore()

  const [order, setOrder] = useState<Order | null>(null)
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [payment, setPayment] = useState<Payment | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [proposalModal, setProposalModal] = useState(false)
  const [proposalValue, setProposalValue] = useState('')
  const [proposalMsg, setProposalMsg] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [cancelConfirm, setCancelConfirm] = useState(false)

  const isClient = user?.id === order?.client_id
  const canPropose =
    user &&
    (user.role === 'PROVIDER' || user.role === 'BOTH') &&
    order?.status === 'OPEN' &&
    user.id !== order?.client_id &&
    !proposals.find((p) => p.provider_id === user.id)

  const fetchOrder = async () => {
    const res = await api.get(`/orders/${id}`)
    setOrder(res.data.data)
  }

  const fetchProposals = async () => {
    if (!isClient) return
    const res = await api.get(`/orders/${id}/proposals`)
    setProposals(res.data.data)
  }

  useEffect(() => {
    Promise.all([
      api.get(`/orders/${id}`).then((r) => setOrder(r.data.data)),
    ]).finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (order && isClient && ['OPEN', 'IN_PROPOSAL'].includes(order.status)) {
      api.get(`/orders/${id}/proposals`).then((r) => setProposals(r.data.data))
    }
  }, [order, isClient, id])

  const submitProposal = async () => {
    if (!proposalValue) { toast.error('Informe o valor da proposta'); return }
    setSubmitting(true)
    try {
      await api.post(`/orders/${id}/proposals`, {
        value: parseFloat(proposalValue),
        message: proposalMsg,
      })
      toast.success('Proposta enviada!')
      setProposalModal(false)
      fetchOrder()
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const acceptProposal = async (proposalId: string) => {
    try {
      const res = await api.post(`/proposals/${proposalId}/accept`)
      const data = res.data.data
      if (data.payment_required && data.client_secret) {
        setClientSecret(data.client_secret)
        toast.success('Proposta aceita! Realize o pagamento abaixo.')
        router.push(`/pagamento/${id}?cs=${data.client_secret}`)
        return
      }
      toast.success('Proposta aceita! Agendamento criado.')
      fetchOrder()
      fetchProposals()
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    }
  }

  const loadPayment = async () => {
    try {
      const res = await api.get(`/payments/order/${id}`)
      setPayment(res.data.data)
    } catch {
      // pedido sem pagamento ainda
    }
  }

  useEffect(() => {
    if (order && ['ACCEPTED', 'SCHEDULED', 'IN_PROGRESS', 'DONE', 'RATED'].includes(order.status)) {
      loadPayment()
    }
  }, [order])

  const cancelOrder = async () => {
    try {
      await api.patch(`/orders/${id}/cancel`)
      toast.success('Pedido cancelado.')
      router.replace('/meus-pedidos')
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    }
  }

  if (loading) return <PageSpinner />
  if (!order) return null

  const statusClass = ORDER_STATUS_COLOR[order.status] || 'bg-gray-100 text-gray-700'

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900">{order.title}</h1>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusClass}`}>
              {ORDER_STATUS_LABEL[order.status]}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            Criado em {formatDate(order.created_at)}
            {order.category && ` · ${order.category.name}`}
          </p>
        </div>
      </div>

      {/* Main details */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
        {order.description && (
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">Descrição</p>
            <p className="text-gray-800">{order.description}</p>
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-4">
          {(order.estimated_price_min || order.estimated_price_max) && (
            <div className="flex items-center gap-2 text-sm">
              <DollarSign className="w-4 h-4 text-brand-500" />
              <div>
                <p className="text-gray-500">Estimativa</p>
                <p className="font-medium text-gray-900">
                  {order.estimated_price_min && formatCurrency(order.estimated_price_min)}
                  {order.estimated_price_min && order.estimated_price_max && ' – '}
                  {order.estimated_price_max && formatCurrency(order.estimated_price_max)}
                </p>
              </div>
            </div>
          )}

          {order.final_price && (
            <div className="flex items-center gap-2 text-sm">
              <DollarSign className="w-4 h-4 text-green-500" />
              <div>
                <p className="text-gray-500">Valor final</p>
                <p className="font-bold text-green-700">{formatCurrency(order.final_price)}</p>
              </div>
            </div>
          )}
        </div>

        {/* Breakdown de taxa — visível após aceite */}
        {order.provider_amount != null && order.platform_fee_value != null && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-2 text-sm">
            <p className="font-semibold text-green-800">Detalhamento do pagamento</p>
            <div className="flex justify-between text-gray-700">
              <span>Valor combinado</span>
              <span>{formatCurrency(order.final_price ?? 0)}</span>
            </div>
            {isClient ? (
              <div className="flex justify-between text-gray-500">
                <span>Taxa de serviço ({Math.round((order.client_fee_pct ?? 0.10) * 100)}%)</span>
                <span>+ {formatCurrency(order.client_fee_value ?? 0)}</span>
              </div>
            ) : (
              <div className="flex justify-between text-gray-500">
                <span>Taxa da plataforma ({Math.round((order.platform_fee_pct ?? 0.10) * 100)}%)</span>
                <span>− {formatCurrency(order.platform_fee_value)}</span>
              </div>
            )}
            <div className="flex justify-between text-green-700 font-bold border-t border-green-200 pt-2">
              <span>{isClient ? 'Total cobrado de você' : 'Você recebe'}</span>
              <span>{isClient ? formatCurrency(order.client_total ?? order.final_price ?? 0) : formatCurrency(order.provider_amount)}</span>
            </div>
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-4">
          {order.desired_date && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-brand-500" />
              <div>
                <p className="text-gray-500">Data desejada</p>
                <p className="font-medium text-gray-900">{formatDateTime(order.desired_date)}</p>
              </div>
            </div>
          )}

          {(order.city || order.address) && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="w-4 h-4 text-brand-500" />
              <div>
                <p className="text-gray-500">Local</p>
                {order.location_blurred ? (
                  <p className="font-medium text-gray-900">
                    {[order.neighborhood, order.city].filter(Boolean).join(', ')}
                    {order.state && `/${order.state}`}
                  </p>
                ) : (
                  <p className="font-medium text-gray-900">
                    {order.address || ''}{order.neighborhood && `, ${order.neighborhood}`}{order.city && `, ${order.city}`}{order.state && `/${order.state}`}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Localização aproximada para prestadores antes da aceitação */}
        {order.location_blurred && order.latitude != null && order.longitude != null && (
          <div className="space-y-2">
            <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
              <EyeOff className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                <strong>Localização aproximada.</strong> O mapa abaixo é apenas informativo — indica a região geral (cidade e bairro) onde o serviço será realizado, mas <strong>não revela o endereço exato</strong>. O endereço completo é liberado somente após o aceite da proposta, evitando que o serviço seja contratado fora da plataforma.
              </span>
            </div>
            <BlurredMapView lat={order.latitude} lng={order.longitude} radiusMeters={500} />
          </div>
        )}

        {/* Photos */}
        {order.photos.length > 0 && (
          <div>
            <p className="text-sm font-medium text-gray-500 mb-2">Fotos</p>
            <div className="flex gap-2 flex-wrap">
              {order.photos.map((url, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={url.startsWith('http') ? url : `${process.env.NEXT_PUBLIC_API_URL}/${url}`}
                  alt=""
                  className="w-20 h-20 rounded-xl object-cover border border-gray-200"
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Proposals (client view) */}
      {isClient && proposals.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">
            Propostas recebidas ({proposals.length})
          </h2>
          <div className="space-y-4">
            {proposals.map((prop) => (
              <div key={prop.id} className="border border-gray-200 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={prop.provider?.name || 'P'} avatar={prop.provider?.avatar} />
                    <div>
                      <p className="font-medium text-gray-900">{prop.provider?.name}</p>
                      <p className="text-xs text-gray-500">
                        ★ {prop.provider?.rating_avg?.toFixed(1) || 'Novo'} · {prop.provider?.rating_count || 0} avaliações
                      </p>
                    </div>
                  </div>
                  <p className="text-lg font-bold text-brand-600">{formatCurrency(prop.value)}</p>
                </div>
                {prop.message && (
                  <p className="mt-2 text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{prop.message}</p>
                )}
                {prop.status === 'PENDING' && ['OPEN', 'IN_PROPOSAL'].includes(order.status) && (
                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      onClick={() => acceptProposal(prop.id)}
                    >
                      <Check className="w-4 h-4" /> Aceitar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        await api.post(`/proposals/${prop.id}/reject`)
                        fetchProposals()
                      }}
                    >
                      <XIcon className="w-4 h-4" /> Recusar
                    </Button>
                  </div>
                )}
                {prop.status !== 'PENDING' && (
                  <Badge
                    className="mt-3"
                    variant={prop.status === 'ACCEPTED' ? 'success' : 'default'}
                  >
                    {prop.status === 'ACCEPTED' ? 'Aceita' : prop.status === 'REJECTED' ? 'Recusada' : 'Cancelada'}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payment status banner */}
      {isClient && order.status === 'ACCEPTED' && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex items-start gap-3">
          <CreditCard className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-orange-800">Pagamento pendente</p>
            <p className="text-sm text-orange-700 mt-0.5">
              Realize o pagamento para confirmar o agendamento do serviço.
            </p>
          </div>
          <Button size="sm" onClick={() => router.push(`/pagamento/${id}`)}>
            Pagar agora
          </Button>
        </div>
      )}

      {payment && payment.status === 'PAID' && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center gap-3">
          <Clock className="w-5 h-5 text-blue-500 flex-shrink-0" />
          <div>
            <p className="font-semibold text-blue-800">Pagamento confirmado (escrow)</p>
            <p className="text-sm text-blue-700 mt-0.5">
              Valor retido até você confirmar a conclusão do serviço.
            </p>
          </div>
        </div>
      )}

      {payment && payment.status === 'RELEASED' && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
          <div>
            <p className="font-semibold text-green-800">Pagamento liberado ao prestador</p>
            <p className="text-sm text-green-700 mt-0.5">
              O serviço foi concluído e o valor foi liberado.
            </p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 flex-wrap">
        {canPropose && (
          <Button onClick={() => setProposalModal(true)}>
            <MessageCircle className="w-4 h-4" /> Fazer Proposta
          </Button>
        )}

        {isClient && ['OPEN', 'IN_PROPOSAL'].includes(order.status) && (
          <Button variant="danger" onClick={() => setCancelConfirm(true)}>
            Cancelar Pedido
          </Button>
        )}

        {['ACCEPTED', 'SCHEDULED', 'IN_PROGRESS', 'DONE', 'RATED'].includes(order.status) && (
          <Button variant="secondary" onClick={() => router.push('/agendamentos')}>
            Ver Agendamento
          </Button>
        )}
      </div>

      {/* Proposal modal */}
      <Modal isOpen={proposalModal} onClose={() => setProposalModal(false)} title="Fazer Proposta">
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Valor da proposta (R$) *</label>
            <input
              type="number"
              step="0.01"
              min="1"
              placeholder="150.00"
              value={proposalValue}
              onChange={(e) => setProposalValue(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {/* Preview de taxa da plataforma */}
          {proposalValue && parseFloat(proposalValue) > 0 && (() => {
            const gross = parseFloat(proposalValue)
            const providerFee = Math.round(gross * 0.10 * 100) / 100
            const net = Math.round((gross - providerFee) * 100) / 100
            const clientFee = Math.round(gross * 0.10 * 100) / 100
            const clientTotal = Math.round((gross + clientFee) * 100) / 100
            return (
              <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                <p className="font-medium text-gray-700">Resumo financeiro</p>
                <div className="flex justify-between text-gray-600">
                  <span>Valor da proposta</span>
                  <span className="font-medium">R$ {gross.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Taxa da plataforma (10%)</span>
                  <span>− R$ {providerFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-green-700 font-semibold border-t border-gray-200 pt-2">
                  <span>Você recebe</span>
                  <span>R$ {net.toFixed(2)}</span>
                </div>
                <div className="border-t border-gray-200 pt-2 flex justify-between text-gray-500">
                  <span>Taxa de serviço para o cliente (10%)</span>
                  <span>+ R$ {clientFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-600 font-medium">
                  <span>Cliente paga</span>
                  <span>R$ {clientTotal.toFixed(2)}</span>
                </div>
              </div>
            )
          })()}

          <Textarea
            label="Mensagem (opcional)"
            placeholder="Descreva sua experiência com este tipo de serviço..."
            value={proposalMsg}
            onChange={(e) => setProposalMsg(e.target.value)}
          />
          <div className="flex gap-3">
            <Button fullWidth onClick={submitProposal} isLoading={submitting}>
              Enviar Proposta
            </Button>
            <Button variant="outline" onClick={() => setProposalModal(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Cancel confirm modal */}
      <Modal isOpen={cancelConfirm} onClose={() => setCancelConfirm(false)} title="Cancelar Pedido" size="sm">
        <div className="space-y-4">
          <p className="text-gray-700">Tem certeza que deseja cancelar este pedido?</p>
          <div className="flex gap-3">
            <Button variant="danger" fullWidth onClick={cancelOrder}>
              Sim, cancelar
            </Button>
            <Button variant="outline" onClick={() => setCancelConfirm(false)}>
              Não
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
