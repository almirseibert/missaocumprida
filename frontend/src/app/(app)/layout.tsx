'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Navbar } from '@/components/layout/Navbar'
import { TermsModal } from '@/components/TermsModal'
import { VerificationBanner } from '@/components/VerificationBanner'
import { useAuthStore } from '@/store/auth'
import { PageSpinner } from '@/components/ui/Spinner'
import { subscribeAndRegisterWithBackend, isPushSupported } from '@/lib/push'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { accessToken, user, fetchMe, isLoading, _hasHydrated } = useAuthStore()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!_hasHydrated) return
    if (!accessToken) {
      router.replace('/login')
    } else if (!user) {
      fetchMe()
    }
  }, [_hasHydrated, accessToken, user, fetchMe, router])

  // Tenta registrar push (silencioso se permissão for negada)
  useEffect(() => {
    if (!user || !isPushSupported()) return
    subscribeAndRegisterWithBackend().catch(() => {})
  }, [user?.id])

  // Redireciona para onboarding se ainda não concluído
  useEffect(() => {
    if (!user) return
    if (pathname?.startsWith('/comecar')) return
    const state = user.onboarding_state ?? {}
    const isProvider = user.role === 'PROVIDER' || user.role === 'BOTH'
    const isClient = user.role === 'CLIENT' || user.role === 'BOTH'
    const providerDone = state.provider?.completed === true
    const clientDone = state.client?.completed === true
    // Provider tem prioridade sobre client (caso BOTH)
    if (isProvider && !providerDone) router.replace('/comecar/prestador')
    else if (isClient && !clientDone) router.replace('/comecar/cliente')
  }, [user, pathname, router])

  // Wait for store to rehydrate from localStorage before making any auth decision
  if (!_hasHydrated) return <PageSpinner />
  if (!accessToken) return null
  if (isLoading || !user) return <PageSpinner />

  return (
    <div className="min-h-screen bg-slate2-50">
      <Navbar />
      <VerificationBanner />
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
      <TermsModal />
    </div>
  )
}
