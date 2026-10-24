import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'
import { getAccessToken, getRefreshToken, setTokens, clearTokens } from './secureStore'
import { clientHeaders } from './device'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3333'

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
})

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await getAccessToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  for (const [k, v] of Object.entries(await clientHeaders())) config.headers[k] = v
  return config
})

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean }
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      try {
        const refreshToken = await getRefreshToken()
        if (!refreshToken) throw new Error('sem refresh token')
        const { data } = await axios.post(`${API_URL}/api/auth/refresh`, { refreshToken }, { headers: await clientHeaders() })
        await setTokens(data.data.accessToken, data.data.refreshToken)
        original.headers.Authorization = `Bearer ${data.data.accessToken}`
        return api(original)
      } catch {
        await clearTokens()
      }
    }
    return Promise.reject(error)
  }
)

export function getApiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string; errors?: unknown } | undefined
    // Mostra as mensagens de validação por campo (zod flatten().fieldErrors),
    // senão o usuário só vê um "Dados inválidos" genérico ou nada útil.
    const fieldMsgs = extractFieldErrors(data?.errors)
    if (fieldMsgs.length) return fieldMsgs.join('\n')
    if (data?.message) return data.message
    if (!error.response) return 'Sem conexão com o servidor. Verifique sua internet.'
    return 'Erro inesperado. Tente novamente.'
  }
  return 'Erro inesperado. Tente novamente.'
}

function extractFieldErrors(errors: unknown): string[] {
  if (!errors || typeof errors !== 'object') return []
  const out: string[] = []
  for (const val of Object.values(errors as Record<string, unknown>)) {
    if (Array.isArray(val)) out.push(...val.filter((m): m is string => typeof m === 'string'))
    else if (typeof val === 'string') out.push(val)
  }
  return out
}
