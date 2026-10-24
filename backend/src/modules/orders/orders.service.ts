// ============================================================
// Regras de criação/edição de pedido compartilhadas pelo controller.
// Aceitam os formatos que o app instalado (versão 11) envia — booleano cru,
// data DD/MM/AAAA, cidade "Lajeado, RS" — para não quebrar quem ainda não
// atualizou o app.
// ============================================================
import crypto from 'crypto'
import { prisma } from '../../config/database'
import { env } from '../../config/env'
import { sanitizeContactInfo } from '../../utils/contactSanitizer'
import { geocodeAddress, normalizeCep } from '../geo/geo.service'

export const BR_STATES = new Set([
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
])

export type RawAnswer = string | number | boolean | string[] | null | undefined

type FieldForAnswers = {
  id: string
  question: string
  field_type: string
  options: unknown
  is_required: boolean
  is_active: boolean
}

const TRUE_VALUES = new Set(['true', 'sim', '1', 'yes', 's'])
const FALSE_VALUES = new Set(['false', 'não', 'nao', '0', 'no', 'n'])

/**
 * Converte a data desejada para Date. Aceita ISO, AAAA-MM-DD e DD/MM/AAAA
 * (com hora opcional HH:mm). Retorna null para vazio e 'invalid' se não der.
 */
export function parseFlexibleDate(value: unknown): Date | null | 'invalid' {
  if (value === undefined || value === null) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? 'invalid' : value
  const s = String(value).trim()
  if (!s) return null
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/)
  if (br) {
    const [, d, m, y, hh, mm] = br
    // 12h no fuso de Brasília quando a hora não vem (evita "virar o dia" em UTC)
    const hours = hh !== undefined ? Number(hh) + 3 : 15
    const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), hours, mm !== undefined ? Number(mm) : 0))
    if (date.getUTCMonth() !== Number(m) - 1 || date.getUTCDate() !== Number(d)) return 'invalid'
    return date
  }
  const isoDay = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoDay) {
    const date = new Date(Date.UTC(Number(isoDay[1]), Number(isoDay[2]) - 1, Number(isoDay[3]), 15, 0))
    return Number.isNaN(date.getTime()) ? 'invalid' : date
  }
  const date = new Date(s)
  return Number.isNaN(date.getTime()) ? 'invalid' : date
}

/**
 * Resolve UF e cidade. O app antigo manda tudo em "city" ("Lajeado, RS" ou
 * "Lajeado - RS") e nunca manda a UF; o site pode mandar UF vazia.
 */
export function normalizeCityState(
  cityRaw: string | undefined,
  stateRaw: string | undefined,
  profileState?: string | null,
): { city: string; state: string } {
  let city = (cityRaw ?? '').trim()
  let state = (stateRaw ?? '').trim().toUpperCase()
  const m = city.match(/^(.*?)[\s]*[,/-][\s]*([A-Za-z]{2})$/)
  if (m && BR_STATES.has(m[2].toUpperCase())) {
    city = m[1].trim()
    if (!BR_STATES.has(state)) state = m[2].toUpperCase()
  }
  if (!BR_STATES.has(state)) {
    const p = (profileState ?? '').trim().toUpperCase()
    state = BR_STATES.has(p) ? p : 'SP'
  }
  return { city, state }
}

function optionList(options: unknown): string[] {
  return Array.isArray(options) ? options.map((o) => String(o)) : []
}

/**
 * Normaliza as respostas do questionário:
 * - descarta chaves que não são perguntas ativas da categoria;
 * - Sim/Não vira 'true'/'false' (desmarcado = 'false');
 * - SELECT/RADIO precisam ser uma das opções;
 * - textos têm tamanho limitado e dados de contato removidos (antibypass);
 * - perguntas de foto nunca são obrigatórias (as fotos vão no bloco de fotos).
 */
