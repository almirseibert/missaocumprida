import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { api } from '../lib/api'
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
    await AsyncStorage.setItem('accessToken', access)
    await AsyncStorage.setItem('refreshToken', refresh)
    set({ accessToken: access })
  },

  logout: async () => {
    try {
      const refreshToken = await AsyncStorage.getItem('refreshToken')
      if (refreshToken) await api.post('/auth/logout', { refreshToken }).catch(() => {})
    } catch {}
    await AsyncStorage.multiRemove(['accessToken', 'refreshToken'])
    set({ user: null, accessToken: null })
  },

  fetchMe: async () => {
    set({ isLoading: true })
    try {
      const { data } = await api.get('/users/me')
      set({ user: data.data })
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 401) {
        await AsyncStorage.multiRemove(['accessToken', 'refreshToken'])
        set({ user: null, accessToken: null })
      }
    } finally {
      set({ isLoading: false })
    }
  },

  hydrate: async () => {
    const token = await AsyncStorage.getItem('accessToken')
    if (token) {
      set({ accessToken: token })
      await get().fetchMe()
    }
    set({ isHydrated: true })
  },
}))
