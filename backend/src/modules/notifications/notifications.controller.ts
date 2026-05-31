import { Request, Response } from 'express'
import { prisma } from '../../config/database'
import * as R from '../../utils/response'

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
