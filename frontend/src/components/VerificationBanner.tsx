'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ShieldAlert, Clock, AlertCircle } from 'lucide-react'
import { useAuthStore } from '@/store/auth'

export function VerificationBanner() {
  const { user } = useAuthStore()
  const pathname = usePathname()

  // Não mostrar na própria página de verificação ou para admins
  if (!user || user.role === 'ADMIN') return null
  if (pathname?.startsWith('/verificacao')) return null
  if (!user.terms_accepted_at) return null

  const status = user.document_verification_status ?? 'NONE'
  if (status === 'APPROVED') return null

  let icon = <ShieldAlert className="w-4 h-4 flex-shrink-0" />
  let bg = 'bg-amber-50 border-amber-200 text-amber-900'
  let title = 'Complete seu cadastro e verificação'
  let body = 'Preencha CPF, RG, endereço e contato de emergência, e envie documento + selfie para criar pedidos e enviar propostas.'

  if (status === 'PENDING') {
    icon = <Clock className="w-4 h-4 flex-shrink-0 animate-pulse" />
    bg = 'bg-brand-50 border-brand-200 text-brand-900'
    title = 'Documentos em análise'
    body = 'Recebemos seus arquivos. Você será notificado em até 48 horas úteis.'
  } else if (status === 'REJECTED') {
    icon = <AlertCircle className="w-4 h-4 flex-shrink-0" />
    bg = 'bg-red-50 border-red-200 text-red-900'
    title = 'Verificação recusada'
    body = user.document_rejection_reason ?? 'Reenvie suas imagens para nova análise.'
  }

  return (
    <div className={`border-b ${bg}`}>
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center gap-3 text-sm">
        {icon}
        <div className="flex-1 leading-tight">
          <span className="font-semibold">{title}.</span>{' '}
          <span className="opacity-90">{body}</span>
        </div>
        {status !== 'PENDING' && (
          <Link
            href="/verificacao"
            className="text-xs font-semibold underline whitespace-nowrap"
          >
            {status === 'REJECTED' ? 'Reenviar' : 'Verificar agora'} →
          </Link>
        )}
      </div>
    </div>
  )
}
