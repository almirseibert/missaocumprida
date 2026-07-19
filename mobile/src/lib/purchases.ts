import { Platform } from 'react-native'
import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesOffering,
  type PurchasesPackage,
} from 'react-native-purchases'

// Chave PÚBLICA do SDK da RevenueCat (Android começa com "goog_").
// Configure em mobile/.env: EXPO_PUBLIC_REVENUECAT_ANDROID_KEY
const ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY || ''

// Identificador do entitlement configurado no painel da RevenueCat.
export const PRO_ENTITLEMENT = process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT || 'pro'

let configured = false

/** Configura o SDK uma única vez. Seguro chamar mais de uma vez. */
export function configurePurchases(): void {
  if (configured) return
  if (!ANDROID_KEY) {
    // Sem chave configurada: não quebra o app, apenas desativa o fluxo de compra.
    console.warn('[purchases] EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ausente — billing desativado')
    return
  }
  if (Platform.OS !== 'android') return // iOS exige chave própria (apl_...)
  Purchases.setLogLevel(LOG_LEVEL.WARN)
  Purchases.configure({ apiKey: ANDROID_KEY })
  configured = true
}

export function isPurchasesReady(): boolean {
  return configured
}

/** Associa as compras ao id do usuário do nosso backend (== app_user_id). */
export async function loginPurchases(userId: string): Promise<void> {
  if (!configured) return
  try { await Purchases.logIn(userId) } catch (e) { console.warn('[purchases] logIn falhou', e) }
}

export async function logoutPurchases(): Promise<void> {
  if (!configured) return
  try { await Purchases.logOut() } catch { /* já anônimo */ }
}

/** Oferta atual (offering "current" configurada na RevenueCat). */
export async function getCurrentOffering(): Promise<PurchasesOffering | null> {
  if (!configured) return null
  const offerings = await Purchases.getOfferings()
  return offerings.current ?? null
}

/** Compra um pacote e retorna o CustomerInfo atualizado. */
export async function purchasePackage(pkg: PurchasesPackage): Promise<CustomerInfo> {
  const { customerInfo } = await Purchases.purchasePackage(pkg)
  return customerInfo
}

export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  if (!configured) return null
  return Purchases.getCustomerInfo()
}

/** True se o entitlement do Selo Pro estiver ativo. */
export function isProActive(info: CustomerInfo | null): boolean {
  if (!info) return false
  return info.entitlements.active[PRO_ENTITLEMENT] != null
}

export async function restorePurchases(): Promise<CustomerInfo> {
  return Purchases.restorePurchases()
}
