import { useEffect, useState } from 'react'
import {
  View, Text, Modal, ScrollView, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native'
import { ShieldCheck, AlertTriangle } from 'lucide-react-native'
import { api } from '../lib/api'
import { formatDateShort } from '../lib/utils'
import { useAuthStore } from '../store/auth'

interface TermsPayload {
  version: string
  title: string
  effective_date: string
  body: string
}

export function TermsModal() {
  const { user, fetchMe } = useAuthStore()
  const [terms, setTerms] = useState<TermsPayload | null>(null)
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [reachedEnd, setReachedEnd] = useState(false)

  useEffect(() => {
    api.get('/legal/terms')
      .then(r => setTerms(r.data.data))
      .catch(() => {})
  }, [])

  if (!user || !terms) return null

  const userAccepted = !!user.terms_accepted_at && user.terms_version === terms.version
  const isNewVersion = !!user.terms_accepted_at && user.terms_version !== terms.version
  if (userAccepted) return null

  async function accept() {
    if (!agreed) return
    setSubmitting(true)
    try {
      await api.post('/legal/terms/accept')
      await fetchMe()
    } catch {
      Alert.alert('Erro', 'Não foi possível registrar a aceitação. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  function onScroll(e: { nativeEvent: { contentOffset: { y: number }; contentSize: { height: number }; layoutMeasurement: { height: number } } }) {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent
    if (contentOffset.y + layoutMeasurement.height >= contentSize.height - 24) {
      setReachedEnd(true)
    }
  }

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View className="flex-1 bg-black/70 justify-center p-3">
        <View className="bg-white rounded-2xl max-h-[92%] overflow-hidden">
          {/* Header — fundo brand-700 com ícone em pill translúcida */}
          <View className="bg-brand-700 px-5 py-4 flex-row items-start">
            <View className="w-9 h-9 rounded-full bg-white/15 items-center justify-center mr-3">
              <ShieldCheck size={18} color="#fff" />
            </View>
            <View className="flex-1">
              <Text className="font-display-bold text-white text-base">
                {terms.title}
              </Text>
              <Text className="font-sans text-brand-100 text-xs mt-0.5">
                Versão {terms.version} · Vigente em {formatDateShort(terms.effective_date)}
              </Text>
            </View>
          </View>

          {isNewVersion && (
            <View className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex-row items-center gap-2">
              <AlertTriangle size={14} color="#D97706" />
              <Text className="font-sans text-xs text-amber-800 flex-1">
                Os termos foram atualizados. Leia e aceite para continuar.
              </Text>
            </View>
          )}

          {/* Body */}
          <ScrollView
            className="px-5 py-4"
            onScroll={onScroll}
            scrollEventThrottle={120}
          >
            <TermsBody source={terms.body} />
            <View className="h-4" />
          </ScrollView>

          {/* Footer */}
          <View className="border-t border-slate2-200 bg-slate2-50 px-5 py-4 gap-3">
            {!reachedEnd && (
              <Text className="font-sans text-xs text-slate2-500 text-center">
                Role até o final do texto para habilitar a aceitação.
              </Text>
            )}
            <TouchableOpacity
              onPress={() => reachedEnd && setAgreed(!agreed)}
              disabled={!reachedEnd}
              activeOpacity={0.7}
              className="flex-row items-start gap-3"
            >
              <View
                className={`w-5 h-5 rounded border-2 items-center justify-center mt-0.5 ${
                  agreed ? 'bg-brand-700 border-brand-700' : 'bg-white border-slate2-400'
                } ${!reachedEnd ? 'opacity-40' : ''}`}
              >
                {agreed && (
                  <Text className="text-white text-xs" style={{ fontFamily: 'PlusJakartaSans_700Bold' }}>
                    ✓
                  </Text>
                )}
              </View>
              <Text
                className={`font-sans text-sm flex-1 leading-snug ${
                  !reachedEnd ? 'text-slate2-400' : 'text-slate2-700'
                }`}
              >
                Li integralmente os termos acima, compreendi as condições e a isenção de
                responsabilidade da plataforma, e{' '}
                <Text className="font-sans-semibold">aceito</Text> vincular-me
                a todas as regras estabelecidas.
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={accept}
              disabled={!agreed || submitting}
              className={`rounded-xl py-3.5 items-center ${
                !agreed || submitting ? 'bg-brand-400' : 'bg-brand-700'
              }`}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="font-display-bold text-white text-base">
                  Aceitar e continuar
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Renderer minimalista de markdown para os termos
// ---------------------------------------------------------------------------
function TermsBody({ source }: { source: string }) {
  const lines = source.split('\n')
  const blocks: React.ReactNode[] = []
  let listBuffer: string[] = []

  const flushList = () => {
    if (listBuffer.length === 0) return
    blocks.push(
      <View key={`ul-${blocks.length}`} className="pl-3 mb-3 gap-1">
        {listBuffer.map((item, i) => (
          <View key={i} className="flex-row gap-2">
            <Text className="font-sans text-slate2-600">•</Text>
            <Text className="font-sans text-sm text-slate2-700 flex-1 leading-snug">
              {inline(item)}
            </Text>
          </View>
        ))}
      </View>
    )
    listBuffer = []
  }

  for (const raw of lines) {
    const line = raw.trim()
    if (line.startsWith('## ')) {
      flushList()
      blocks.push(
        <Text
          key={`h-${blocks.length}`}
          className="font-display-bold text-base text-slate2-900 mt-4 mb-2"
        >
          {line.slice(3)}
        </Text>
      )
    } else if (line.startsWith('- ')) {
      listBuffer.push(line.slice(2))
    } else if (line === '---') {
      flushList()
      blocks.push(<View key={`hr-${blocks.length}`} className="h-px bg-slate2-200 my-3" />)
    } else if (line === '') {
      flushList()
    } else {
      flushList()
      blocks.push(
        <Text
          key={`p-${blocks.length}`}
          className="font-sans text-sm text-slate2-700 leading-relaxed mb-2.5"
        >
          {inline(line)}
        </Text>
      )
    }
  }
  flushList()
  return <>{blocks}</>
}

function inline(s: string): React.ReactNode {
  const parts: React.ReactNode[] = []
  const regex = /\*\*(.+?)\*\*/g
  let last = 0
  let match: RegExpExecArray | null
  while ((match = regex.exec(s)) !== null) {
    if (match.index > last) parts.push(s.slice(last, match.index))
    parts.push(
      <Text key={parts.length} className="font-sans-semibold">
        {match[1]}
      </Text>
    )
    last = match.index + match[0].length
  }
  if (last < s.length) parts.push(s.slice(last))
  return parts.length > 0 ? parts : s
}
