import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import AsyncStorage from '@react-native-async-storage/async-storage'

const SOCKET_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3333'
const USE_SOCKET = process.env.EXPO_PUBLIC_USE_SOCKET !== 'false'

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
}

export function useChatSocket({ scheduleId, onNewMessage, onTyping }: Options) {
  const socketRef = useRef<Socket | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!USE_SOCKET || !scheduleId) return
    let cancelled = false

    AsyncStorage.getItem('accessToken').then((token) => {
      if (cancelled || !token) return
      const socket = io(SOCKET_URL, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
      })
      socketRef.current = socket

      socket.on('connect', () => {
        setConnected(true)
        socket.emit('chat:join', { scheduleId })
      })
      socket.on('disconnect', () => setConnected(false))
      socket.on('chat:message:new', (m: ChatMessage) => {
        if (m.schedule_id === scheduleId) onNewMessage?.(m)
      })
      socket.on('chat:typing', (data: { scheduleId: string; userId: string; typing: boolean }) => {
        if (data.scheduleId === scheduleId) onTyping?.(data)
      })
    })

    return () => {
      cancelled = true
      const socket = socketRef.current
      if (socket) {
        socket.emit('chat:leave', { scheduleId })
        socket.disconnect()
        socketRef.current = null
      }
      setConnected(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleId])

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

  const setTyping = useCallback(
    (typing: boolean) => {
      socketRef.current?.emit(
        typing ? 'chat:typing:start' : 'chat:typing:stop',
        { scheduleId }
      )
    },
    [scheduleId]
  )

  return { connected, sendMessage, setTyping, enabled: USE_SOCKET }
}
