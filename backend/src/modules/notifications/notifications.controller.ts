import { Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../../config/database'
import * as R from '../../utils/response'
import { sendToUsers } from '../push/push.service'

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

  const where: Record<string, unknown> = { is_active: true }
  if (audience === 'CLIENT') where.role = { in: ['CLIENT', 'BOTH'] }
  else if (audience === 'PROVIDER') where.role = { in: ['PROVIDER', 'BOTH'] }

  const users = await prisma.user.findMany({ where, select: { id: true } })
  const ids = users.map((u) => u.id)
  if (ids.length === 0) return R.ok(res, { recipients: 0 }, 'Nenhum destinatário para este público.')

  // Registra a notificação in-app para todos e dispara push (best-effort)
  await prisma.notification.createMany({
    data: ids.map((id) => ({ user_id: id, type: 'GENERAL' as const, title, body })),
  })
  await sendToUsers(ids, { title, body, channel: 'general', data: { broadcast: true } }).catch(() => {})

  return R.ok(res, { recipients: ids.length }, `Comunicado enviado para ${ids.length} usuário(s).`)
}
