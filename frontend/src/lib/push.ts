import { api } from './api'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output
}

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null
  try {
    const existing = await navigator.serviceWorker.getRegistration('/sw.js')
    if (existing) return existing
    return await navigator.serviceWorker.register('/sw.js')
  } catch (err) {
    console.warn('[push] sw register failed:', err)
    return null
  }
}

export async function requestPushPermission(): Promise<NotificationPermission> {
  if (!isPushSupported()) return 'denied'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  return await Notification.requestPermission()
}

const PUSH_TOKEN_KEY = 'mc:push-token'

export async function subscribeAndRegisterWithBackend(): Promise<boolean> {
  if (!isPushSupported()) return false
  if (!VAPID_PUBLIC_KEY) {
    console.warn('[push] NEXT_PUBLIC_VAPID_PUBLIC_KEY ausente — push desabilitado')
    return false
  }
  const permission = await requestPushPermission()
  if (permission !== 'granted') return false
  const reg = await registerServiceWorker()
  if (!reg) return false
  try {
    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as BufferSource,
      })
    }
    const tokenStr = JSON.stringify(sub.toJSON())
    const cached = localStorage.getItem(PUSH_TOKEN_KEY)
    if (cached === tokenStr) return true
    await api.post('/push/register', { token: tokenStr, platform: 'WEB' })
    localStorage.setItem(PUSH_TOKEN_KEY, tokenStr)
    return true
  } catch (err) {
    console.warn('[push] subscribe failed:', err)
    return false
  }
}

export async function unsubscribePush(): Promise<void> {
  if (!isPushSupported()) return
  try {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js')
    const sub = await reg?.pushManager.getSubscription()
    const cached = localStorage.getItem(PUSH_TOKEN_KEY)
    if (cached) {
      try { await api.delete(`/push/token/${encodeURIComponent(cached)}`) } catch {}
    }
    if (sub) await sub.unsubscribe()
    localStorage.removeItem(PUSH_TOKEN_KEY)
  } catch { /* silencia */ }
}
