'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { PageSpinner } from '@/components/ui/Spinner'

// A assinatura Pro agora fica em /assinaturas (para clientes e prestadores).
// Mantido para links antigos.
export default function VerificarRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/assinaturas') }, [router])
  return <PageSpinner />
}
