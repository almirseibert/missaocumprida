import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk'
import webpush from 'web-push'
import { prisma } from '../../config/database'
import { env } from '../../config/env'
import { getIO } from '../realtime/realtime'

/**
 * Avisa os apps abertos que chegou notificação (sala `user:<id>` do socket),
 * para buscarem na hora em vez de consultar a cada poucos segundos.
 * Sem Socket.io (ou com várias instâncias sem adaptador), o polling de 60 s cobre.
 */
export function emitNotificationSignal(userIds: string[], type?: string): void {
  const io = getIO()
  if (!io || userIds.length === 0) return
  try {
    for (let i = 0; i < userIds.length; i += 500) {
      io.to(userIds.slice(i, i + 500).map((id) => `user:${id}`)).emit('notification:new', { type: type ?? null })
    }
  } catch (err) {
    console.error('[realtime] notification signal error:', err)
  }
}

const expo = new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN })

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:contato@missaocumprida.app'

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)
}

export type PushChannel =
  | 'urgent_orders'
  | 'new_proposal'
  | 'proposal_update'
  | 'chat_message'
  | 'schedule_update'
  | 'payment'
  | 'referral'
  | 'cross_sell'
  | 'general'

export interface SendPushOptions {
  title: string
  body: string
  data?: Record<string, any>
  channel?: PushChannel
  sound?: 'default' | null
}

function isChannelEnabled(prefs: any, channel: PushChannel): boolean {
  if (!prefs || typeof prefs !== 'object') return true
  if (prefs[channel] === false) return false
  return true
}

/**
 * Envia push para um usuário em todos os seus dispositivos registrados.
 * Respeita preferências por canal e remove tokens inválidos automaticamente.
 * Nunca lança: push é efeito colateral — uma falha aqui não pode transformar
 * em erro 500 uma operação que já foi gravada (o cliente re-tentaria e
 * receberia 409).
 */
export async function sendToUser(userId: string, opts: SendPushOptions): Promise<void> {
  try {
    await sendToUserUnsafe(userId, opts)
  } catch (err) {
    console.error('[push] sendToUser error:', err)
  }
}

async function sendToUserUnsafe(userId: string, opts: SendPushOptions): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { notification_preferences: true },
  })
  if (!user) return

  const channel = opts.channel || 'general'
  if (!isChannelEnabled(user.notification_preferences, channel)) return

  const tokens = await prisma.pushToken.findMany({ where: { user_id: userId } })
  if (tokens.length === 0) return

  const expoTokens = tokens.filter((t) => t.platform === 'EXPO')
  const webTokens = tokens.filter((t) => t.platform === 'WEB')

  await Promise.allSettled([
    sendExpoBatch(expoTokens, opts),
    sendWebBatch(webTokens, opts),
  ])
}

/**
 * Envio para muitos usuários em lote: preferências e tokens em uma consulta
 * por bloco de 500, e push agrupado (a Expo recebe até 100 por chamada).
 * Antes eram 2 consultas + 1 chamada HTTP por usuário. Nunca lança.
 */
export async function sendToUsers(userIds: string[], opts: SendPushOptions): Promise<void> {
  const unique = Array.from(new Set(userIds))
  const channel = opts.channel || 'general'
  for (let i = 0; i < unique.length; i += 500) {
    try {
      const slice = unique.slice(i, i + 500)
      const users = await prisma.user.findMany({
        where: { id: { in: slice } },
        select: { id: true, notification_preferences: true },
      })
      const allowed = users.filter((u) => isChannelEnabled(u.notification_preferences, channel)).map((u) => u.id)
      if (allowed.length === 0) continue
      const tokens = await prisma.pushToken.findMany({ where: { user_id: { in: allowed } } })
      await Promise.allSettled([
        sendExpoBatch(tokens.filter((t) => t.platform === 'EXPO'), opts),
        sendWebBatch(tokens.filter((t) => t.platform === 'WEB'), opts),
      ])
    } catch (err) {
      console.error('[push] sendToUsers error:', err)
    }
  }
}

async function sendExpoBatch(
  tokens: Array<{ id: string; token: string }>,
  opts: SendPushOptions
): Promise<void> {
  const messages: ExpoPushMessage[] = []
  const invalidIds: string[] = []
  for (const t of tokens) {
    if (!Expo.isExpoPushToken(t.token)) {
      invalidIds.push(t.id)
      continue
    }
    messages.push({
      to: t.token,
      sound: opts.sound === null ? undefined : 'default',
      title: opts.title,
      body: opts.body,
      data: opts.data || {},
      channelId: opts.channel || 'default',
      priority: opts.channel === 'urgent_orders' ? 'high' : 'default',
    })
  }
  if (invalidIds.length > 0) {
    await prisma.pushToken.deleteMany({ where: { id: { in: invalidIds } } })
  }
  if (messages.length === 0) return

  const chunks = expo.chunkPushNotifications(messages)
  const tickets: ExpoPushTicket[] = []
  for (const chunk of chunks) {
    try {
      const r = await expo.sendPushNotificationsAsync(chunk)
      tickets.push(...r)
    } catch (err) {
      console.error('[push] expo send error:', err)
    }
  }
  // Cleanup tokens marked DeviceNotRegistered
  const badTokens: string[] = []
  tickets.forEach((tk, idx) => {
    if (tk.status === 'error' && tk.details?.error === 'DeviceNotRegistered') {
      const original = messages[idx]?.to
      if (typeof original === 'string') badTokens.push(original)
    }
  })
  if (badTokens.length > 0) {
    await prisma.pushToken.deleteMany({ where: { token: { in: badTokens } } })
  }
}

async function sendWebBatch(
  tokens: Array<{ id: string; token: string }>,
  opts: SendPushOptions
): Promise<void> {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return
  const payload = JSON.stringify({
    title: opts.title,
    body: opts.body,
    data: opts.data || {},
  })
  const expired: string[] = []
  await Promise.allSettled(
    tokens.map(async (t) => {
      try {
        const sub = JSON.parse(t.token)
        await webpush.sendNotification(sub, payload)
      } catch (err: any) {
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          expired.push(t.id)
        } else {
          console.error('[push] web send error:', err?.statusCode, err?.body)
        }
      }
    })
  )
  if (expired.length > 0) {
    await prisma.pushToken.deleteMany({ where: { id: { in: expired } } })
  }
}

/**
 * Cria notificação in-app + dispara push. Use este helper em vez de prisma.notification.create
 * + sendToUser separadamente para garantir consistência.
 */
export async function notify(
  userId: string,
  args: {
    type: any
    title: string
    body: string
    data?: any
    channel?: PushChannel
  }
): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        user_id: userId,
        type: args.type,
        title: args.title,
        body: args.body,
        data: args.data,
      },
    })
  } catch (err) {
    console.error('[notify] db error:', err)
  }
  emitNotificationSignal([userId], String(args.type))
  await sendToUser(userId, {
    title: args.title,
    body: args.body,
    data: args.data,
    channel: args.channel,
  })
}
