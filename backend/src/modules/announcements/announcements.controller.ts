import { Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../../config/database'
import * as R from '../../utils/response'
import { audit } from '../audit/audit.service'
import { enqueueJob } from '../jobs/jobs.service'
import { audienceSize } from '../jobs/jobs.handlers'

/**
 * Avisos do admin (Remap 2.0): pop-ups e banners exibidos nos apps
 * (promoções, avisos de manutenção, mudanças de taxa etc.), com envio
 * opcional de push para a audiência.
 */

// Papéis alcançados por cada audiência
const AUDIENCE_ROLES: Record<string, string[]> = {
  ALL: ['CLIENT', 'PROVIDER', 'BOTH', 'ADMIN'],
  CLIENTS: ['CLIENT', 'BOTH'],
  PROVIDERS: ['PROVIDER', 'BOTH'],
}

function audiencesForRole(role: string): string[] {
  const audiences = ['ALL']
  if (role === 'CLIENT' || role === 'BOTH' || role === 'ADMIN') audiences.push('CLIENTS')
  if (role === 'PROVIDER' || role === 'BOTH' || role === 'ADMIN') audiences.push('PROVIDERS')
  return audiences
}

// ---------------------------------------------------------------------------
// GET /api/announcements/active — avisos vigentes para o usuário logado
// ---------------------------------------------------------------------------
export async function listActiveAnnouncements(req: Request, res: Response) {
  const now = new Date()
  const announcements = await prisma.announcement.findMany({
    where: {
      is_active: true,
      starts_at: { lte: now },
      OR: [{ ends_at: null }, { ends_at: { gt: now } }],
      audience: { in: audiencesForRole(req.userRole) as never[] },
    },
    orderBy: { starts_at: 'desc' },
    take: 10,
    select: { id: true, title: true, body: true, type: true, starts_at: true, ends_at: true },
  })
  return R.ok(res, announcements)
}

// ---------------------------------------------------------------------------
// Admin — CRUD + envio de push
// ---------------------------------------------------------------------------
const createSchema = z.object({
  title: z.string().min(3).max(80),
  body: z.string().min(3).max(500),
  type: z.enum(['POPUP', 'BANNER']).default('POPUP'),
  audience: z.enum(['ALL', 'CLIENTS', 'PROVIDERS']).default('ALL'),
  starts_at: z.string().datetime().optional(),
  ends_at: z.string().datetime().optional(),
  send_push: z.boolean().optional(),
})

export async function adminCreateAnnouncement(req: Request, res: Response) {
  const parsed = createSchema.safeParse(req.body)
  if (!parsed.success) return R.badRequest(res, 'Dados inválidos', parsed.error.flatten().fieldErrors)

  const announcement = await prisma.announcement.create({
    data: {
      title: parsed.data.title,
      body: parsed.data.body,
      type: parsed.data.type,
      audience: parsed.data.audience,
      starts_at: parsed.data.starts_at ? new Date(parsed.data.starts_at) : new Date(),
      ends_at: parsed.data.ends_at ? new Date(parsed.data.ends_at) : null,
      created_by: req.userId,
    },
  })

  let recipients: number | null = null
  if (parsed.data.send_push) {
    recipients = await sendAnnouncementPush(announcement.id)
  }
  audit({
    type: 'ANNOUNCEMENT_CREATED', entityType: 'Announcement', entityId: announcement.id,
    after: { title: announcement.title, body: announcement.body, audience: announcement.audience, type: announcement.type },
    metadata: { push_recipients: recipients },
  })

  return R.created(res, announcement, 'Aviso criado')
}

export async function adminListAnnouncements(_req: Request, res: Response) {
  const announcements = await prisma.announcement.findMany({
    orderBy: { created_at: 'desc' },
    take: 50,
  })
  return R.ok(res, announcements)
}

export async function adminDeleteAnnouncement(req: Request, res: Response) {
  const existing = await prisma.announcement.findUnique({ where: { id: req.params.id } })
  if (!existing) return R.notFound(res, 'Aviso não encontrado')
  await prisma.announcement.update({
    where: { id: req.params.id },
    data: { is_active: false, ends_at: new Date() },
  })
  audit({ type: 'ANNOUNCEMENT_DISABLED', entityType: 'Announcement', entityId: existing.id, before: { title: existing.title } })
  return R.ok(res, null, 'Aviso desativado')
}

/** Push do aviso para a audiência: vai para a fila (envio em lotes). */
async function sendAnnouncementPush(announcementId: string): Promise<number> {
  const announcement = await prisma.announcement.findUnique({ where: { id: announcementId } })
  if (!announcement) return 0
  await enqueueJob('ANNOUNCEMENT_PUSH', { announcement_id: announcement.id })
  return audienceSize(announcement.audience)
}

export async function adminSendAnnouncementPush(req: Request, res: Response) {
  const announcement = await prisma.announcement.findUnique({ where: { id: req.params.id } })
  if (!announcement) return R.notFound(res, 'Aviso não encontrado')
  const sent = await sendAnnouncementPush(announcement.id)
  audit({
    type: 'ANNOUNCEMENT_PUSH_SENT', entityType: 'Announcement', entityId: announcement.id,
    metadata: { title: announcement.title, audience: announcement.audience, recipients: sent },
  })
  return R.ok(res, { recipients: sent }, `Push na fila de envio para ${sent} usuário(s)`)
}
