import { useEffect, useState } from 'react'
import { View, Text, Modal, TouchableOpacity } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { api } from '../lib/api'

/**
 * Avisos do admin (Remap 2.0): busca /announcements/active no boot e exibe
 * cada POPUP uma única vez (ids vistos ficam no AsyncStorage). BANNERs são
 * expostos via hook para a home exibir como faixa.
 */

type Announcement = {
  id: string
  title: string
  body: string
  type: 'POPUP' | 'BANNER'
}

const SEEN_KEY = 'mc_seen_announcements'

let bannerCache: Announcement[] = []
export function getActiveBanners(): Announcement[] {
  return bannerCache
}

export function AnnouncementsGate() {
  const [queue, setQueue] = useState<Announcement[]>([])
  const [current, setCurrent] = useState<Announcement | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [res, seenRaw] = await Promise.all([
          api.get('/announcements/active'),
          AsyncStorage.getItem(SEEN_KEY),
        ])
        if (cancelled) return
        const list: Announcement[] = Array.isArray(res.data.data) ? res.data.data : []
        const seen: string[] = seenRaw ? JSON.parse(seenRaw) : []
        bannerCache = list.filter((a) => a.type === 'BANNER')
        const popups = list.filter((a) => a.type === 'POPUP' && !seen.includes(a.id))
        setQueue(popups)
        setCurrent(popups[0] ?? null)
      } catch {}
    })()
    return () => { cancelled = true }
  }, [])

  async function dismiss() {
    if (!current) return
    try {
      const seenRaw = await AsyncStorage.getItem(SEEN_KEY)
      const seen: string[] = seenRaw ? JSON.parse(seenRaw) : []
      if (!seen.includes(current.id)) {
        // Mantém só os 50 últimos ids para não crescer para sempre
        await AsyncStorage.setItem(SEEN_KEY, JSON.stringify([...seen, current.id].slice(-50)))
      }
    } catch {}
    const rest = queue.slice(1)
    setQueue(rest)
    setCurrent(rest[0] ?? null)
  }

  if (!current) return null

  return (
    <Modal visible transparent animationType="fade" onRequestClose={dismiss}>
      <View className="flex-1 bg-black/50 items-center justify-center px-6">
        <View className="bg-white rounded-3xl p-6 w-full max-w-[360px]">
          <Text className="text-4xl text-center mb-3">📣</Text>
          <Text className="font-display-extrabold text-xl text-slate2-900 text-center mb-2">
            {current.title}
          </Text>
          <Text className="font-sans text-slate2-600 text-center leading-relaxed mb-5">
            {current.body}
          </Text>
          <TouchableOpacity onPress={dismiss} className="bg-accent-600 rounded-xl py-3.5">
            <Text className="font-display-bold text-white text-center">Entendi</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}
