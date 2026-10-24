'use client'

import { ServicePhoto } from '@/types'
import { formatDateTime } from '@/lib/utils'

const STAGE_LABEL: Record<ServicePhoto['stage'], string> = {
  ORDER: 'Fotos do pedido',
  CHECKIN: 'Início do serviço (check-in)',
  COMPLETION: 'Serviço concluído',
}

/** Galeria das fotos enviadas pelo prestador no check-in e na conclusão. */
export function ServicePhotoGallery({ photos }: { photos: ServicePhoto[] }) {
  const stages = (['CHECKIN', 'COMPLETION', 'ORDER'] as const).filter((s) => photos.some((p) => p.stage === s))
  if (stages.length === 0) return null
  return (
    <div className="space-y-3">
      {stages.map((stage) => {
        const list = photos.filter((p) => p.stage === stage)
        return (
          <div key={stage}>
            <p className="text-sm font-medium text-slate2-500 mb-2">
              {STAGE_LABEL[stage]}{' '}
              <span className="text-xs text-slate2-400">· {formatDateTime(list[0].created_at)}</span>
            </p>
            <div className="flex gap-2 flex-wrap">
              {list.map((p) => (
                <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt="" className="w-20 h-20 rounded-xl object-cover border border-slate2-200" />
                </a>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
