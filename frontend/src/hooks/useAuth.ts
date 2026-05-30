'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth'
import { UserRole } from '@/types'

export function useAuth() {
  return useAuthStore()
}

export function useRequireAuth(allowedRoles?: UserRole[]) {
  const { user, accessToken, fetchMe, isLoading } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    if (!accessToken) {
      router.replace('/login')
      return
    }
    if (!user) {
      fetchMe()
    }
  }, [accessToken, user, fetchMe, router])

  useEffect(() => {
    if (!isLoading && user && allowedRoles) {
      const hasRole =
        user.role === 'ADMIN' ||
        allowedRoles.includes(user.role) ||
        (user.role === 'BOTH' &&
          (allowedRoles.includes('CLIENT') || allowedRoles.includes('PROVIDER')))
      if (!hasRole) router.replace('/home')
    }
  }, [user, isLoading, allowedRoles, router])

  return { user, isLoading }
}
