import { create } from 'zustand'
import { api } from '../lib/api'
import { getAccessToken, getRefreshToken, setTokens as secureSetTokens, clearTokens } from '../lib/secureStore'
import { configurePurchases, loginPurchases, logoutPurchases } from '../lib/purchases'
import { resetNotificationCache, unregisterPushToken } from '../lib/notifications'
import { User } from '../types'

interface AuthState {
  user: User | null
  accessToken: string | null
  isLoading: boolean
  isHydrated: boolean
  setUser: (user: User) => void
  setTokens: (access: string, refresh: string) => Promise<void>
  logout: () => Promise<void>
  fetchMe: () => Promise<void>
  hydrate: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  isLoading: false,
  isHydrated: false,

  setUser: (user) => set({ user }),

  setTokens: async (access, refresh) => {
    await secureSetTokens(access, refresh)
    set({ accessToken: access })
  },

  logout: async () => {
    try {
      const refreshToken = await getRefreshToken()
      if (refreshToken) await api.post('/auth/logout', { refreshToken }).catch(() => {})
    } catch {}
    await unregisterPushToken()
    await logoutPurchases()
    await clearTokens()
    await resetNotificationCache()
    set({ user: null, accessToken: null })
  },

  fetchMe: async () => {
    set({ isLoading: true })
    try {
      const { data } = await api.get('/users/me')
      set({ user: data.data })
      // Associa as compras (RevenueCat) ao id do usuário do backend.
      if (data.data?.id) loginPurchases(data.data.id).catch(() => {})
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 401) {
        await clearTokens()
        set({ user: null, accessToken: null })
      }
    } finally {
      set({ isLoading: false })
    }
  },

  hydrate: async () => {
    configurePurchases()
    const token = await getAccessToken()
    if (token) {
      set({ accessToken: token })
      await get().fetchMe()
    }
    set({ isHydrated: true })
  },
}))
