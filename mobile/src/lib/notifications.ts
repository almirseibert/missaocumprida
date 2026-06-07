import { Platform, NativeModules } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { api } from './api'
import { Notification as AppNotification } from '../types'

const CUSTOM_SOUND = 'notification.wav'
const ANDROID_CHANNEL_ID = 'missao-cumprida-default'
const URGENT_CHANNEL_ID = 'urgent_orders'
const LAST_SEEN_KEY = '@mc:last-notification-id'
const PUSH_TOKEN_KEY = '@mc:push-token'

// ---------------------------------------------------------------------------
// Detecta Expo Go (SDK 53+ removeu push do client).
// Em Expo Go, NativeModules.NativeUnimoduleProxy expõe ExponentConstants com
// `executionEnvironment === 'storeClient'`. Em dev build / standalone vem
// 'bare' ou 'standalone'.
//
// Importante: nunca chamar `require('expo-notifications')` em Expo Go porque
// o módulo dispara `console.error` no escopo global de
// DevicePushTokenAutoRegistration.fx.js, que o LogBox renderiza como ERROR
// vermelho mesmo sem throw. A detecção precisa acontecer ANTES do require.
// ---------------------------------------------------------------------------
function detectIsExpoGo(): boolean {
  try {
    const proxy: any = NativeModules.NativeUnimoduleProxy
    const consts = proxy?.modulesConstants?.ExponentConstants
    if (consts?.executionEnvironment === 'storeClient') return true
    if (consts?.appOwnership === 'expo') return true
    // Heurística secundária: em Expo Go o NativeModule de push não está
    // registrado. Fora de Expo Go ele existe.
    const hasPushModule =
      !!NativeModules.ExpoPushTokenManager ||
      !!NativeModules.ExpoNotificationPresentationModule
    return !hasPushModule
  } catch {
    return true // melhor pecar pelo silêncio
  }
}

const isExpoGo = detectIsExpoGo()

// ---------------------------------------------------------------------------
// Carga preguiçosa de expo-notifications — só ocorre fora de Expo Go.
// ---------------------------------------------------------------------------
type NotificationsModule = typeof import('expo-notifications')

let cachedModule: NotificationsModule | null = null
let initialized = false
let handlerSet = false

function getNotifications(): NotificationsModule | null {
  if (initialized) return cachedModule
  initialized = true
  if (isExpoGo) {
    // No-op silencioso. Sem warn — o usuário já sabe que está em Expo Go.
    return null
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-notifications') as NotificationsModule
    if (!mod || typeof mod.setNotificationHandler !== 'function') return null
    cachedModule = mod
    if (!handlerSet) {
      mod.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      })
      handlerSet = true
    }
    return mod
  } catch (err) {
    console.warn('[notifications] expo-notifications falhou:', err)
    return null
  }
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------
export async function configureNotifications(): Promise<boolean> {
  const N = getNotifications()
  if (!N) return false
  try {
    if (Platform.OS === 'android') {
      await N.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
        name: 'Missão Cumprida',
        description: 'Atualizações de pedidos, propostas e mensagens',
        importance: N.AndroidImportance.HIGH,
        sound: CUSTOM_SOUND,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#1D4ED8', // brand-700
        enableVibrate: true,
        showBadge: true,
      })
      // Canal de urgência: prioridade MAX, vibração agressiva, som forte, bypass DND
      await N.setNotificationChannelAsync(URGENT_CHANNEL_ID, {
        name: 'Pedidos urgentes',
        description: 'Alertas de pedidos urgentes perto de você (2h para responder)',
        importance: N.AndroidImportance.MAX,
        sound: CUSTOM_SOUND,
        vibrationPattern: [0, 500, 250, 500, 250, 500],
        lightColor: '#E11D48', // rose-600
        enableVibrate: true,
        showBadge: true,
        bypassDnd: true,
        lockscreenVisibility: N.AndroidNotificationVisibility.PUBLIC,
      })
    }
    const { status } = await N.getPermissionsAsync()
    if (status === 'granted') return true
    const req = await N.requestPermissionsAsync()
    return req.status === 'granted'
  } catch (err) {
    console.warn('[notifications] erro ao configurar:', err)
    return false
  }
}

