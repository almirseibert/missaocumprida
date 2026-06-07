'use client'

import { useEffect, useState } from 'react'
import { ShieldCheck, AlertTriangle } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { Button } from '@/components/ui/Button'
import toast from 'react-hot-toast'

interface TermsPayload {
  version: string
  title: string
  effective_date: string
  body: string
}

export function TermsModal() {
  const { user, fetchMe } = useAuthStore()
  const [terms, setTerms] = useState<TermsPayload | null>(null)
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const needsAccept = !!user && (!user.terms_accepted_at || user.terms_version !== terms?.version)

  useEffect(() => {
    api.get('/legal/terms').then((r) => setTerms(r.data.data)).catch(() => {})
  }, [])

  if (!user) return null
  if (!terms) return null

  // Após carregar termos, só mostra se o usuário ainda não aceitou esta versão
  const userVersion = user.terms_accepted_at ? user.terms_version : null
  const isNewVersion = userVersion && userVersion !== terms.version
  const shouldShow = !user.terms_accepted_at || isNewVersion
  if (!shouldShow) return null

  async function accept() {
    if (!agreed) return
    setSubmitting(true)
    try {
      await api.post('/legal/terms/accept')
      await fetchMe()
      toast.success('Termos aceitos. Bem-vindo(a)!')
    } catch {
      toast.error('Não foi possível registrar a aceitação. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6">
      <div className="bg-white w-full max-w-3xl max-h-[92vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-brand-500 to-brand-600 text-white px-6 py-5 flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg sm:text-xl font-bold">{terms.title}</h2>
            <p className="text-xs text-brand-100 mt-0.5">
              Versão {terms.version} · Vigente a partir de {new Date(terms.effective_date).toLocaleDateString('pt-BR')}
            </p>
          </div>
        </div>

        {isNewVersion && (
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex items-center gap-2 text-sm text-amber-800">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>Os termos foram atualizados. Leia e aceite a nova versão para continuar.</span>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 prose prose-sm max-w-none">
          <MarkdownRender source={terms.body} />
        </div>

        {/* Footer */}
        <div className="border-t border-slate2-200 px-6 py-4 bg-slate2-50 space-y-3">
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 w-5 h-5 rounded border-slate2-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
            />
            <span className="text-sm text-slate2-700 leading-tight">
              Li integralmente os termos acima, compreendi as condições e a isenção de
              responsabilidade da plataforma, e <strong>aceito</strong> vincular-me a todas
              as regras estabelecidas.
            </span>
          </label>
          <div className="flex justify-end gap-3">
            <Button
              onClick={accept}
              disabled={!agreed || submitting}
              isLoading={submitting}
              size="lg"
            >
              Aceitar e continuar
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Mini renderer markdown — só o suficiente para os termos
// ---------------------------------------------------------------------------
function MarkdownRender({ source }: { source: string }) {
  const lines = source.split('\n')
  const blocks: React.ReactNode[] = []
  let listBuffer: string[] = []

  const flushList = () => {
    if (listBuffer.length === 0) return
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="list-disc pl-6 space-y-1 text-sm text-slate2-700">
        {listBuffer.map((item, i) => (
          <li key={i} dangerouslySetInnerHTML={{ __html: inline(item) }} />
        ))}
      </ul>
    )
    listBuffer = []
  }

  for (const raw of lines) {
    const line = raw.trim()
    if (line.startsWith('## ')) {
      flushList()
      blocks.push(<h3 key={`h-${blocks.length}`} className="text-base font-bold text-slate2-900 mt-5 mb-2">{line.slice(3)}</h3>)
    } else if (line.startsWith('- ')) {
      listBuffer.push(line.slice(2))
    } else if (line === '---') {
      flushList()
      blocks.push(<hr key={`hr-${blocks.length}`} className="my-4 border-slate2-200" />)
    } else if (line === '') {
      flushList()
    } else {
      flushList()
      blocks.push(<p key={`p-${blocks.length}`} className="text-sm text-slate2-700 leading-relaxed mb-3" dangerouslySetInnerHTML={{ __html: inline(line) }} />)
    }
  }
  flushList()
  return <>{blocks}</>
}

// **negrito** → <strong>
function inline(s: string): string {
  return s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
}
