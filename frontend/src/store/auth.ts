import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { User } from '@/types'
import { api } from '@/lib/api'

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isLoading: boolean
  _hasHydrated: boolean
  setHasHydrated: (v: boolean) => void
  setTokens: (accessToken: string, refreshToken: string) => void
  setUser: (user: User) => void
  logout: () => Promise<void>
  fetchMe: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isLoading: false,
      _hasHydrated: false,

      setHasHydrated: (v) => set({ _hasHydrated: v }),

      setTokens: (accessToken, refreshToken) => {
        localStorage.setItem('accessToken', accessToken)
        localStorage.setItem('refreshToken', refreshToken)
        set({ accessToken, refreshToken })
      },

      setUser: (user) => set({ user }),

      logout: async () => {
        try {
          const { refreshToken } = get()
          if (refreshToken) await api.post('/auth/logout', { refreshToken })
        } catch {}
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
        set({ user: null, accessToken: null, refreshToken: null })
      },

      fetchMe: async () => {
        set({ isLoading: true })
        try {
          const { data } = await api.get('/users/me')
          set({ user: data.data })
        } catch (err: unknown) {
          const status = (err as { response?: { status?: number } })?.response?.status
          // Only clear session on explicit 401 — not on network/server errors
          if (status === 401) {
            localStorage.removeItem('accessToken')
            localStorage.removeItem('refreshToken')
            set({ user: null, accessToken: null, refreshToken: null })
          }
        } finally {
          set({ isLoading: false })
        }
      },
    }),
    {
      name: 'mc-auth',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    }
  )
)
