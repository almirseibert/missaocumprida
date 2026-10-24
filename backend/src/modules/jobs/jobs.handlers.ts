// Handlers da fila (registrados no boot pelo server.ts)
import { prisma } from '../../config/database'
import { registerJobHandler, notifyMany } from './jobs.service'
import { sendToUsers } from '../push/push.service'

const URGENCY_DEADLINE_HOURS = 2
const USERS_PAGE = 2000

/** Prestadores da categoria dentro do raio (cálculo no banco, sem carregar todos). */
export async function providersForOrder(order: {
  category_id: string
  client_id: string
  latitude: number | null
  longitude: number | null
  is_urgent: boolean
  urgency_radius_km: number | null
}): Promise<string[]> {
  if (order.latitude == null || order.longitude == null) {
    // Pedido sem coordenadas: todos da categoria (não dá para medir distância)
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT DISTINCT ps.provider_id AS id
      FROM provider_skills ps JOIN users u ON u.id = ps.provider_id
      WHERE ps.category_id = ${order.category_id} AND ps.is_active
        AND u.is_active AND u.banned_at IS NULL AND u.id <> ${order.client_id}`
    return rows.map((r) => r.id)
  }
  const lat = order.latitude
  const lng = order.longitude
  const urgentRadius = order.urgency_radius_km ?? 10
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT DISTINCT ps.provider_id AS id
    FROM provider_skills ps JOIN users u ON u.id = ps.provider_id
    WHERE ps.category_id = ${order.category_id} AND ps.is_active
      AND u.is_active AND u.banned_at IS NULL AND u.id <> ${order.client_id}
      AND u.latitude BETWEEN ${lat - 2.0} AND ${lat + 2.0}
      AND u.longitude IS NOT NULL
      AND 2 * 6371 * asin(sqrt(least(1,
            power(sin(radians(u.latitude - ${lat}) / 2), 2) +
            cos(radians(${lat})) * cos(radians(u.latitude)) * power(sin(radians(u.longitude - ${lng}) / 2), 2))))
          <= CASE WHEN ${order.is_urgent} THEN ${urgentRadius}::float ELSE COALESCE(ps.service_radius_km, 20)::float END`
  return rows.map((r) => r.id)
}

// Pedido novo → avisa os prestadores da área (antes rodava dentro do POST /orders)
registerJobHandler('NEW_ORDER_FANOUT', async (payload) => {
  const order = await prisma.order.findUnique({
    where: { id: String(payload.order_id) },
    select: {
      id: true, category_id: true, client_id: true, latitude: true, longitude: true, is_urgent: true,
      urgency_radius_km: true, city: true, status: true, category: { select: { name: true } },
    },
  })
  if (!order || !['OPEN', 'IN_PROPOSAL'].includes(order.status)) return
  const targets = await providersForOrder(order)
  if (targets.length === 0) return
  const title = order.is_urgent ? `🚨 URGENTE: ${order.category.name} perto de você!` : 'Novo pedido na sua área!'
  const body = order.is_urgent
    ? `Cliente precisa em até ${URGENCY_DEADLINE_HOURS}h. Atendimento prioritário em ${order.city}.`
    : `Um novo pedido de ${order.category.name} foi publicado em ${order.city}.`
  await notifyMany(targets, {
    type: 'NEW_ORDER_NEARBY',
    title,
    body,
    data: { order_id: order.id, urgent: order.is_urgent },
    channel: order.is_urgent ? 'urgent_orders' : 'general',
  })
})

const ROLES: Record<string, string[]> = {
  ALL: ['CLIENT', 'PROVIDER', 'BOTH', 'ADMIN'],
  CLIENT: ['CLIENT', 'BOTH'],
  CLIENTS: ['CLIENT', 'BOTH'],
  PROVIDER: ['PROVIDER', 'BOTH'],
  PROVIDERS: ['PROVIDER', 'BOTH'],
}

/** Percorre a base em páginas pelo id (não carrega 100 mil usuários de uma vez). */
async function forEachUserPage(roles: string[], fn: (ids: string[]) => Promise<void>): Promise<number> {
  let cursor: string | undefined
  let total = 0
  for (;;) {
    const page = await prisma.user.findMany({
      where: { is_active: true, role: { in: roles as never[] }, ...(cursor ? { id: { gt: cursor } } : {}) },
      select: { id: true },
      orderBy: { id: 'asc' },
      take: USERS_PAGE,
    })
    if (page.length === 0) break
    await fn(page.map((u) => u.id))
    total += page.length
    cursor = page[page.length - 1].id
  }
  return total
}

// Comunicado do admin para toda a base (notificação + push)
registerJobHandler('BROADCAST', async (payload) => {
  const roles = ROLES[String(payload.audience ?? 'ALL')] ?? ROLES.ALL
  const title = String(payload.title)
  const body = String(payload.body)
  await forEachUserPage(roles, (ids) => notifyMany(ids, { type: 'GENERAL', title, body, data: { broadcast: true } }))
})

// Push de um aviso (pop-up/banner) — só push, o aviso já aparece no app
registerJobHandler('ANNOUNCEMENT_PUSH', async (payload) => {
  const a = await prisma.announcement.findUnique({ where: { id: String(payload.announcement_id) } })
  if (!a) return
  const roles = ROLES[a.audience] ?? ROLES.ALL
  await forEachUserPage(roles, (ids) =>
    sendToUsers(ids, { title: a.title, body: a.body, data: { type: 'ANNOUNCEMENT', announcement_id: a.id }, channel: 'general' }),
  )
  await prisma.announcement.update({ where: { id: a.id }, data: { push_sent_at: new Date() } })
})

/** Quantos usuários um público alcança (para a resposta do admin). */
export async function audienceSize(audience: string): Promise<number> {
  const roles = ROLES[audience] ?? ROLES.ALL
  return prisma.user.count({ where: { is_active: true, role: { in: roles as never[] } } })
}
