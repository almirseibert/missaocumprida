'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuthStore } from '@/store/auth'

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333'
const USE_SOCKET = process.env.NEXT_PUBLIC_USE_SOCKET !== 'false'

export interface ChatMessage {
  id: string
  schedule_id: string
  sender_id: string
  content: string | null
  photo_url: string | null
  is_read: boolean
  created_at: string
  sender: { id: string; name: string; avatar: string | null }
}

interface Options {
  scheduleId: string
  onNewMessage?: (message: ChatMessage) => void
  onTyping?: (data: { userId: string; typing: boolean }) => void
  onRead?: (data: { by: string }) => void
}

export function useChatSocket({ scheduleId, onNewMessage, onTyping, onRead }: Options) {
  const { accessToken } = useAuthStore()
  const socketRef = useRef<Socket | null>(null)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!USE_SOCKET || !accessToken || !scheduleId) return

    const socket = io(SOCKET_URL, {
      auth: { token: accessToken },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
    })
    socketRef.current = socket

    socket.on('connect', () => {
      setConnected(true)
      setError(null)
      socket.emit('chat:join', { scheduleId })
    })
    socket.on('disconnect', () => setConnected(false))
    socket.on('connect_error', (err) => setError(err.message))
    socket.on('chat:error', (data) => setError(data?.message ?? 'Erro no chat'))

    socket.on('chat:message:new', (message: ChatMessage) => {
      if (message.schedule_id === scheduleId) onNewMessage?.(message)
    })
    socket.on('chat:typing', (data: { scheduleId: string; userId: string; typing: boolean }) => {
      if (data.scheduleId === scheduleId) onTyping?.(data)
    })
    socket.on('chat:message:read', (data: { scheduleId: string; by: string }) => {
      if (data.scheduleId === scheduleId) onRead?.(data)
    })

    return () => {
      socket.emit('chat:leave', { scheduleId })
      socket.disconnect()
      socketRef.current = null
      setConnected(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, scheduleId])

  const sendMessage = useCallback(
    (content: string) =>
      new Promise<ChatMessage>((resolve, reject) => {
        const socket = socketRef.current
        if (!socket || !socket.connected) return reject(new Error('Sem conexão'))
        socket.emit(
          'chat:message:send',
          { scheduleId, content },
          (resp: { ok: boolean; message?: ChatMessage; error?: string }) => {
            if (resp?.ok && resp.message) resolve(resp.message)
            else reject(new Error(resp?.error || 'Falha ao enviar'))
          }
        )
      }),
    [scheduleId]
  )

  const markRead = useCallback(() => {
    socketRef.current?.emit('chat:message:read', { scheduleId })
  }, [scheduleId])

  const setTyping = useCallback(
    (typing: boolean) => {
      socketRef.current?.emit(
        typing ? 'chat:typing:start' : 'chat:typing:stop',
        { scheduleId }
      )
    },
    [scheduleId]
  )

  return { connected, error, sendMessage, markRead, setTyping, enabled: USE_SOCKET }
}
