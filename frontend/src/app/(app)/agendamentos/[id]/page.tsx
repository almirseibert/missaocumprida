'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { ArrowLeft, Send, LogIn, CheckCircle, Star } from 'lucide-react'
import { api, getApiErrorMessage } from '@/lib/api'
import { Schedule, Message } from '@/types'
import { useAuthStore } from '@/store/auth'
import { PageSpinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { Modal } from '@/components/ui/Modal'
import { StarRating } from '@/components/ui/StarRating'
import { Textarea } from '@/components/ui/Textarea'
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
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const isProvider = user?.id === schedule?.provider_id
  const isClient = user?.id === schedule?.client_id
  const otherParty = isProvider ? schedule?.client : schedule?.provider

  const fetchSchedule = async () => {
    const res = await api.get(`/schedules/${id}`)
    const data = res.data.data
    setSchedule(data)
    setMessages(data.messages || [])
  }

  useEffect(() => {
    fetchSchedule().finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    if (!msgText.trim()) return
    setSendingMsg(true)
    try {
      const res = await api.post(`/schedules/${id}/messages`, { content: msgText })
      setMessages((prev) => [...prev, res.data.data])
      setMsgText('')
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setSendingMsg(false)
    }
  }

  const handleCheckin = async () => {
    try {
      await api.patch(`/schedules/${id}/checkin`)
      toast.success('Check-in realizado! Serviço em andamento.')
      fetchSchedule()
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    }
  }

  const handleComplete = async () => {
    try {
      if (isProvider) {
        await api.patch(`/schedules/${id}/complete`)
        toast.success('Serviço marcado como concluído. Aguardando confirmação do cliente.')
      } else {
        await api.patch(`/schedules/${id}/confirm`)
        toast.success('Serviço confirmado!')
        setRatingModal(true)
      }
      fetchSchedule()
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    }
  }

  const submitRating = async () => {
    setSubmittingRating(true)
    try {
      await api.post(`/schedules/${id}/rate`, {
        score: ratingScore,
        comment: ratingComment,
      })
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
  const canComplete = isProvider && schedule.status === 'IN_PROGRESS'
  const canConfirm = isClient && schedule.status === 'IN_PROGRESS' // simplified: provider marks done, client confirms
  const canRate = schedule.status === 'DONE' && schedule.order?.status !== 'RATED'

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900">
              {schedule.order?.title || 'Agendamento'}
            </h1>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusClass}`}>
              {SCHEDULE_STATUS_LABEL[schedule.status]}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            {formatDateTime(schedule.scheduled_at)}
          </p>
        </div>
      </div>

      {/* Parties */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {schedule.client && (
              <>
                <Avatar name={schedule.client.name} avatar={schedule.client.avatar} />
                <div>
                  <p className="text-xs text-gray-500">Cliente</p>
                  <p className="font-medium text-gray-900">{schedule.client.name}</p>
                </div>
              </>
            )}
          </div>
          <div className="text-gray-300 text-xl">↔</div>
          <div className="flex items-center gap-3">
            {schedule.provider && (
              <>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Prestador</p>
                  <p className="font-medium text-gray-900">{schedule.provider.name}</p>
                  <p className="text-xs text-gray-400">★ {schedule.provider.rating_avg?.toFixed(1)}</p>
                </div>
                <Avatar name={schedule.provider.name} avatar={schedule.provider.avatar} />
              </>
            )}
          </div>
        </div>

        {schedule.order?.final_price && (
          <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
            <span className="text-sm text-gray-500">Valor combinado</span>
            <span className="font-bold text-green-700">{formatCurrency(schedule.order.final_price)}</span>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 flex-wrap">
        {canCheckin && (
          <Button onClick={handleCheckin}>
            <LogIn className="w-4 h-4" /> Fazer Check-in
          </Button>
        )}
        {canComplete && (
          <Button onClick={handleComplete}>
            <CheckCircle className="w-4 h-4" /> Marcar como Concluído
          </Button>
        )}
        {canConfirm && (
          <Button onClick={handleComplete}>
            <CheckCircle className="w-4 h-4" /> Confirmar Conclusão
          </Button>
        )}
        {canRate && (
          <Button variant="secondary" onClick={() => setRatingModal(true)}>
            <Star className="w-4 h-4" /> Avaliar
          </Button>
        )}
      </div>

      {/* Chat */}
      <div className="bg-white rounded-2xl border border-gray-200 flex flex-col" style={{ height: '480px' }}>
        <div className="p-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Chat</h2>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <p className="text-center text-sm text-gray-400 pt-8">Nenhuma mensagem ainda. Diga olá!</p>
          )}
          {messages.map((msg) => {
            const isMine = msg.sender_id === user?.id
            return (
              <div key={msg.id} className={`flex gap-2 ${isMine ? 'flex-row-reverse' : ''}`}>
                {!isMine && (
                  <Avatar
                    name={msg.sender?.name || 'U'}
                    avatar={msg.sender?.avatar}
                    size="sm"
                  />
                )}
                <div
                  className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
                    isMine ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <p className="text-sm">{msg.content}</p>
                  <p className={`text-[10px] mt-0.5 ${isMine ? 'text-brand-100' : 'text-gray-400'}`}>
                    {formatRelative(msg.created_at)}
                  </p>
                </div>
              </div>
            )
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-gray-100 flex gap-2">
          <input
            type="text"
            placeholder="Digite uma mensagem..."
            value={msgText}
            onChange={(e) => setMsgText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <Button onClick={sendMessage} isLoading={sendingMsg} size="md">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Rating modal */}
      <Modal isOpen={ratingModal} onClose={() => setRatingModal(false)} title="Avaliar serviço">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
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
          <Button fullWidth onClick={submitRating} isLoading={submittingRating}>
            Enviar Avaliação
          </Button>
        </div>
      </Modal>
    </div>
  )
}
