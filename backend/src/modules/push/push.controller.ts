import { Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../../config/database'
import * as R from '../../utils/response'
import { sendToUser } from './push.service'

const registerSchema = z.object({
  token: z.string().min(1),
  platform: z.enum(['EXPO', 'FCM', 'APNS', 'WEB']).default('EXPO'),
  device_id: z.string().optional(),
})

// POST /api/push/register
export async function registerToken(req: Request, res: Response) {
  const parsed = registerSchema.safeParse(req.body)
  if (!parsed.success) return R.badRequest(res, 'Dados inválidos', parsed.error.errors)
  const { token, platform, device_id } = parsed.data

  const existing = await prisma.pushToken.findUnique({ where: { token } })
  if (existing) {
    if (existing.user_id !== req.userId) {
      await prisma.pushToken.update({
        where: { token },
        data: { user_id: req.userId!, last_seen: new Date() },
      })
    } else {
      await prisma.pushToken.update({
        where: { token },
        data: { last_seen: new Date(), device_id: device_id || existing.device_id },
      })
    }
  } else {
    await prisma.pushToken.create({
      data: { user_id: req.userId!, token, platform, device_id },
    })
  }
  return R.ok(res, null, 'Token registrado')
}

// DELETE /api/push/token/:token
export async function unregisterToken(req: Request, res: Response) {
  const { token } = req.params
  await prisma.pushToken.deleteMany({ where: { token, user_id: req.userId } })
  return R.ok(res, null, 'Token removido')
}

// PUT /api/push/preferences
export async function updatePreferences(req: Request, res: Response) {
  const prefs = req.body
  if (!prefs || typeof prefs !== 'object') return R.badRequest(res, 'Preferências inválidas')
  const user = await prisma.user.update({
    where: { id: req.userId },
    data: { notification_preferences: prefs },
    select: { notification_preferences: true },
  })
  return R.ok(res, user)
}

// POST /api/push/test (dev only) — envia push para o próprio usuário
export async function sendTest(req: Request, res: Response) {
  await sendToUser(req.userId!, {
    title: req.body.title || 'Teste de notificação',
    body: req.body.body || 'Se você está vendo isso, push real funciona ✅',
    channel: 'general',
    data: { test: true },
  })
  return R.ok(res, null, 'Push enviado')
}
