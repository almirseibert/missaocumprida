import AsyncStorage from '@react-native-async-storage/async-storage'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { randomUuid } from './ids'

// Identificador aleatório desta instalação (NÃO é o ID de publicidade nem o
// IMEI). Vai no cabeçalho X-Device-Id para o suporte rastrear acessos e ações
// (segurança e prevenção a fraude — ver Política de Privacidade).
const KEY = 'mc.device_id'
let cached: string | null = null

export async function getDeviceId(): Promise<string> {
  if (cached) return cached
  try {
    const stored = await AsyncStorage.getItem(KEY)
    if (stored) return (cached = stored)
    const id = randomUuid()
    await AsyncStorage.setItem(KEY, id)
    return (cached = id)
  } catch {
    return (cached = randomUuid())
  }
}

const build = Constants.expoConfig?.android?.versionCode ?? Constants.expoConfig?.ios?.buildNumber ?? '?'
export const APP_VERSION = `${Platform.OS}-${Constants.expoConfig?.version ?? '0'}(${build})`

export async function clientHeaders(): Promise<Record<string, string>> {
  return { 'X-Device-Id': await getDeviceId(), 'X-App-Version': APP_VERSION }
}