export function normalizeAnswers(
  fields: FieldForAnswers[],
  raw: Record<string, RawAnswer>,
): { answers: Record<string, string>; missing: string[]; invalid: string[] } {
  const answers: Record<string, string> = {}
  const missing: string[] = []
  const invalid: string[] = []

  for (const f of fields) {
    if (!f.is_active || f.field_type === 'PHOTO') continue
    const value = raw[f.id]
    const empty =
      value === undefined || value === null ||
      (typeof value === 'string' && value.trim() === '') ||
      (Array.isArray(value) && value.length === 0)

    if (f.field_type === 'BOOLEAN') {
      if (empty) { answers[f.id] = 'false'; continue }
      const s = String(value).trim().toLowerCase()
      if (value === true || TRUE_VALUES.has(s)) answers[f.id] = 'true'
      else if (value === false || FALSE_VALUES.has(s)) answers[f.id] = 'false'
      else invalid.push(f.question)
      continue
    }

    if (empty) {
      if (f.is_required) missing.push(f.question)
      continue
    }

    if (f.field_type === 'SELECT' || f.field_type === 'RADIO') {
      const opts = optionList(f.options)
      const s = Array.isArray(value) ? String(value[0]) : String(value)
      if (opts.length && !opts.includes(s)) { invalid.push(f.question); continue }
      answers[f.id] = s
      continue
    }

    if (f.field_type === 'NUMBER') {
      const n = Number(String(value).replace(',', '.'))
      if (!Number.isFinite(n) || n < 0) { invalid.push(f.question); continue }
      answers[f.id] = String(n)
      continue
    }

    const max = f.field_type === 'TEXTAREA' ? 2000 : 500
    const text = (Array.isArray(value) ? value.join(', ') : String(value)).trim().slice(0, max)
    answers[f.id] = sanitizeContactInfo(text)
  }

  return { answers, missing, invalid }
}

export type AnswerSnapshotItem = { field_id: string; question: string; field_type: string; value: string }

/** Foto das perguntas/respostas no momento do pedido (guardada em answers_snapshot). */
export function buildAnswersSnapshot(
  fields: Array<{ id: string; question: string; field_type: string; order: number }>,
  answers: Record<string, string>,
): AnswerSnapshotItem[] {
  return [...fields]
    .sort((a, b) => a.order - b.order)
    .filter((f) => f.field_type !== 'PHOTO' && answers[f.id] !== undefined && answers[f.id] !== '')
    .map((f) => ({ field_id: f.id, question: f.question, field_type: f.field_type, value: answers[f.id] }))
}

/** Lista legível pergunta → resposta (para cliente e prestador verem no pedido). */
export function buildAnswersDisplay(
  fields: Array<{ id: string; question: string; field_type: string; order: number }>,
  answers: unknown,
  opts: { maskContacts: boolean; snapshot?: unknown },
): AnswerSnapshotItem[] {
  let items: AnswerSnapshotItem[]
  if (Array.isArray(opts.snapshot) && opts.snapshot.length > 0) {
    items = (opts.snapshot as AnswerSnapshotItem[]).filter((i) => i && i.question && i.value !== undefined)
  } else {
    if (!answers || typeof answers !== 'object') return []
    const map = answers as Record<string, unknown>
    items = [...fields]
      .sort((a, b) => a.order - b.order)
      .filter((f) => f.field_type !== 'PHOTO' && map[f.id] !== undefined && map[f.id] !== null && map[f.id] !== '')
      .map((f) => ({ field_id: f.id, question: f.question, field_type: f.field_type, value: String(map[f.id]) }))
  }
  return items.map((i) => {
    let value = String(i.value)
    if (i.field_type === 'BOOLEAN') value = TRUE_VALUES.has(value.toLowerCase()) ? 'Sim' : 'Não'
    if (opts.maskContacts) value = sanitizeContactInfo(value)
    return { ...i, value }
  })
}

// ---------------------------------------------------------------------------
// Local exato do serviço
// ---------------------------------------------------------------------------
export const LOCATION_SOURCES = ['GPS_AT_SITE', 'ADDRESS_GEOCODED'] as const

export type ResolvedLocation = {
  latitude: number | null
  longitude: number | null
  location_source: string | null
  location_accuracy_m: number | null
  location_captured_at: Date | null
}

/**
 * Define as coordenadas do serviço, nesta ordem:
 * 1. as que o app/site enviou — GPS_AT_SITE quando o cliente respondeu que
 *    está no local, ADDRESS_GEOCODED quando o endereço foi convertido no aparelho;
 * 2. o endereço digitado convertido no servidor (app antigo não manda GPS);
 * 3. a posição do cadastro, marcada como PROFILE (aproximada).
 */
