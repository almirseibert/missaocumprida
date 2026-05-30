'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Calendar, Clock, User } from 'lucide-react'
import { api } from '@/lib/api'
import { Schedule } from '@/types'
import { useAuthStore } from '@/store/auth'
import { PageSpinner } from '@/components/ui/Spinner'
import { Avatar } from '@/components/ui/Avatar'
import { formatDateTime, SCHEDULE_STATUS_LABEL, SCHEDULE_STATUS_COLOR } from '@/lib/utils'

export default function AgendamentosPage() {
  const { user } = useAuthStore()
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/schedules').then((r) => setSchedules(r.data.data)).finally(() => setLoading(false))
  }, [])

  if (loading) return <PageSpinner />

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Agendamentos</h1>

      {schedules.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">📅</p>
          <p className="text-lg font-medium text-gray-700">Nenhum agendamento</p>
          <p className="text-sm text-gray-500 mt-1">Os agendamentos aparecem após aceite de proposta</p>
        </div>
      ) : (
        <div className="space-y-3">
          {schedules.map((schedule) => {
            const isProvider = user?.id === schedule.provider_id
            const otherParty = isProvider ? schedule.client : schedule.provider

            return (
              <Link
                key={schedule.id}
                href={`/agendamentos/${schedule.id}`}
                className="block bg-white rounded-2xl border border-gray-200 p-5 hover:border-brand-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${SCHEDULE_STATUS_COLOR[schedule.status]}`}>
                        {SCHEDULE_STATUS_LABEL[schedule.status]}
                      </span>
                      <span className="text-xs text-gray-500">
                        {isProvider ? 'Você é o prestador' : 'Você é o cliente'}
                      </span>
                    </div>

                    <h3 className="font-semibold text-gray-900">
                      {schedule.order?.title || 'Serviço agendado'}
                    </h3>

                    <div className="flex flex-wrap gap-3 mt-2 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDateTime(schedule.scheduled_at)}
                      </span>
                      {schedule.checkin_at && (
                        <span className="flex items-center gap-1 text-green-600">
                          <Clock className="w-3.5 h-3.5" />
                          Check-in: {formatDateTime(schedule.checkin_at)}
                        </span>
                      )}
                    </div>
                  </div>

                  {otherParty && (
                    <div className="flex items-center gap-2">
                      <Avatar name={otherParty.name} avatar={otherParty.avatar} size="sm" />
                      <div className="hidden sm:block">
                        <p className="text-xs text-gray-500">{isProvider ? 'Cliente' : 'Prestador'}</p>
                        <p className="text-sm font-medium text-gray-800">{otherParty.name.split(' ')[0]}</p>
                      </div>
                    </div>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
