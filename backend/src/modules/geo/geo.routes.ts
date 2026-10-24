import { Router, Request, Response } from 'express'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import { authenticate } from '../../middlewares/auth'
import * as R from '../../utils/response'
import { lookupCep, geocodeAddress, reverseGeocode } from './geo.service'

const router = Router()
router.use(authenticate)

// Consultas externas (ViaCEP/Nominatim) têm cota: limite por usuário
const geoLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `geo:${(req as Request).userId}`,
  message: { success: false, message: 'Muitas consultas de endereço. Aguarde um instante.' },
})
router.use(geoLimiter)

// GET /api/geo/cep/:cep — endereço a partir do CEP
router.get('/cep/:cep', async (req: Request, res: Response) => {
  const result = await lookupCep(req.params.cep)
  if (!result) return R.notFound(res, 'CEP não encontrado')
  return R.ok(res, result)
})

const geocodeSchema = z.object({
  street: z.string().max(200).optional().nullable(),
  number: z.string().max(20).optional().nullable(),
  neighborhood: z.string().max(120).optional().nullable(),
  city: z.string().max(120).optional().nullable(),
  state: z.string().max(40).optional().nullable(),
  cep: z.string().max(12).optional().nullable(),
})

// POST /api/geo/geocode — endereço digitado → coordenadas
router.post('/geocode', async (req: Request, res: Response) => {
  const parsed = geocodeSchema.safeParse(req.body)
  if (!parsed.success) return R.badRequest(res, 'Endereço inválido')
  const result = await geocodeAddress(parsed.data)
  if (!result) return R.notFound(res, 'Não encontramos esse endereço no mapa')
  return R.ok(res, result)
})

const reverseSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
})

// POST /api/geo/reverse — coordenadas → endereço (preenche o formulário)
router.post('/reverse', async (req: Request, res: Response) => {
  const parsed = reverseSchema.safeParse(req.body)
  if (!parsed.success) return R.badRequest(res, 'Coordenadas inválidas')
  const result = await reverseGeocode(parsed.data.latitude, parsed.data.longitude)
  if (!result) return R.notFound(res, 'Não foi possível identificar o endereço')
  return R.ok(res, result)
})

export default router
