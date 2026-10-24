import { Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../../config/database'
import * as R from '../../utils/response'
import { enqueueJob } from '../jobs/jobs.service'
import { audienceSize } from '../jobs/jobs.handlers'
import { audit } from '../audit/audit.service'

// GET /api/notifications — lista notificações do usuário
export async function listNotifications(req: Request, res: Response) {
  const notifications = await prisma.notification.findMany({
    where: { user_id: req.userId },
    orderBy: { created_at: 'desc' },
    take: 50,
  })
  const unread = notifications.filter((n) => !n.read).length
  return R.ok(res, { notifications, unread })
}

// PATCH /api/notifications/:id/read — marca como lida
export async function markRead(req: Request, res: Response) {
  const n = await prisma.notification.findUnique({ where: { id: req.params.id } })
  if (!n) return R.notFound(res, 'Notificação não encontrada')
  if (n.user_id !== req.userId) return R.forbidden(res)
  await prisma.notification.update({ where: { id: n.id }, data: { read: true } })
  return R.ok(res, null)
}

// PATCH /api/notifications/read-all — marca todas como lidas
export async function markAllRead(req: Request, res: Response) {
  await prisma.notification.updateMany({
    where: { user_id: req.userId, read: false },
    data: { read: true },
  })
  return R.ok(res, null)
}

// ============================================================
// ADMIN — comunicado/broadcast para um público-alvo
// ============================================================
const broadcastSchema = z.object({
  title: z.string().min(2).max(120),
  body: z.string().min(2).max(1000),
  audience: z.enum(['ALL', 'CLIENT', 'PROVIDER']),
})

// POST /api/notifications/admin/broadcast
export async function adminBroadcast(req: Request, res: Response) {
  const parsed = broadcastSchema.safeParse(req.body)
  if (!parsed.success) return R.badRequest(res, 'Dados inválidos', parsed.error.flatten().fieldErrors)
  const { title, body, audience } = parsed.data

  const recipients = await audienceSize(audience)
  if (recipients === 0) return R.ok(res, { recipients: 0 }, 'Nenhum destinatário para este público.')

  // Notificação + push para toda a base vão pela fila, em lotes
  await enqueueJob('BROADCAST', { title, body, audience })
  audit({ type: 'BROADCAST_SENT', metadata: { title, body, audience, recipients } })

  return R.ok(res, { recipients }, `Comunicado na fila de envio para ${recipients} usuário(s). Chega em alguns minutos.`)
}
