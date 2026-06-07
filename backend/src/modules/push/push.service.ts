import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk'
import webpush from 'web-push'
import { prisma } from '../../config/database'
import { env } from '../../config/env'

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
 */
export async function sendToUser(userId: string, opts: SendPushOptions): Promise<void> {
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

export async function sendToUsers(userIds: string[], opts: SendPushOptions): Promise<void> {
  await Promise.allSettled(userIds.map((id) => sendToUser(id, opts)))
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
  await sendToUser(userId, {
    title: args.title,
    body: args.body,
    data: args.data,
    channel: args.channel,
  })
}
