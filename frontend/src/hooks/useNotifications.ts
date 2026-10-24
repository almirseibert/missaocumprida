'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { io } from 'socket.io-client'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { Notification } from '@/types'
import toast from 'react-hot-toast'

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333'
const USE_SOCKET = process.env.NEXT_PUBLIC_USE_SOCKET !== 'false'

// Notificações chegam pelo socket ("notification:new"); a consulta a cada
// 60 s fica só como reserva (antes eram 20 s para todo usuário logado).
export function useNotifications(pollIntervalMs = 60000) {
  const { accessToken } = useAuthStore()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const prevUnreadRef = useRef(0)

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.get('/notifications')
      const { notifications: list, unread: count } = res.data.data
      setNotifications(list)
      setUnread(count)

      // Show toast for newly arrived unread notifications
      if (count > prevUnreadRef.current && prevUnreadRef.current >= 0) {
        const newOnes: Notification[] = list.slice(0, count - prevUnreadRef.current)
        newOnes.forEach((n) => {
          toast(n.body, {
            icon: notificationIcon(n.type),
            duration: 5000,
          })
        })
      }
      prevUnreadRef.current = count
    } catch {
      // Silently ignore — network or auth errors handled elsewhere
    }
  }, [])

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, pollIntervalMs)
    return () => clearInterval(interval)
  }, [fetchNotifications, pollIntervalMs])

  useEffect(() => {
    if (!USE_SOCKET || !accessToken) return
    const socket = io(SOCKET_URL, { auth: { token: accessToken }, transports: ['websocket', 'polling'], reconnection: true })
    let timer: ReturnType<typeof setTimeout> | null = null
    // Junta rajadas (vários avisos no mesmo segundo) numa consulta só
    socket.on('notification:new', () => {
      if (timer) return
      timer = setTimeout(() => { timer = null; fetchNotifications() }, 800)
    })
    return () => {
      if (timer) clearTimeout(timer)
      socket.disconnect()
    }
  }, [accessToken, fetchNotifications])

  const markRead = useCallback(async (id: string) => {
    await api.patch(`/notifications/${id}/read`)
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n))
    setUnread((c) => Math.max(0, c - 1))
  }, [])

  const markAllRead = useCallback(async () => {
    await api.patch('/notifications/read-all')
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    setUnread(0)
  }, [])

  return { notifications, unread, fetchNotifications, markRead, markAllRead }
}

function notificationIcon(type: string) {
  switch (type) {
    case 'NEW_ORDER_NEARBY': return '🔔'
    case 'CHECKIN_DONE': return '▶️'
    case 'SERVICE_COMPLETED': return '✅'
    case 'SERVICE_CONFIRMED': return '💰'
    case 'PROPOSAL_RECEIVED': return '📋'
    case 'PROPOSAL_ACCEPTED': return '🎉'
    default: return '🔔'
  }
}
