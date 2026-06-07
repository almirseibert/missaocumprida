import '../src/global.css'
import { useEffect } from 'react'
import { LogBox } from 'react-native'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import {
  useFonts as useJakarta,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans'
import {
  useFonts as useDm,
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
} from '@expo-google-fonts/dm-sans'
import { useAuthStore } from '../src/store/auth'
import {
  registerPushTokenWithBackend,
  attachNotificationListeners,
  isNotificationsAvailable,
} from '../src/lib/notifications'
import { router } from 'expo-router'
import * as Linking from 'expo-linking'
import AsyncStorage from '@react-native-async-storage/async-storage'

// Silencia warnings conhecidos do Expo Go SDK 56 que não afetam runtime:
//  - expo-notifications: push (remote) foi removida do Expo Go (a detecção
//    em src/lib/notifications.ts já evita o require, mas o LogBox ainda pode
//    capturar avisos disparados por outras deps).
//  - "Sending ..." e "Non-serializable values" — ruído de navigation que não
//    indica bug em Expo Router.
LogBox.ignoreLogs([
  'expo-notifications: Android Push notifications',
  'Sending `onAnimatedValueUpdate`',
  'Non-serializable values were found in the navigation state',
])

SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const { hydrate, isHydrated } = useAuthStore()
  const [jakartaLoaded] = useJakarta({
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  })
  const [dmLoaded] = useDm({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
  })

  const accessToken = useAuthStore((s) => s.accessToken)

  useEffect(() => {
    hydrate().finally(() => {
      if (jakartaLoaded && dmLoaded) SplashScreen.hideAsync()
    })
  }, [hydrate, jakartaLoaded, dmLoaded])

  // Registra push token quando autenticado
  useEffect(() => {
    if (!accessToken || !isNotificationsAvailable()) return
    registerPushTokenWithBackend().catch(() => {})
  }, [accessToken])

  // Deep links: missaocumprida://convite/CODE → guarda código pro registro
  useEffect(() => {
    function handle(url: string | null) {
      if (!url) return
      try {
        const parsed = Linking.parse(url)
        const path = (parsed.path || parsed.hostname || '').replace(/^\/+/, '')
        const parts = path.split('/').filter(Boolean)
        if (parts[0] === 'convite' && parts[1]) {
          const code = parts[1].toUpperCase()
          AsyncStorage.setItem('@mc:pending-referral', code).catch(() => {})
          if (!accessToken) router.push('/(auth)/register' as any)
        } else if (parts[0] === 'pedido' && parts[1]) {
          if (accessToken) router.push(`/(app)/pedido/${parts[1]}` as any)
        }
      } catch { /* silencia */ }
    }
    Linking.getInitialURL().then(handle)
    const sub = Linking.addEventListener('url', (e) => handle(e.url))
    return () => sub.remove()
  }, [accessToken])

  // Listeners de push (foreground/background)
  useEffect(() => {
    if (!isNotificationsAvailable()) return
    const cleanup = attachNotificationListeners({
      onResponse: (data) => {
        if (!data) return
        if (data.order_id) router.push(`/(app)/pedido/${data.order_id}`)
        else if (data.schedule_id) router.push(`/(app)/agendamento/${data.schedule_id}`)
      },
    })
    return cleanup
  }, [])

  if (!isHydrated || !jakartaLoaded || !dmLoaded) return null

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
        <Stack.Screen name="(onboarding)" />
      </Stack>
    </>
  )
}