export async function showLocalNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>,
) {
  const N = getNotifications()
  if (!N) return
  try {
    await N.scheduleNotificationAsync({
      content: { title, body, data: data ?? {}, sound: CUSTOM_SOUND },
      trigger: null,
    })
  } catch (err) {
    console.warn('[notifications] erro ao agendar:', err)
  }
}

let pollingHandle: ReturnType<typeof setInterval> | null = null

export async function startNotificationPolling(intervalMs = 20000) {
  if (pollingHandle) return
  await checkNewNotifications()
  pollingHandle = setInterval(() => { checkNewNotifications().catch(() => {}) }, intervalMs)
}

export function stopNotificationPolling() {
  if (pollingHandle) {
    clearInterval(pollingHandle)
    pollingHandle = null
  }
}

async function checkNewNotifications() {
  try {
    const res = await api.get('/notifications')
    const list: AppNotification[] = res.data?.data?.notifications ?? []
    if (list.length === 0) return
    const lastSeen = await AsyncStorage.getItem(LAST_SEEN_KEY)
    const newest = list[0]
    if (!newest || lastSeen === newest.id) return
    const newOnes: AppNotification[] = []
    for (const n of list) {
      if (n.id === lastSeen) break
      if (!n.read) newOnes.push(n)
    }
    for (const n of newOnes.reverse()) {
      await showLocalNotification(n.title, n.body, n.data ?? {})
    }
    await AsyncStorage.setItem(LAST_SEEN_KEY, newest.id)
  } catch { /* silencia — rede/auth */ }
}

export async function resetNotificationCache() {
  await AsyncStorage.removeItem(LAST_SEEN_KEY)
  stopNotificationPolling()
}

/** true se notificações OS-level estão disponíveis (development build). */
export function isNotificationsAvailable(): boolean {
  return !isExpoGo && getNotifications() != null
}

// ---------------------------------------------------------------------------
// Registro de Push Token real (Expo Push Service)
// ---------------------------------------------------------------------------
export async function registerPushTokenWithBackend(): Promise<string | null> {
  const N = getNotifications()
  if (!N) return null
  try {
    const granted = await configureNotifications()
    if (!granted) return null

    // SDK 56: getExpoPushTokenAsync precisa do projectId em alguns ambientes
    let projectId: string | undefined
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Constants = require('expo-constants').default
      projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ??
        Constants?.easConfig?.projectId
    } catch { /* não bloqueia */ }

    const tokenData = await N.getExpoPushTokenAsync(projectId ? { projectId } : undefined as any)
    const token = tokenData.data
    if (!token) return null

    const cached = await AsyncStorage.getItem(PUSH_TOKEN_KEY)
    if (cached === token) return token // já registrado

    await api.post('/push/register', { token, platform: 'EXPO' })
    await AsyncStorage.setItem(PUSH_TOKEN_KEY, token)
    return token
  } catch (err) {
    console.warn('[notifications] registerPushTokenWithBackend falhou:', err)
    return null
  }
}

export async function unregisterPushToken(): Promise<void> {
  try {
    const token = await AsyncStorage.getItem(PUSH_TOKEN_KEY)
    if (token) {
      try {
        await api.delete(`/push/token/${encodeURIComponent(token)}`)
      } catch { /* não bloqueia logout */ }
    }
    await AsyncStorage.removeItem(PUSH_TOKEN_KEY)
  } catch { /* silencia */ }
}

/**
 * Anexa listeners de notification recebida (foreground) e tap (background).
 * Devolve um cleanup. Use no _layout raiz.
 */
export function attachNotificationListeners(handlers: {
  onReceive?: (notification: any) => void
  onResponse?: (data: any) => void
}): () => void {
  const N = getNotifications()
  if (!N) return () => {}
  const subRecv = N.addNotificationReceivedListener((n: any) => {
    handlers.onReceive?.(n)
  })
  const subResp = N.addNotificationResponseReceivedListener((r: any) => {
    handlers.onResponse?.(r?.notification?.request?.content?.data ?? {})
  })
  return () => {
    subRecv?.remove?.()
    subResp?.remove?.()
  }
}
