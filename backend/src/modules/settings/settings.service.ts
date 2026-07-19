import { prisma } from '../../config/database'
import { env } from '../../config/env'

/**
 * Configurações da plataforma editáveis em runtime pelo admin.
 * Os defaults vêm do env (primeira carga); qualquer valor gravado em
 * platform_settings sobrepõe. Cache em memória de 60s — mudanças do admin
 * invalidam o cache do processo na hora (invalidateSettingsCache).
 */

export type PlatformSettings = {
  fee_client_pct: number // taxa de conexão cobrada do cliente (vigente)
  fee_provider_pct: number // taxa de conexão cobrada do prestador (vigente)
  fee_regular_pct: number // taxa cheia — exibida riscada quando em promoção
  fee_promo_active: boolean // exibe o "de X% por Y%" nas telas
  fee_min: number // valor mínimo da taxa por lado (antifraude)
  provider_fee_timeout_hours: number // prazo do prestador para pagar após o cliente
  proposal_min_ratio: number // piso da proposta vs base_price_min da categoria
  gateway_surcharge_card: number // repasse do meio de pagamento (cartão)
  gateway_surcharge_pix: number // repasse do meio de pagamento (Pix)
}

const DEFAULTS: PlatformSettings = {
  fee_client_pct: env.CONNECTION_FEE_CLIENT_PCT,
  fee_provider_pct: env.CONNECTION_FEE_PROVIDER_PCT,
  fee_regular_pct: env.CONNECTION_FEE_REGULAR_PCT,
  fee_promo_active: true,
  fee_min: env.CONNECTION_FEE_MIN,
  provider_fee_timeout_hours: env.PROVIDER_FEE_TIMEOUT_HOURS,
  proposal_min_ratio: env.PROPOSAL_MIN_RATIO,
  gateway_surcharge_card: 0.04,
  gateway_surcharge_pix: 0.01,
}

export const SETTING_KEYS = Object.keys(DEFAULTS) as Array<keyof PlatformSettings>

const CACHE_TTL_MS = 60_000
let cache: { data: PlatformSettings; at: number } | null = null

export function invalidateSettingsCache(): void {
  cache = null
}

export async function getSettings(): Promise<PlatformSettings> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.data

  const data: PlatformSettings = { ...DEFAULTS }
  try {
    const rows = await prisma.platformSetting.findMany()
    for (const row of rows) {
      if ((SETTING_KEYS as string[]).includes(row.key)) {
        ;(data as Record<string, unknown>)[row.key] = row.value
      }
    }
  } catch (err) {
    console.error('[settings] erro ao carregar (usando defaults):', err)
  }

  cache = { data, at: Date.now() }
  return data
}

export async function updateSettings(
  patch: Partial<PlatformSettings>,
  adminId?: string,
): Promise<PlatformSettings> {
  const entries = Object.entries(patch).filter(([key]) =>
    (SETTING_KEYS as string[]).includes(key),
  )
  for (const [key, value] of entries) {
    await prisma.platformSetting.upsert({
      where: { key },
      update: { value: value as never, updated_by: adminId },
      create: { key, value: value as never, updated_by: adminId },
    })
  }
  invalidateSettingsCache()
  return getSettings()
}
