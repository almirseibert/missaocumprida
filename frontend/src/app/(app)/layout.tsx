'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Navbar } from '@/components/layout/Navbar'
import { useAuthStore } from '@/store/auth'
import { PageSpinner } from '@/components/ui/Spinner'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { accessToken, user, fetchMe, isLoading } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    if (!accessToken) {
      router.replace('/login')
    } else if (!user) {
      fetchMe()
    }
  }, [accessToken, user, fetchMe, router])

  if (!accessToken) return null
  if (!user) return <PageSpinner />

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </div>
  )
}
