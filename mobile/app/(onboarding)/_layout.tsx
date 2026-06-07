import { Stack, router } from 'expo-router'
import { useEffect } from 'react'
import { useAuthStore } from '../../src/store/auth'

export default function OnboardingLayout() {
  const { user } = useAuthStore()
  useEffect(() => {
    if (!user) router.replace('/(auth)/login')
  }, [user])
  if (!user) return null
  return <Stack screenOptions={{ headerShown: false }} />
}
