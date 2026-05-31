import '../src/global.css'
import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import { useAuthStore } from '../src/store/auth'

SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const { hydrate, isHydrated } = useAuthStore()

  useEffect(() => {
    hydrate().finally(() => SplashScreen.hideAsync())
  }, [])

  if (!isHydrated) return null

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
      </Stack>
    </>
  )
}