export async function resolveServiceLocation(
  input: {
    latitude?: number | null
    longitude?: number | null
    location_source?: string | null
    location_accuracy_m?: number | null
    address?: string | null
    address_number?: string | null
    neighborhood?: string | null
    city?: string | null
    state?: string | null
    cep?: string | null
  },
  profile?: { latitude: number | null; longitude: number | null } | null,
): Promise<ResolvedLocation> {
  const hasCoords =
    typeof input.latitude === 'number' && typeof input.longitude === 'number' &&
    !(input.latitude === 0 && input.longitude === 0)
  if (hasCoords) {
    const source = (LOCATION_SOURCES as readonly string[]).includes(input.location_source ?? '')
      ? (input.location_source as string)
      : 'GPS_AT_SITE'
    return {
      latitude: input.latitude as number,
      longitude: input.longitude as number,
      location_source: source,
      location_accuracy_m: input.location_accuracy_m ?? null,
      location_captured_at: new Date(),
    }
  }
  const geo = await geocodeAddress({
    street: input.address,
    number: input.address_number,
    neighborhood: input.neighborhood,
    city: input.city,
    state: input.state,
    cep: normalizeCep(input.cep),
  })
  if (geo && geo.precision !== 'CITY') {
    return {
      latitude: geo.latitude,
      longitude: geo.longitude,
      location_source: 'ADDRESS_GEOCODED',
      location_accuracy_m: geo.precision === 'ADDRESS' ? 50 : geo.precision === 'STREET' ? 300 : 1000,
      location_captured_at: new Date(),
    }
  }
  if (profile?.latitude != null && profile?.longitude != null) {
    return {
      latitude: profile.latitude,
      longitude: profile.longitude,
      location_source: 'PROFILE',
      location_accuracy_m: null,
      location_captured_at: null,
    }
  }
  if (geo) {
    return {
      latitude: geo.latitude,
      longitude: geo.longitude,
      location_source: 'ADDRESS_GEOCODED',
      location_accuracy_m: 5000,
      location_captured_at: new Date(),
    }
  }
  return { latitude: null, longitude: null, location_source: null, location_accuracy_m: null, location_captured_at: null }
}

/**
 * Ponto aproximado mostrado ANTES da conexão paga: deslocado 300–800 m do
 * local real numa direção fixa por pedido (sempre o mesmo ponto — consultar
 * várias vezes não ajuda a achar o centro, ao contrário de um sorteio).
 */
export function fuzzCoordinates(orderId: string, lat: number, lng: number): { latitude: number; longitude: number } {
  const h = crypto.createHmac('sha256', env.JWT_SECRET).update(`loc:${orderId}`).digest()
  const angle = (h.readUInt16BE(0) / 0xffff) * 2 * Math.PI
  const meters = 300 + (h.readUInt16BE(2) / 0xffff) * 500
  const dLat = (meters * Math.cos(angle)) / 111_320
  const dLng = (meters * Math.sin(angle)) / (111_320 * Math.max(Math.cos((lat * Math.PI) / 180), 0.2))
  return {
    latitude: Math.round((lat + dLat) * 10_000) / 10_000,
    longitude: Math.round((lng + dLng) * 10_000) / 10_000,
  }
}

const FILE_URL_RE = /\/api\/files\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:[/?#].*)?$/i

/**
 * Confere que as fotos informadas foram enviadas pelo próprio usuário
 * (POST /orders/photos) — impede anexar arquivos de outra pessoa.
 * Devolve a lista sem duplicadas ou null se alguma não pertence a ele.
 */
export async function validateOwnedPhotoUrls(urls: string[], userId: string): Promise<string[] | null> {
  const unique = Array.from(new Set(urls))
  const ids: string[] = []
  for (const u of unique) {
    const m = u.match(FILE_URL_RE)
    if (!m) return null
    ids.push(m[1].toLowerCase())
  }
  if (ids.length === 0) return []
  const owned = await prisma.fileAsset.count({ where: { id: { in: ids }, owner_id: userId, sensitive: false } })
  return owned === ids.length ? unique : null
}
