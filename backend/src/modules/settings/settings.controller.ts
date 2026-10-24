import { Request, Response } from 'express'
import { z } from 'zod'
import * as R from '../../utils/response'
import { env } from '../../config/env'
import { getSettings, updateSettings } from './settings.service'

// ---------------------------------------------------------------------------
// GET /api/config/public — configuração pública lida pelos apps no boot.
// Os valores exibidos vêm daqui; o CÁLCULO da taxa é sempre do servidor.
// ---------------------------------------------------------------------------
export async function getPublicConfig(_req: Request, res: Response) {
  const s = await getSettings()
  return R.ok(res, {
    fees_enabled: env.FEES_ENABLED,
    connection_fee: {
      client_pct: s.fee_client_pct,
      provider_pct: s.fee_provider_pct,
      regular_pct: s.fee_regular_pct,
      promo_active: s.fee_promo_active,
      min: s.fee_min,
      gateway_surcharge: {
        card: s.gateway_surcharge_card,
        pix: s.gateway_surcharge_pix,
      },
    },
    provider_fee_timeout_hours: s.provider_fee_timeout_hours,
    max_order_photos: s.max_order_photos,
    max_service_photos: s.max_service_photos,
    recurring_enabled: env.RECURRING_ENABLED,
  })
}

// ---------------------------------------------------------------------------
// GET /api/config — todas as configurações (ADMIN)
// PUT /api/config — atualiza configurações (ADMIN)
// ---------------------------------------------------------------------------
export async function adminGetSettings(_req: Request, res: Response) {
  return R.ok(res, await getSettings())
}

const pct = z.number().min(0).max(0.5)
const updateSchema = z
  .object({
    fee_client_pct: pct,
    fee_provider_pct: pct,
    fee_regular_pct: pct,
    fee_promo_active: z.boolean(),
    fee_min: z.number().min(0).max(100),
    provider_fee_timeout_hours: z.number().min(1).max(168),
    proposal_min_ratio: z.number().min(0).max(1),
    gateway_surcharge_card: z.number().min(0).max(0.2),
    gateway_surcharge_pix: z.number().min(0).max(0.2),
    max_order_photos: z.number().int().min(1).max(20),
    max_service_photos: z.number().int().min(1).max(20),
  })
  .partial()

export async function adminUpdateSettings(req: Request, res: Response) {
  const parsed = updateSchema.safeParse(req.body)
  if (!parsed.success) {
    return R.badRequest(res, 'Configuração inválida', parsed.error.flatten().fieldErrors)
  }
  if (Object.keys(parsed.data).length === 0) {
    return R.badRequest(res, 'Nenhuma configuração para atualizar')
  }
  const updated = await updateSettings(parsed.data, req.userId)
  return R.ok(res, updated, 'Configurações atualizadas')
}
