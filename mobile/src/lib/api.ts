import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'
import AsyncStorage from '@react-native-async-storage/async-storage'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3333'

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
})

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await AsyncStorage.getItem('accessToken')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean }
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      try {
        const refreshToken = await AsyncStorage.getItem('refreshToken')
        if (!refreshToken) throw new Error('sem refresh token')
        const { data } = await axios.post(`${API_URL}/api/auth/refresh`, { refreshToken })
        await AsyncStorage.setItem('accessToken', data.data.accessToken)
        await AsyncStorage.setItem('refreshToken', data.data.refreshToken)
        original.headers.Authorization = `Bearer ${data.data.accessToken}`
        return api(original)
      } catch {
        await AsyncStorage.multiRemove(['accessToken', 'refreshToken'])
      }
    }
    return Promise.reject(error)
  }
)

export function getApiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message || 'Erro inesperado. Tente novamente.'
  }
  return 'Erro inesperado. Tente novamente.'
}
