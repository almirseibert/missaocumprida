'use client'

import { useState } from 'react'
import { Share2, Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { api, getApiErrorMessage } from '@/lib/api'

interface Props {
  orderId: string
  initialSlug?: string | null
  initialEnabled?: boolean
}

export function ShareOrderButton({ orderId, initialSlug, initialEnabled }: Props) {
  const [open, setOpen] = useState(false)
  const [slug, setSlug] = useState<string | null>(initialSlug ?? null)
  const [enabled, setEnabled] = useState<boolean>(!!initialEnabled)
  const [url, setUrl] = useState<string>(
    initialSlug ? `${typeof window !== 'undefined' ? window.location.origin : ''}/p/pedido/${initialSlug}` : ''
  )
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  async function openAndEnsure() {
    setOpen(true)
    if (slug && enabled) return
    setLoading(true)
    setError('')
    try {
      const r = await api.post(`/orders/${orderId}/share`)
      setSlug(r.data.data.slug)
      setUrl(r.data.data.url)
      setEnabled(true)
    } catch (e) {
      setError(getApiErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  async function disable() {
    setLoading(true)
    try {
      await api.delete(`/orders/${orderId}/share`)
      setEnabled(false)
    } catch (e) {
      setError(getApiErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  function copyUrl() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  async function shareNative() {
    if (!url) return
    const text = `Estou precisando deste serviço — você pode ajudar?\n${url}`
    if (navigator.share) {
      try { await navigator.share({ title: 'Missão Cumprida', text, url }) } catch {}
    } else {
      copyUrl()
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={openAndEnsure}>
        <Share2 size={14} className="mr-1.5" /> Compartilhar
      </Button>
      {open && (
        <Modal isOpen={open} title="Compartilhar pedido" onClose={() => setOpen(false)}>
          <p className="text-sm text-slate2-600 mb-3">
            Gere um link público para enviar em redes sociais, WhatsApp ou comunidades.
            Quem clicar pode ver o pedido e se cadastrar como prestador para enviar uma proposta.
          </p>

          {error && <div className="text-sm text-red-600 mb-2">{error}</div>}

          {loading ? (
            <div className="text-sm text-slate2-500">Carregando...</div>
          ) : enabled && url ? (
            <>
              <div className="flex items-stretch gap-2 mb-3">
                <div className="flex-1 px-3 py-2 bg-slate2-50 border border-slate2-200 rounded-lg text-sm break-all">
                  {url}
                </div>
                <Button variant="outline" size="sm" onClick={copyUrl}>
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </Button>
              </div>
              <div className="flex gap-2">
                <Button onClick={shareNative} className="flex-1">
                  <Share2 size={14} className="mr-1.5" /> Compartilhar
                </Button>
                <Button variant="ghost" size="sm" onClick={disable}>
                  Desativar link
                </Button>
              </div>
            </>
          ) : !enabled ? (
            <Button onClick={openAndEnsure}>Reativar link</Button>
          ) : null}
        </Modal>
      )}
    </>
  )
}
