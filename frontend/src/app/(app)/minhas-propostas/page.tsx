'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Proposal } from '@/types'
import { PageSpinner } from '@/components/ui/Spinner'
import { formatRelative, PROPOSAL_STATUS_LABEL } from '@/lib/utils'
import { BoostProposalButton } from '@/components/BoostProposalButton'

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  ACCEPTED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-slate2-100 text-slate2-500',
}

export default function MinhasPropostasPage() {
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    api.get('/proposals/mine')
      .then((r) => setProposals(r.data.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <PageSpinner />

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-slate2-900">Minhas Propostas</h1>

      {error ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">⚠️</p>
          <p className="text-lg font-medium text-slate2-700">Erro ao carregar propostas</p>
          <p className="text-sm text-slate2-500 mt-1">Verifique sua conexão e tente novamente.</p>
        </div>
      ) : proposals.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-lg font-medium text-slate2-700">Nenhuma proposta enviada</p>
          <p className="text-sm text-slate2-500 mt-1">Explore o feed e envie propostas para os pedidos disponíveis.</p>
          <Link
            href="/feed"
            className="inline-block mt-4 px-4 py-2 bg-brand-500 text-white rounded-lg text-sm font-medium hover:bg-brand-600 transition-colors"
          >
            Ver Feed de Pedidos
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {proposals.map((proposal) => (
            <Link
              key={proposal.id}
              href={`/pedido/${proposal.order_id}`}
              className="flex items-start justify-between gap-3 p-4 bg-white rounded-2xl border border-slate2-200 hover:border-brand-300 hover:shadow-sm transition-all"
            >
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate2-900 truncate">
                  {proposal.order?.category?.icon} {proposal.order?.title || 'Pedido'}
                </p>
                <p className="text-xs text-slate2-500 mt-1">{formatRelative(proposal.created_at)}</p>
                {proposal.message && (
                  <p className="text-sm text-slate2-600 mt-1 truncate">{proposal.message}</p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[proposal.status]}`}>
                  {PROPOSAL_STATUS_LABEL[proposal.status]}
                </span>
                <span className="text-sm font-bold text-slate2-800">
                  R$ {proposal.value.toFixed(2)}
                </span>
                {(proposal.boost_level ?? 0) > 0 && (
                  <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                    {proposal.boost_level === 2 ? '🚀 Topo' : '⭐ Destaque'}
                  </span>
                )}
                {proposal.status === 'PENDING' && (proposal.boost_level ?? 0) < 2 && (
                  <BoostProposalButton
                    proposalId={proposal.id}
                    currentLevel={proposal.boost_level ?? 0}
                    onBoosted={() => api.get('/proposals/mine').then(r => setProposals(r.data.data))}
                  />
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
