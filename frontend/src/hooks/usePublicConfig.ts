'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

/**
 * Configuração pública da plataforma (GET /config/public): percentuais da
 * Taxa de Conexão, limites de fotos etc. Os valores são editados pelo admin
 * em runtime — o site nunca deve fixar esses números no código.
 * O CÁLCULO da taxa é sempre do servidor; aqui é só para exibir.
 */
export interface PublicConfig {
  fees_enabled: boolean
  connection_fee: {
    client_pct: number
    provider_pct: number
    regular_pct: number
    promo_active: boolean
    min: number
    gateway_surcharge: { card: number; pix: number }
  }
  provider_fee_timeout_hours: number
  max_order_photos: number
  max_service_photos: number
  recurring_enabled: boolean
  pro: { monthly_price: number; client_fee_discount_pct: number }
}

export const DEFAULT_PUBLIC_CONFIG: PublicConfig = {
  fees_enabled: true,
  connection_fee: {
    client_pct: 0.05,
    provider_pct: 0.05,
    regular_pct: 0.1,
    promo_active: true,
    min: 4.9,
    gateway_surcharge: { card: 0.04, pix: 0.01 },
  },
  provider_fee_timeout_hours: 24,
  max_order_photos: 10,
  max_service_photos: 10,
  recurring_enabled: false,
  pro: { monthly_price: 29.9, client_fee_discount_pct: 0.5 },
}

let cached: PublicConfig | null = null
let inflight: Promise<PublicConfig> | null = null

export function loadPublicConfig(): Promise<PublicConfig> {
  if (cached) return Promise.resolve(cached)
  if (inflight) return inflight
  const request: Promise<PublicConfig> = api
    .get('/config/public')
    .then((res) => {
      const loaded: PublicConfig = { ...DEFAULT_PUBLIC_CONFIG, ...(res.data?.data ?? {}) }
      cached = loaded
      return loaded
    })
    .catch(() => DEFAULT_PUBLIC_CONFIG)
    .finally(() => {
      inflight = null
    })
  inflight = request
  return request
}

export function usePublicConfig(): PublicConfig {
  const [config, setConfig] = useState<PublicConfig>(cached ?? DEFAULT_PUBLIC_CONFIG)
  useEffect(() => {
    let alive = true
    loadPublicConfig().then((c) => {
      if (alive) setConfig(c)
    })
    return () => {
      alive = false
    }
  }, [])
  return config
}

/** Taxa estimada para exibição: max(valor × %, mínimo). */
export function estimateFee(value: number, pct: number, min: number): number {
  return Math.round(Math.max(value * pct, min) * 100) / 100
}
