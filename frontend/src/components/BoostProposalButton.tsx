'use client'

import { useState } from 'react'
import { Star, Zap } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { api, getApiErrorMessage } from '@/lib/api'
import { toast } from 'react-hot-toast'

type Props = {
  proposalId: string
  currentLevel: number
  onBoosted?: () => void
}

const LEVEL_INFO = [
  null,
  { label: 'Destaque', price: 5, color: 'bg-amber-100 text-amber-700 border-amber-300', icon: '⭐', desc: 'Sua proposta aparece com destaque visual amarelo.' },
  { label: 'Topo', price: 15, color: 'bg-emerald-100 text-emerald-700 border-emerald-300', icon: '🚀', desc: 'Sua proposta vai para o topo da lista com selo "Recomendado".' },
] as const

export function BoostProposalButton({ proposalId, currentLevel, onBoosted }: Props) {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function boost(level: 1 | 2) {
    setSubmitting(true)
    try {
      await api.post(`/proposals/${proposalId}/boost`, { level })
      toast.success('Proposta destacada!')
      setOpen(false)
      onBoosted?.()
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (currentLevel >= 2) {
    return <span className="text-xs text-emerald-600 font-semibold">🚀 No topo</span>
  }

  return (
    <>
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true) }}
        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-300 text-amber-700 text-xs font-medium hover:bg-amber-100"
      >
        <Zap className="w-3 h-3" /> Destacar
      </button>
      <Modal isOpen={open} onClose={() => setOpen(false)} title="Destacar proposta">
        <div className="space-y-3">
          <p className="text-sm text-slate2-600">
            Destaque sua proposta para o cliente. O valor é debitado do seu saldo de prestador.
          </p>
          {([1, 2] as const).map((lvl) => {
            const info = LEVEL_INFO[lvl]!
            const disabled = currentLevel >= lvl
            return (
              <button
                key={lvl}
                disabled={disabled || submitting}
                onClick={() => boost(lvl)}
                className={`w-full text-left p-4 rounded-xl border-2 ${info.color} ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:scale-[1.02] transition-transform'}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold flex items-center gap-2">
                    {info.icon} {info.label}
                  </span>
                  <span className="font-bold">R$ {info.price.toFixed(2)}</span>
                </div>
                <p className="text-xs opacity-90">{info.desc}</p>
                {disabled && <p className="text-[10px] mt-1">Já contratado</p>}
              </button>
            )
          })}
          <p className="text-xs text-slate2-500 text-center pt-2">
            Boost é cobrado do seu saldo de prestador. Saldo insuficiente? Faça um saque ou aguarde um pagamento.
          </p>
        </div>
      </Modal>
    </>
  )
}
