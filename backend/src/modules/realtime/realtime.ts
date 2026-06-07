// ============================================================
// Socket.io — Chat em tempo real (feature #10)
// ============================================================
import { Server as IOServer, Socket } from 'socket.io'
import type { Server as HttpServer } from 'http'
import { verifyAccessToken } from '../../utils/jwt'
import { prisma } from '../../config/database'
import { sendToUser } from '../push/push.service'

let io: IOServer | null = null

interface AuthedSocket extends Socket {
  userId?: string
  userRole?: string
}

export function getIO(): IOServer | null {
  return io
}

export function initRealtime(httpServer: HttpServer): IOServer {
  io = new IOServer(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    transports: ['websocket', 'polling'],
  })

  // ---- Auth via JWT no handshake ----
  io.use((socket: AuthedSocket, next) => {
    try {
      const token =
        (socket.handshake.auth?.token as string | undefined) ||
        (socket.handshake.query?.token as string | undefined) ||
        (socket.handshake.headers?.authorization || '').toString().replace(/^Bearer\s+/i, '')
      if (!token) return next(new Error('UNAUTHENTICATED'))
      const payload = verifyAccessToken(token)
      socket.userId = payload.userId
      socket.userRole = payload.role
      return next()
    } catch (err) {
      return next(new Error('INVALID_TOKEN'))
    }
  })

  io.on('connection', (socket: AuthedSocket) => {
    if (!socket.userId) { socket.disconnect(); return }
    const userRoom = `user:${socket.userId}`
    socket.join(userRoom)

    // ---- Entrar em uma sala de chat (schedule) ----
    socket.on('chat:join', async ({ scheduleId }: { scheduleId: string }) => {
      try {
        const schedule = await prisma.schedule.findUnique({
          where: { id: scheduleId },
          select: { client_id: true, provider_id: true },
        })
        if (!schedule) return socket.emit('chat:error', { message: 'Agendamento não encontrado' })
        if (schedule.client_id !== socket.userId && schedule.provider_id !== socket.userId) {
          return socket.emit('chat:error', { message: 'Sem acesso a este chat' })
        }
        socket.join(`schedule:${scheduleId}`)
        socket.emit('chat:joined', { scheduleId })
      } catch (err) {
        socket.emit('chat:error', { message: 'Erro ao entrar no chat' })
      }
    })

    socket.on('chat:leave', ({ scheduleId }: { scheduleId: string }) => {
      socket.leave(`schedule:${scheduleId}`)
    })

    // ---- Enviar mensagem ----
    socket.on('chat:message:send', async (
      data: { scheduleId: string; content: string },
      ack?: (resp: { ok: boolean; message?: any; error?: string }) => void,
    ) => {
      try {
        const { scheduleId, content } = data || {} as any
        if (!scheduleId || !content || typeof content !== 'string') {
          return ack?.({ ok: false, error: 'Dados inválidos' })
        }
        if (content.length > 2000) return ack?.({ ok: false, error: 'Mensagem muito longa' })

        const schedule = await prisma.schedule.findUnique({
          where: { id: scheduleId },
          select: { client_id: true, provider_id: true },
        })
        if (!schedule) return ack?.({ ok: false, error: 'Agendamento não encontrado' })
        if (schedule.client_id !== socket.userId && schedule.provider_id !== socket.userId) {
          return ack?.({ ok: false, error: 'Sem acesso' })
        }

        const message = await prisma.message.create({
          data: {
            schedule_id: scheduleId,
            sender_id: socket.userId!,
            content,
          },
          include: { sender: { select: { id: true, name: true, avatar: true } } },
        })

        // Broadcast pra todos na sala (incluindo remetente — confirma recebido)
        io!.to(`schedule:${scheduleId}`).emit('chat:message:new', message)

        // Push pra contraparte (se ela NÃO está conectada / fora da sala)
        const recipientId =
          schedule.provider_id === socket.userId ? schedule.client_id : schedule.provider_id
        const recipientSockets = await io!.in(`user:${recipientId}`).fetchSockets()
        const inRoom = recipientSockets.some((s) =>
          s.rooms.has(`schedule:${scheduleId}`)
        )
        if (!inRoom) {
          sendToUser(recipientId, {
            title: message.sender.name,
            body: content.length > 80 ? content.slice(0, 77) + '…' : content,
            data: { schedule_id: scheduleId, message_id: message.id, type: 'CHAT_MESSAGE' },
            channel: 'chat_message',
          }).catch(() => {})
        }

        ack?.({ ok: true, message })
      } catch (err) {
        console.error('[realtime] message:send error', err)
        ack?.({ ok: false, error: 'Erro ao enviar' })
      }
    })

    // ---- Marcar como lida ----
    socket.on('chat:message:read', async ({ scheduleId }: { scheduleId: string }) => {
      try {
        await prisma.message.updateMany({
          where: { schedule_id: scheduleId, sender_id: { not: socket.userId }, is_read: false },
          data: { is_read: true },
        })
        socket.to(`schedule:${scheduleId}`).emit('chat:message:read', {
          scheduleId, by: socket.userId,
        })
      } catch {}
    })

    // ---- Digitando ----
    socket.on('chat:typing:start', ({ scheduleId }: { scheduleId: string }) => {
      socket.to(`schedule:${scheduleId}`).emit('chat:typing', { scheduleId, userId: socket.userId, typing: true })
    })
    socket.on('chat:typing:stop', ({ scheduleId }: { scheduleId: string }) => {
      socket.to(`schedule:${scheduleId}`).emit('chat:typing', { scheduleId, userId: socket.userId, typing: false })
    })

    // ---- Presença pessoal ----
    io!.to(userRoom).emit('presence', { userId: socket.userId, online: true })
    socket.on('disconnect', () => {
      io!.to(userRoom).emit('presence', { userId: socket.userId, online: false })
    })
  })

  console.log('🔌 Socket.io inicializado')
  return io
}
