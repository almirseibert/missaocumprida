'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { ArrowLeft, Send, LogIn, CheckCircle, Star, Clock, MapPin, Image as ImageIcon } from 'lucide-react'
import { api, getApiErrorMessage } from '@/lib/api'
import { Schedule, Message } from '@/types'
import { useAuthStore } from '@/store/auth'
import { PageSpinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { Modal } from '@/components/ui/Modal'
import { StarRating } from '@/components/ui/StarRating'
import { Textarea } from '@/components/ui/Textarea'
import { PhotoCaptureModal } from '@/components/PhotoCaptureModal'
import { CrossSellSuggestions } from '@/components/CrossSellSuggestions'
import { MakeRecurringButton } from '@/components/MakeRecurringButton'
import { useChatSocket, ChatMessage } from '@/hooks/useChatSocket'
import {
  formatDateTime,
  formatRelative,
  formatCurrency,
  SCHEDULE_STATUS_LABEL,
  SCHEDULE_STATUS_COLOR,
} from '@/lib/utils'

export default function ScheduleDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user } = useAuthStore()

  const [schedule, setSchedule] = useState<Schedule | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [msgText, setMsgText] = useState('')
  const [sendingMsg, setSendingMsg] = useState(false)
  const [ratingModal, setRatingModal] = useState(false)
  const [ratingScore, setRatingScore] = useState(5)
  const [ratingComment, setRatingComment] = useState('')
  const [submittingRating, setSubmittingRating] = useState(false)

  // Photo capture
  const [checkinPhotoOpen, setCheckinPhotoOpen] = useState(false)
  const [completePhotoOpen, setCompletePhotoOpen] = useState(false)
  const [submittingAction, setSubmittingAction] = useState(false)

  // Client confirmation modal
  const [confirmModal, setConfirmModal] = useState(false)
  const [confirmingService, setConfirmingService] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [otherTyping, setOtherTyping] = useState(false)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isProvider = user?.id === schedule?.provider_id
  const isClient = user?.id === schedule?.client_id

  // Chat em tempo real via Socket.io
  const socket = useChatSocket({
    scheduleId: id as string,
    onNewMessage: (m: ChatMessage) => {
      setMessages((prev) => prev.some((x) => x.id === m.id) ? prev : [...prev, m as unknown as Message])
      // Marca como lida ao receber se está com a tela aberta
      if (m.sender_id !== user?.id) socket.markRead()
    },
    onTyping: (data) => {
      if (data.userId === user?.id) return
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      setOtherTyping(data.typing)
      if (data.typing) {
        typingTimeoutRef.current = setTimeout(() => setOtherTyping(false), 4000)
      }
    },
  })

  const fetchSchedule = async () => {
    const res = await api.get(`/schedules/${id}`)
    const data = res.data.data
    setSchedule(data)
    setMessages(data.messages || [])
  }

  useEffect(() => {
    fetchSchedule().finally(() => setLoading(false))
    // Polling para schedule details (não-chat) a cada 15s — chat vem via socket
    const interval = setInterval(fetchSchedule, 15000)
    return () => clearInterval(interval)
  }, [id])

  // Auto-open confirmation modal for client when service is marked done
  useEffect(() => {
    if (isClient && schedule?.done_at && schedule.status === 'IN_PROGRESS' && !confirmModal) {
      setConfirmModal(true)
    }
  }, [schedule?.done_at, schedule?.status, isClient])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    if (!msgText.trim()) return
    setSendingMsg(true)
    const content = msgText
    try {
      // Tenta via socket primeiro; fallback REST se desconectado
      if (socket.connected) {
        const sent = await socket.sendMessage(content)
        setMessages((prev) => prev.some((x) => x.id === sent.id) ? prev : [...prev, sent as unknown as Message])
      } else {
        const res = await api.post(`/schedules/${id}/messages`, { content })
        setMessages((prev) => [...prev, res.data.data])
      }
      setMsgText('')
      socket.setTyping(false)
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setSendingMsg(false)
    }
  }

  const onTypeMessage = (v: string) => {
    setMsgText(v)
    socket.setTyping(v.length > 0)
  }

  async function handleCheckinPhoto({ file, lat, lng, address }: { file: File; lat: number | null; lng: number | null; address: string }) {
    setSubmittingAction(true)
    try {
      const form = new FormData()
      form.append('photo', file)
      if (lat !== null) form.append('lat', String(lat))
      if (lng !== null) form.append('lng', String(lng))
      form.append('address', address)
      await api.post(`/schedules/${id}/checkin`, form, { headers: { 'Content-Type': 'multipart/form-data' } })
      toast.success('Check-in realizado! Serviço em andamento.')
      await fetchSchedule()
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setSubmittingAction(false)
    }
  }

  async function handleCompletePhoto({ file, lat, lng, address }: { file: File; lat: number | null; lng: number | null; address: string }) {
    setSubmittingAction(true)
    try {
      const form = new FormData()
      form.append('photo', file)
      if (lat !== null) form.append('lat', String(lat))
      if (lng !== null) form.append('lng', String(lng))
      form.append('address', address)
      const res = await api.post(`/schedules/${id}/complete`, form, { headers: { 'Content-Type': 'multipart/form-data' } })
      const { duration_minutes, hourly_amount } = res.data.data ?? {}
      let msg = 'Serviço marcado como concluído. Aguardando confirmação do cliente.'
      if (duration_minutes) {
        const h = Math.floor(duration_minutes / 60)
        const m = duration_minutes % 60
        msg += ` Duração: ${h > 0 ? `${h}h ` : ''}${m}min.`
        if (hourly_amount) msg += ` Valor por hora: ${formatCurrency(hourly_amount)}.`
      }
      toast.success(msg, { duration: 6000 })
      await fetchSchedule()
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setSubmittingAction(false)
    }
  }

  async function handleConfirmByClient() {
    setConfirmingService(true)
    try {
      await api.post(`/schedules/${id}/confirm`)
      toast.success('Serviço confirmado!')
      setConfirmModal(false)
      setRatingModal(true)
      await fetchSchedule()
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setConfirmingService(false)
    }
  }

  const submitRating = async () => {
    setSubmittingRating(true)
    try {
      await api.post(`/schedules/${id}/rate`, { score: ratingScore, comment: ratingComment })
      toast.success('Avaliação enviada!')
      setRatingModal(false)
      fetchSchedule()
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setSubmittingRating(false)
    }
  }

  if (loading) return <PageSpinner />
  if (!schedule) return null

  const statusClass = SCHEDULE_STATUS_COLOR[schedule.status]
  const canCheckin = isProvider && schedule.status === 'CONFIRMED'
  const canComplete = isProvider && schedule.status === 'IN_PROGRESS' && !schedule.done_at
  const canConfirm = isClient && schedule.status === 'IN_PROGRESS' && !!schedule.done_at
  const canRate = schedule.status === 'DONE' && schedule.order?.status !== 'RATED'

  // Duration display
  const durationStr = (() => {
    if (!schedule.checkin_at) return null
    const end = schedule.done_at ? new Date(schedule.done_at) : new Date()
    const mins = Math.round((end.getTime() - new Date(schedule.checkin_at).getTime()) / 60000)
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return h > 0 ? `${h}h ${m}min` : `${m}min`
  })()

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Cross-sell para clientes em pedido concluído/avaliado */}
      {isClient && (schedule.status === 'DONE' || schedule.order?.status === 'RATED') && schedule.order_id && (
        <>
          <MakeRecurringButton schedule={schedule} />
          <CrossSellSuggestions orderId={schedule.order_id} />
        </>
      )}
      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-slate2-100">
          <ArrowLeft className="w-5 h-5 text-slate2-600" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-slate2-900">{schedule.order?.title || 'Agendamento'}</h1>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusClass}`}>
              {SCHEDULE_STATUS_LABEL[schedule.status]}
            </span>
          </div>
          <p className="text-sm text-slate2-500 mt-0.5">{formatDateTime(schedule.scheduled_at)}</p>
        </div>
      </div>

      {/* Parties + financial */}
      <div className="bg-white rounded-2xl border border-slate2-200 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {schedule.client && (
              <>
                <Avatar name={schedule.client.name} avatar={schedule.client.avatar} />
                <div>
                  <p className="text-xs text-slate2-500">Cliente</p>
                  <p className="font-medium text-slate2-900">{schedule.client.name}</p>
                </div>
              </>
            )}
          </div>
          <div className="text-slate2-300 text-xl">↔</div>
          <div className="flex items-center gap-3">
            {schedule.provider && (
              <>
                <div className="text-right">
                  <p className="text-xs text-slate2-500">Prestador</p>
                  <p className="font-medium text-slate2-900">{schedule.provider.name}</p>
                  <p className="text-xs text-slate2-400">★ {schedule.provider.rating_avg?.toFixed(1)}</p>
                </div>
                <Avatar name={schedule.provider.name} avatar={schedule.provider.avatar} />
              </>
            )}
          </div>
        </div>

        {/* Financial row */}
        <div className="pt-3 border-t border-slate2-100 grid grid-cols-2 gap-3 text-sm">
          {schedule.order?.final_price && (
            <div>
              <p className="text-xs text-slate2-500">Valor combinado</p>
              <p className="font-bold text-green-700">{formatCurrency(schedule.order.final_price)}</p>
            </div>
          )}
          {(schedule as Schedule & { hourly_rate?: number }).provider?.hourly_rate && (
            <div>
              <p className="text-xs text-slate2-500">Taxa/hora do prestador</p>
              <p className="font-semibold text-brand-800">{formatCurrency((schedule as Schedule & { provider?: { hourly_rate?: number } }).provider?.hourly_rate ?? 0)}/h</p>
            </div>
          )}
          {durationStr && (
            <div className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate2-400" />
              <span className="text-slate2-600">{schedule.done_at ? 'Duração total:' : 'Em andamento:'} <strong>{durationStr}</strong></span>
            </div>
          )}
          {schedule.hourly_amount && (
            <div>
              <p className="text-xs text-slate2-500">Valor por hora (calculado)</p>
              <p className="font-bold text-amber-600">{formatCurrency(schedule.hourly_amount)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Before/After photos */}
      {(schedule.checkin_photo_url || schedule.complete_photo_url) && (
        <div className="bg-white rounded-2xl border border-slate2-200 p-5">
          <h3 className="font-semibold text-slate2-700 mb-3 flex items-center gap-2">
            <ImageIcon className="w-4 h-4" /> Fotos do serviço
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {schedule.checkin_photo_url && (
              <div>
                <p className="text-xs text-slate2-500 mb-1">Início do serviço</p>
                <a href={schedule.checkin_photo_url} target="_blank" rel="noopener noreferrer">
                  <img src={schedule.checkin_photo_url} alt="Check-in" className="rounded-lg w-full object-cover border border-slate2-200 hover:opacity-90 transition-opacity" style={{ maxHeight: 180 }} />
                </a>
                {schedule.checkin_address && (
                  <p className="text-xs text-slate2-400 mt-1 flex items-center gap-0.5"><MapPin className="w-3 h-3" />{schedule.checkin_address}</p>
                )}
              </div>
            )}
            {schedule.complete_photo_url && (
              <div>
                <p className="text-xs text-slate2-500 mb-1">Conclusão do serviço</p>
                <a href={schedule.complete_photo_url} target="_blank" rel="noopener noreferrer">
                  <img src={schedule.complete_photo_url} alt="Conclusão" className="rounded-lg w-full object-cover border border-slate2-200 hover:opacity-90 transition-opacity" style={{ maxHeight: 180 }} />
                </a>
                {schedule.complete_address && (
                  <p className="text-xs text-slate2-400 mt-1 flex items-center gap-0.5"><MapPin className="w-3 h-3" />{schedule.complete_address}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Alert: provider marked done, waiting client confirmation */}
      {isClient && schedule.done_at && schedule.status === 'IN_PROGRESS' && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-800">O prestador marcou o serviço como concluído!</p>
            <p className="text-sm text-amber-700 mt-0.5">Verifique as fotos e confirme a conclusão para liberar o pagamento.</p>
            <Button size="sm" className="mt-3" onClick={() => setConfirmModal(true)}>
              Confirmar conclusão
            </Button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3 flex-wrap">
        {canCheckin && (
          <Button onClick={() => setCheckinPhotoOpen(true)} isLoading={submittingAction}>
            <LogIn className="w-4 h-4" /> Fazer Check-in
          </Button>
        )}
        {canComplete && (
          <Button onClick={() => setCompletePhotoOpen(true)} isLoading={submittingAction}>
            <CheckCircle className="w-4 h-4" /> Marcar como Concluído
          </Button>
        )}
        {canRate && (
          <Button variant="secondary" onClick={() => setRatingModal(true)}>
            <Star className="w-4 h-4" /> Avaliar
          </Button>
        )}
      </div>

      {/* Chat — estilo das Telas Web */}
      <div className="bg-white rounded-2xl border border-slate2-200 flex flex-col overflow-hidden" style={{ height: '520px' }}>
        {/* Cabeçalho com avatar + presença + badge de status */}
        <div className="px-5 py-4 border-b border-slate2-100 flex items-center gap-3">
          {(() => {
            const other = isProvider ? schedule.client : schedule.provider
            return (
              <>
                <Avatar name={other?.name || 'U'} avatar={other?.avatar} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="font-display text-sm font-bold text-slate2-900 truncate">{other?.name}</p>
                  <p className="flex items-center gap-1.5 text-xs text-accent-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent-500" />
                    Online agora
                  </p>
                </div>
                <span className="text-[11px] font-semibold bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full">
                  {SCHEDULE_STATUS_LABEL[schedule.status]} · {formatDateTime(schedule.scheduled_at)}
                </span>
              </>
            )
          })()}
        </div>

        {/* Mensagens com fundo slate2-50 */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-slate2-50">
          {messages.length === 0 && (
            <p className="text-center text-sm text-slate2-400 pt-8">Nenhuma mensagem ainda. Diga olá!</p>
          )}
          {messages.map((msg) => {
            const isMine = msg.sender_id === user?.id
            return (
              <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={
                    isMine
                      ? 'max-w-[70%] bg-brand-700 text-white rounded-[14px_14px_4px_14px] px-3.5 py-3'
                      : 'max-w-[70%] bg-white border border-slate2-200 text-slate2-800 rounded-[14px_14px_14px_4px] px-3.5 py-3'
                  }
                >
                  <p className="text-sm leading-relaxed">{msg.content}</p>
                  <p className={`text-[11px] mt-1.5 ${isMine ? 'text-white/60' : 'text-slate2-400'}`}>
                    {formatRelative(msg.created_at)}
                  </p>
                </div>
              </div>
            )
          })}
          <div ref={messagesEndRef} />
          {otherTyping && (
            <div className="text-xs text-slate2-500 italic px-2 py-1">digitando...</div>
          )}
        </div>

        {/* Input */}
        <div className="px-4 py-3.5 border-t border-slate2-100 flex gap-2.5 items-center">
          <input
            type="text"
            placeholder="Escreva uma mensagem..."
            value={msgText}
            onChange={(e) => onTypeMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            className="flex-1 rounded-xl border-[1.5px] border-slate2-200 bg-slate2-50 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white"
          />
          <Button onClick={sendMessage} isLoading={sendingMsg} size="sm">
            <Send className="w-4 h-4" /> Enviar
          </Button>
        </div>
        {socket.enabled && (
          <div className="px-4 pb-2 text-[11px] text-slate2-400 flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${socket.connected ? 'bg-emerald-500' : 'bg-slate2-300'}`} />
            {socket.connected ? 'Conectado em tempo real' : 'Reconectando...'}
          </div>
        )}
      </div>

      {/* Photo capture modals */}
      <PhotoCaptureModal
        isOpen={checkinPhotoOpen}
        onClose={() => setCheckinPhotoOpen(false)}
        onCapture={handleCheckinPhoto}
        title="Foto de Check-in"
      />
      <PhotoCaptureModal
        isOpen={completePhotoOpen}
        onClose={() => setCompletePhotoOpen(false)}
        onCapture={handleCompletePhoto}
        title="Foto de Conclusão do Serviço"
      />

      {/* Client confirmation modal */}
      <Modal isOpen={confirmModal} onClose={() => setConfirmModal(false)} title="Confirmar conclusão do serviço">
        <div className="space-y-4">
          <p className="text-sm text-slate2-600">
            O prestador marcou o serviço como concluído. Verifique as fotos abaixo e confirme se o serviço foi realizado corretamente.
          </p>
          {schedule.complete_photo_url && (
            <div>
              <p className="text-xs text-slate2-500 mb-1 font-medium">Foto de conclusão enviada pelo prestador:</p>
              <a href={schedule.complete_photo_url} target="_blank" rel="noopener noreferrer">
                <img src={schedule.complete_photo_url} alt="Conclusão" className="rounded-lg w-full object-cover border border-slate2-200" style={{ maxHeight: 220 }} />
              </a>
            </div>
          )}
          {schedule.duration_minutes && (
            <div className="bg-slate2-50 rounded-lg p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-slate2-500">Duração do serviço</span>
                <span className="font-medium">{Math.floor(schedule.duration_minutes / 60)}h {schedule.duration_minutes % 60}min</span>
              </div>
              {schedule.hourly_amount && (
                <div className="flex justify-between">
                  <span className="text-slate2-500">Valor calculado por hora</span>
                  <span className="font-bold text-amber-600">{formatCurrency(schedule.hourly_amount)}</span>
                </div>
              )}
            </div>
          )}
          <div className="flex gap-3">
            <Button variant="outline" fullWidth onClick={() => setConfirmModal(false)}>Revisar depois</Button>
            <Button fullWidth onClick={handleConfirmByClient} isLoading={confirmingService}>
              <CheckCircle className="w-4 h-4" /> Confirmar e liberar pagamento
            </Button>
          </div>
        </div>
      </Modal>

      {/* Rating modal */}
      <Modal isOpen={ratingModal} onClose={() => setRatingModal(false)} title="Avaliar serviço">
        <div className="space-y-4">
          <p className="text-sm text-slate2-600">
            Como foi o serviço {isClient ? `de ${schedule.provider?.name}` : `de ${schedule.client?.name}`}?
          </p>
          <div className="flex justify-center">
            <StarRating value={ratingScore} onChange={setRatingScore} size="lg" />
          </div>
          <Textarea
            label="Comentário (opcional)"
            placeholder="Compartilhe sua experiência..."
            value={ratingComment}
            onChange={(e) => setRatingComment(e.target.value)}
          />
          <Button fullWidth onClick={submitRating} isLoading={submittingRating}>Enviar Avaliação</Button>
        </div>
      </Modal>
    </div>
  )
}
