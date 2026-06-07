'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Repeat } from 'lucide-react'
import toast from 'react-hot-toast'
import { api, getApiErrorMessage } from '@/lib/api'
import { Schedule } from '@/types'
import { PageSpinner } from '@/components/ui/Spinner'
import { Card } from '@/components/ui/Card'
import { Avatar } from '@/components/ui/Avatar'
import { MakeRecurringButton } from '@/components/MakeRecurringButton'

export default function NovaAssinaturaPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get('/schedules')
      .then((r) => {
        const list: Schedule[] = r.data.data || []
        setSchedules(
          list.filter(
            (s) =>
              s.status === 'DONE' &&
              s.order?.category_id &&
              s.provider_id,
          ),
        )
      })
      .catch((err) => toast.error(getApiErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <PageSpinner />

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/assinaturas" className="p-2 rounded-lg hover:bg-slate2-100">
          <ArrowLeft className="w-5 h-5 text-slate2-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Repeat className="w-6 h-6 text-brand-700" /> Nova assinatura
          </h1>
          <p className="text-sm text-slate2-500">
            Escolha um serviço já concluído para transformar em recorrência.
          </p>
        </div>
      </div>

      {schedules.length === 0 ? (
        <Card className="p-8 text-center">
          <Repeat className="w-12 h-12 text-slate2-400 mx-auto mb-3" />
          <p className="text-slate2-600">
            Você ainda não tem serviços concluídos para tornar recorrentes.
          </p>
          <Link href="/home" className="text-brand-700 underline text-sm mt-2 inline-block">
            Contratar um serviço
          </Link>
        </Card>
      ) : (
        <div className="space-y-3">
          {schedules.map((s) => (
            <Card key={s.id} className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <Avatar avatar={s.provider?.avatar ?? undefined} name={s.provider?.name || ''} size="md" />
                <div className="flex-1">
                  <div className="font-semibold text-slate2-900">{s.order?.title}</div>
                  <div className="text-xs text-slate2-500">
                    com {s.provider?.name} · {s.order?.category?.name}
                  </div>
                </div>
                {s.order?.final_price != null && (
                  <div className="text-sm font-semibold text-slate2-700">
                    R$ {s.order.final_price.toFixed(2)}
                  </div>
                )}
              </div>
              <MakeRecurringButton schedule={s} />
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
