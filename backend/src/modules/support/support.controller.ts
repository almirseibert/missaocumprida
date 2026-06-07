import { Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../../config/database'
import * as R from '../../utils/response'

const CATEGORIES = ['PROBLEM', 'IMPROVEMENT', 'QUESTION', 'PAYMENT', 'ACCOUNT', 'OTHER'] as const
const STATUSES = ['OPEN', 'IN_PROGRESS', 'WAITING_USER', 'RESOLVED', 'CLOSED'] as const

const createSchema = z.object({
  subject: z.string().min(3).max(140),
  category: z.enum(CATEGORIES).optional().default('OTHER'),
  message: z.string().min(10).max(4000),
  contact_email: z.string().email().optional(),
  contact_phone: z.string().min(8).max(20).optional(),
})

const replySchema = z.object({
  content: z.string().min(1).max(4000),
})

const statusSchema = z.object({
  status: z.enum(STATUSES),
})

const assignSchema = z.object({
  assignee_id: z.string().uuid().nullable(),
})

// ---- USER ENDPOINTS ----

export async function createTicket(req: Request, res: Response) {
  const parsed = createSchema.safeParse(req.body)
  if (!parsed.success) return R.badRequest(res, 'Dados inválidos', parsed.error.flatten().fieldErrors)

  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { email: true, phone: true, role: true },
  })
  if (!user) return R.notFound(res, 'Usuário não encontrado')

  const ticket = await prisma.supportTicket.create({
    data: {
      user_id: req.userId,
      subject: parsed.data.subject,
      category: parsed.data.category,
      contact_email: parsed.data.contact_email ?? user.email,
      contact_phone: parsed.data.contact_phone ?? user.phone ?? null,
      reporter_role: user.role,
      messages: {
        create: {
          sender_id: req.userId,
          from_admin: false,
          content: parsed.data.message,
        },
      },
    },
    include: {
      messages: { orderBy: { created_at: 'asc' } },
    },
  })

  return R.created(res, ticket, 'Mensagem enviada à equipe Missão Cumprida.')
}

export async function listMyTickets(req: Request, res: Response) {
  const tickets = await prisma.supportTicket.findMany({
    where: { user_id: req.userId },
    orderBy: { updated_at: 'desc' },
    select: {
      id: true, subject: true, category: true, status: true,
      unread_for_user: true, created_at: true, updated_at: true,
      _count: { select: { messages: true } },
    },
  })
  return R.ok(res, tickets)
}

export async function getMyTicket(req: Request, res: Response) {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: req.params.id },
    include: {
      messages: {
        orderBy: { created_at: 'asc' },
        include: { sender: { select: { id: true, name: true, avatar: true, role: true } } },
      },
      assignee: { select: { id: true, name: true, avatar: true } },
    },
  })
  if (!ticket) return R.notFound(res, 'Ticket não encontrado')

  const isOwner = ticket.user_id === req.userId
  const isAdmin = req.userRole === 'ADMIN'
  if (!isOwner && !isAdmin) return R.forbidden(res)

  // Marca como lido pelo lado que está abrindo (reflete no objeto devolvido)
  const updates: Record<string, unknown> = {}
  if (isOwner && ticket.unread_for_user) {
    updates.unread_for_user = false
    ticket.unread_for_user = false
  }
  if (isAdmin && ticket.unread_for_admin) {
    updates.unread_for_admin = false
    ticket.unread_for_admin = false
  }
  if (Object.keys(updates).length > 0) {
    await prisma.supportTicket.update({ where: { id: ticket.id }, data: updates })
  }

  return R.ok(res, ticket)
}

