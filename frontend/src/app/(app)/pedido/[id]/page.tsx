'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { ArrowLeft, MapPin, Calendar, DollarSign, User, Check, X as XIcon, MessageCircle, EyeOff, CreditCard, CheckCircle2, Clock } from 'lucide-react'
import dynamic from 'next/dynamic'

const BlurredMapView = dynamic(
  () => import('@/components/BlurredMapView').then(m => ({ default: m.BlurredMapView })),
  { ssr: false, loading: () => <div className="h-48 bg-slate2-100 rounded-xl animate-pulse" /> }
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
import { ShareOrderButton } from '@/components/ShareOrderButton'
import { VerifiedBadge } from '@/components/VerifiedBadge'
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
  const [verifiedOnly, setVerifiedOnly] = useState(false)
  const [payment, setPayment] = useState<Payment | null>(null)
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
    const qs = verifiedOnly ? '?verified_only=1' : ''
    const res = await api.get(`/orders/${id}/proposals${qs}`)
    setProposals(res.data.data)
  }

  useEffect(() => {
    Promise.all([
      api.get(`/orders/${id}`).then((r) => setOrder(r.data.data)),
    ]).finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (order && isClient && ['OPEN', 'IN_PROPOSAL'].includes(order.status)) {
      const qs = verifiedOnly ? '?verified_only=1' : ''
      api.get(`/orders/${id}/proposals${qs}`).then((r) => setProposals(r.data.data))
    }
  }, [order, isClient, id, verifiedOnly])

  const submitProposal = async () => {
    if (!proposalValue) { toast.error('Informe o valor da proposta'); return }
    if (parseFloat(proposalValue) < 10) { toast.error('O valor mínimo para uma proposta é R$ 10,00'); return }
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
      if (data.payment_required) {
        toast.success('Proposta aceita! Escolha o método de pagamento.')
        router.push(`/pagamento/${id}`)
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

  const statusClass = ORDER_STATUS_COLOR[order.status] || 'bg-slate2-100 text-slate2-700'

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-slate2-100">
          <ArrowLeft className="w-5 h-5 text-slate2-600" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-slate2-900">{order.title}</h1>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusClass}`}>
              {ORDER_STATUS_LABEL[order.status]}
            </span>
          </div>
          <p className="text-sm text-slate2-500 mt-0.5">
            Criado em {formatDate(order.created_at)}
            {order.category && ` · ${order.category.name}`}
          </p>
        </div>
        {isClient && ['OPEN', 'IN_PROPOSAL'].includes(order.status) && (
          <ShareOrderButton
            orderId={order.id}
            initialSlug={(order as any).public_share_slug}
            initialEnabled={(order as any).public_share_enabled}
          />
        )}
      </div>

      {/* Main details */}
      <div className="bg-white rounded-2xl border border-slate2-200 p-6 space-y-4">
        {order.description && (
          <div>
            <p className="text-sm font-medium text-slate2-500 mb-1">Descrição</p>
            <p className="text-slate2-800">{order.description}</p>
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-4">
          {(order.estimated_price_min || order.estimated_price_max) && (
            <div className="flex items-center gap-2 text-sm">
              <DollarSign className="w-4 h-4 text-brand-500" />
              <div>
                <p className="text-slate2-500">Estimativa</p>
                <p className="font-medium text-slate2-900">
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
                <p className="text-slate2-500">Valor final</p>
                <p className="font-bold text-green-700">{formatCurrency(order.final_price)}</p>
              </div>
            </div>
          )}
        </div>

        {/* Breakdown de taxa — visível após aceite */}
        {order.provider_amount != null && order.platform_fee_value != null && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-2 text-sm">
            <p className="font-semibold text-green-800">Detalhamento do pagamento</p>
            <div className="flex justify-between text-slate2-700">
              <span>Valor combinado</span>
              <span>{formatCurrency(order.final_price ?? 0)}</span>
            </div>
            {isClient ? (
              <div className="flex justify-between text-slate2-500">
                <span>Taxa de serviço ({Math.round((order.client_fee_pct ?? 0.10) * 100)}%)</span>
                <span>+ {formatCurrency(order.client_fee_value ?? 0)}</span>
              </div>
            ) : (
              <div className="flex justify-between text-slate2-500">
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
                <p className="text-slate2-500">Data desejada</p>
                <p className="font-medium text-slate2-900">{formatDateTime(order.desired_date)}</p>
              </div>
            </div>
          )}

          {(order.city || order.address) && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="w-4 h-4 text-brand-500" />
              <div>
                <p className="text-slate2-500">Local</p>
                {order.location_blurred ? (
                  <p className="font-medium text-slate2-900">
                    {[order.neighborhood, order.city].filter(Boolean).join(', ')}
                    {order.state && `/${order.state}`}
                  </p>
                ) : (
                  <p className="font-medium text-slate2-900">
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
            <p className="text-sm font-medium text-slate2-500 mb-2">Fotos</p>
            <div className="flex gap-2 flex-wrap">
              {order.photos.map((url, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={url.startsWith('http') ? url : `${process.env.NEXT_PUBLIC_API_URL}/${url}`}
                  alt=""
                  className="w-20 h-20 rounded-xl object-cover border border-slate2-200"
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Proposals (client view) */}
      {isClient && proposals.length > 0 && (() => {
        // Destaca a melhor proposta pendente (menor preço)
        const pending = proposals.filter((p) => p.status === 'PENDING')
        const bestId = pending.length > 0
          ? pending.reduce((a, b) => (a.value <= b.value ? a : b)).id
          : null
        return (
          <div className="bg-white rounded-2xl border border-slate2-200 p-6">
            <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
              <h2 className="font-display text-base font-bold text-slate2-900">
                {proposals.length} Proposta{proposals.length > 1 ? 's' : ''} recebida{proposals.length > 1 ? 's' : ''}
              </h2>
              <button
                type="button"
                onClick={() => setVerifiedOnly((v) => !v)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border transition ${
                  verifiedOnly
                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                    : 'bg-white border-slate2-300 text-slate2-600 hover:border-slate2-400'
                }`}
              >
                <VerifiedBadge size="xs" />
                Apenas verificados
              </button>
            </div>
            <div className="space-y-4">
              {proposals.map((prop) => {
                const highlighted = prop.id === bestId
                const clientFee = 0.12
                const clientTotal = prop.value * (1 + clientFee)
                const boostLevel = prop.boost_level ?? 0
                return (
                  <div
                    key={prop.id}
                    className={
                      boostLevel === 2
                        ? 'border-2 border-emerald-300 bg-emerald-50/40 rounded-2xl p-[18px]'
                        : boostLevel === 1
                        ? 'border-2 border-amber-300 bg-amber-50/40 rounded-2xl p-[18px]'
                        : highlighted
                        ? 'border-2 border-brand-200 bg-brand-50 rounded-2xl p-[18px]'
                        : 'border border-slate2-200 rounded-2xl p-[18px]'
                    }
                  >
                    {boostLevel > 0 && (
                      <div className="flex items-center gap-1 mb-2 -mt-1">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${boostLevel === 2 ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'}`}>
                          {boostLevel === 2 ? '🚀 Recomendado' : '⭐ Destaque'}
                        </span>
                      </div>
                    )}
                    <div className="flex items-start gap-3 mb-3">
                      <Avatar name={prop.provider?.name || 'P'} avatar={prop.provider?.avatar} />
                      <div className="flex-1 min-w-0">
                        <p className="font-display font-bold text-sm text-slate2-900 flex items-center gap-1">
                          {prop.provider?.name}
                          {prop.provider?.is_verified_pro && <VerifiedBadge size="xs" />}
                        </p>
                        <p className="text-xs text-slate2-500">
                          {(prop.provider?.rating_count ?? 0) > 0
                            ? `${prop.provider?.rating_count} serviços`
                            : 'Novo na plataforma'}
                        </p>
                        <p className="text-xs text-amber-500 mt-0.5">
                          {'★'.repeat(Math.round(prop.provider?.rating_avg ?? 0))}
                          {'☆'.repeat(5 - Math.round(prop.provider?.rating_avg ?? 0))}
                          <span className="text-slate2-500 ml-1">
                            {(prop.provider?.rating_avg ?? 0).toFixed(1)}
                          </span>
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`font-display text-[22px] font-extrabold ${highlighted ? 'text-brand-700' : 'text-slate2-900'} leading-none`}>
                          {formatCurrency(prop.value)}
                        </p>
                        {highlighted && (
                          <p className="text-[11px] font-semibold text-accent-600 mt-1">
                            Você paga {formatCurrency(clientTotal)}
                          </p>
                        )}
                      </div>
                    </div>
                    {prop.message && (
                      <div className="bg-white border border-slate2-100 rounded-lg px-3.5 py-2.5 mb-3.5">
                        <p className="text-[13px] text-slate2-700 italic leading-relaxed">
                          &ldquo;{prop.message}&rdquo;
                        </p>
                      </div>
                    )}
                    {prop.status === 'PENDING' && ['OPEN', 'IN_PROPOSAL'].includes(order.status) && (
                      <div className="flex gap-2">
                        <Button
                          variant="success"
                          size="md"
                          fullWidth
                          onClick={() => acceptProposal(prop.id)}
                        >
                          <Check className="w-4 h-4" /> Aceitar proposta
                        </Button>
                        <Button
                          size="md"
                          variant="secondary"
                          onClick={async () => {
                            await api.post(`/proposals/${prop.id}/reject`)
                            fetchProposals()
                          }}
                        >
                          <XIcon className="w-4 h-4" /> Rejeitar
                        </Button>
                      </div>
                    )}
                    {prop.status !== 'PENDING' && (
                      <Badge
                        variant={prop.status === 'ACCEPTED' ? 'green' : 'gray'}
                      >
                        {prop.status === 'ACCEPTED' ? 'Aceita' : prop.status === 'REJECTED' ? 'Recusada' : 'Cancelada'}
                      </Badge>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* Payment status banner */}
      {isClient && order.status === 'ACCEPTED' && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
          <CreditCard className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-amber-800">Pagamento pendente</p>
            <p className="text-sm text-amber-700 mt-0.5">
              Realize o pagamento para confirmar o agendamento do serviço.
            </p>
          </div>
          <Button size="sm" onClick={() => router.push(`/pagamento/${id}`)}>
            Pagar agora
          </Button>
        </div>
      )}

      {payment && payment.status === 'PAID' && (
        <div className="bg-brand-50 border border-brand-200 rounded-2xl p-4 flex items-center gap-3">
          <Clock className="w-5 h-5 text-brand-500 flex-shrink-0" />
          <div>
            <p className="font-semibold text-brand-900">Pagamento confirmado (escrow)</p>
            <p className="text-sm text-brand-800 mt-0.5">
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
            <label className="text-sm font-medium text-slate2-700">Valor da proposta (R$) *</label>
            <input
              type="number"
              step="0.01"
              min="10"
              placeholder="150.00"
              value={proposalValue}
              onChange={(e) => setProposalValue(e.target.value)}
              className="block w-full rounded-lg border border-slate2-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {/* Preview de taxa da plataforma */}
          {proposalValue && parseFloat(proposalValue) > 0 && (() => {
            const gross = parseFloat(proposalValue)
            const providerFee = Math.round(gross * 0.10 * 100) / 100
            const net = Math.round((gross - providerFee) * 100) / 100
            return (
              <div className="bg-slate2-50 rounded-xl p-4 space-y-2 text-sm">
                <p className="font-medium text-slate2-700">Resumo financeiro</p>
                <div className="flex justify-between text-slate2-600">
                  <span>Valor da proposta</span>
                  <span className="font-medium">R$ {gross.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate2-500">
                  <span>Taxa da plataforma (10%)</span>
                  <span>− R$ {providerFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-green-700 font-semibold border-t border-slate2-200 pt-2">
                  <span>Você recebe</span>
                  <span>R$ {net.toFixed(2)}</span>
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
          <p className="text-slate2-700">Tem certeza que deseja cancelar este pedido?</p>
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
