'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth'
import { PageSpinner } from '@/components/ui/Spinner'

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const { accessToken, user, fetchMe, isLoading, _hasHydrated } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    if (!_hasHydrated) return
    if (!accessToken) router.replace('/login')
    else if (!user) fetchMe()
  }, [_hasHydrated, accessToken, user, fetchMe, router])

  if (!_hasHydrated) return <PageSpinner />
  if (!accessToken) return null
  if (isLoading || !user) return <PageSpinner />

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-slate2-50">
      <div className="max-w-2xl mx-auto px-4 py-10">{children}</div>
    </div>
  )
}