export async function replyToTicket(req: Request, res: Response) {
  const parsed = replySchema.safeParse(req.body)
  if (!parsed.success) return R.badRequest(res, 'Dados inválidos', parsed.error.flatten().fieldErrors)

  const ticket = await prisma.supportTicket.findUnique({ where: { id: req.params.id } })
  if (!ticket) return R.notFound(res, 'Ticket não encontrado')

  const isOwner = ticket.user_id === req.userId
  const isAdmin = req.userRole === 'ADMIN'
  if (!isOwner && !isAdmin) return R.forbidden(res)
  if (ticket.status === 'CLOSED') return R.badRequest(res, 'Este ticket já foi fechado.')

  const message = await prisma.supportTicketMessage.create({
    data: {
      ticket_id: ticket.id,
      sender_id: req.userId,
      from_admin: isAdmin,
      content: parsed.data.content,
    },
    include: { sender: { select: { id: true, name: true, avatar: true, role: true } } },
  })

  // Atualiza flags de leitura e status sugerido
  const newStatus = isAdmin
    ? (ticket.status === 'OPEN' ? 'IN_PROGRESS' : ticket.status)
    : (ticket.status === 'RESOLVED' || ticket.status === 'WAITING_USER' ? 'IN_PROGRESS' : ticket.status)

  await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: {
      status: newStatus,
      unread_for_admin: isAdmin ? ticket.unread_for_admin : true,
      unread_for_user: isAdmin ? true : ticket.unread_for_user,
    },
  })

  return R.created(res, message, 'Mensagem enviada.')
}

// ---- ADMIN ENDPOINTS ----

export async function adminListTickets(req: Request, res: Response) {
  const status = (req.query.status as string) || undefined
  const q = (req.query.q as string)?.trim()
  const limit = Math.min(Number(req.query.limit ?? 30), 100)
  const page = Math.max(Number(req.query.page ?? 1), 1)

  const where: Record<string, unknown> = {}
  if (status && STATUSES.includes(status as typeof STATUSES[number])) where.status = status
  if (q) {
    where.OR = [
      { subject: { contains: q, mode: 'insensitive' } },
      { user: { name: { contains: q, mode: 'insensitive' } } },
      { user: { email: { contains: q, mode: 'insensitive' } } },
    ]
  }

  const [tickets, total, counts] = await Promise.all([
    prisma.supportTicket.findMany({
      where,
      orderBy: [{ unread_for_admin: 'desc' }, { updated_at: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: { select: { id: true, name: true, email: true, avatar: true, role: true } },
        assignee: { select: { id: true, name: true, avatar: true } },
        _count: { select: { messages: true } },
      },
    }),
    prisma.supportTicket.count({ where }),
    prisma.supportTicket.groupBy({
      by: ['status'],
      _count: { status: true },
    }),
  ])

  const summary: Record<string, number> = {
    OPEN: 0, IN_PROGRESS: 0, WAITING_USER: 0, RESOLVED: 0, CLOSED: 0,
  }
  for (const c of counts) summary[c.status] = c._count.status

  return R.ok(res, { tickets, total, page, limit, summary })
}

export async function adminUpdateStatus(req: Request, res: Response) {
  const parsed = statusSchema.safeParse(req.body)
  if (!parsed.success) return R.badRequest(res, 'Status inválido', parsed.error.flatten().fieldErrors)

  const ticket = await prisma.supportTicket.findUnique({ where: { id: req.params.id } })
  if (!ticket) return R.notFound(res, 'Ticket não encontrado')

  const data: Record<string, unknown> = { status: parsed.data.status }
  if (parsed.data.status === 'RESOLVED' || parsed.data.status === 'CLOSED') {
    data.resolved_at = new Date()
    data.unread_for_user = true
  }

  const updated = await prisma.supportTicket.update({ where: { id: ticket.id }, data })
  return R.ok(res, updated, 'Status atualizado')
}

export async function adminAssign(req: Request, res: Response) {
  const parsed = assignSchema.safeParse(req.body)
  if (!parsed.success) return R.badRequest(res, 'Dados inválidos', parsed.error.flatten().fieldErrors)

  const ticket = await prisma.supportTicket.findUnique({ where: { id: req.params.id } })
  if (!ticket) return R.notFound(res, 'Ticket não encontrado')

  if (parsed.data.assignee_id) {
    const admin = await prisma.user.findUnique({
      where: { id: parsed.data.assignee_id },
      select: { role: true },
    })
    if (!admin || admin.role !== 'ADMIN') return R.badRequest(res, 'Apenas administradores podem ser responsáveis.')
  }

  const updated = await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: { assignee_id: parsed.data.assignee_id },
  })
  return R.ok(res, updated, 'Responsável atualizado')
}
