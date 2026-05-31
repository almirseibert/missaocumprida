'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { api } from '@/lib/api'
import { Notification } from '@/types'
import toast from 'react-hot-toast'

export function useNotifications(pollIntervalMs = 20000) {
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
