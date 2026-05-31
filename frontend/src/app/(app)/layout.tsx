'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Navbar } from '@/components/layout/Navbar'
import { useAuthStore } from '@/store/auth'
import { PageSpinner } from '@/components/ui/Spinner'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { accessToken, user, fetchMe, isLoading, _hasHydrated } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    if (!_hasHydrated) return
    if (!accessToken) {
      router.replace('/login')
    } else if (!user) {
      fetchMe()
    }
  }, [_hasHydrated, accessToken, user, fetchMe, router])

  // Wait for store to rehydrate from localStorage before making any auth decision
  if (!_hasHydrated) return <PageSpinner />
  if (!accessToken) return null
  if (isLoading || !user) return <PageSpinner />

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </div>
  )
}
