import * as SecureStore from 'expo-secure-store'
import AsyncStorage from '@react-native-async-storage/async-storage'

// Tokens de autenticação agora vivem no armazenamento seguro do dispositivo
// (Keystore/Keychain) em vez do AsyncStorage (texto puro). Migração automática
// preserva sessões já logadas antes desta mudança.

const ACCESS = 'accessToken'
const REFRESH = 'refreshToken'

async function getWithMigration(key: string): Promise<string | null> {
  const secure = await SecureStore.getItemAsync(key)
  if (secure != null) return secure
  // Migra do AsyncStorage legado, se existir.
  const legacy = await AsyncStorage.getItem(key)
  if (legacy != null) {
    try { await SecureStore.setItemAsync(key, legacy) } catch {}
    await AsyncStorage.removeItem(key).catch(() => {})
  }
  return legacy
}

export async function getAccessToken(): Promise<string | null> {
  return getWithMigration(ACCESS)
}

export async function getRefreshToken(): Promise<string | null> {
  return getWithMigration(REFRESH)
}

export async function setTokens(access: string, refresh: string): Promise<void> {
  await SecureStore.setItemAsync(ACCESS, access)
  await SecureStore.setItemAsync(REFRESH, refresh)
}

export async function setAccessToken(access: string): Promise<void> {
  await SecureStore.setItemAsync(ACCESS, access)
}

export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCESS).catch(() => {})
  await SecureStore.deleteItemAsync(REFRESH).catch(() => {})
  // Limpa também qualquer resíduo legado.
  await AsyncStorage.multiRemove([ACCESS, REFRESH]).catch(() => {})
}
