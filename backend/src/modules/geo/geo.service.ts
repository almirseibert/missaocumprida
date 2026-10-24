// ============================================================
// Geolocalização do endereço do serviço.
// - CEP → endereço: ViaCEP (gratuito, sem chave).
// - Endereço → coordenadas e coordenadas → endereço: Nominatim/OSM.
//   A política do Nominatim exige User-Agent identificável e no máximo
//   1 requisição/segundo: há uma fila em memória e cache em geo_cache.
//   Para volume alto, troque GEOCODER (ver env) por um serviço pago.
// ============================================================
import { prisma } from '../../config/database'
import { env } from '../../config/env'

export type CepResult = {
  cep: string
  street: string
  neighborhood: string
  city: string
  state: string
}

export type GeocodeResult = {
  latitude: number
  longitude: number
  /** quão específico foi o resultado */
  precision: 'ADDRESS' | 'STREET' | 'CEP' | 'CITY'
  display_name?: string
}

export type ReverseResult = {
  street: string
  number: string
  neighborhood: string
  city: string
  state: string
  cep: string
}

const CEP_TTL_MS = 30 * 24 * 60 * 60 * 1000
const GEOCODE_TTL_MS = 90 * 24 * 60 * 60 * 1000
const HTTP_TIMEOUT_MS = 6000

const UF_BY_NAME: Record<string, string> = {
  acre: 'AC', alagoas: 'AL', amapá: 'AP', amapa: 'AP', amazonas: 'AM', bahia: 'BA', ceará: 'CE', ceara: 'CE',
  'distrito federal': 'DF', 'espírito santo': 'ES', 'espirito santo': 'ES', goiás: 'GO', goias: 'GO',
  maranhão: 'MA', maranhao: 'MA', 'mato grosso': 'MT', 'mato grosso do sul': 'MS', 'minas gerais': 'MG',
  pará: 'PA', para: 'PA', paraíba: 'PB', paraiba: 'PB', paraná: 'PR', parana: 'PR', pernambuco: 'PE',
  piauí: 'PI', piaui: 'PI', 'rio de janeiro': 'RJ', 'rio grande do norte': 'RN', 'rio grande do sul': 'RS',
  rondônia: 'RO', rondonia: 'RO', roraima: 'RR', 'santa catarina': 'SC', 'são paulo': 'SP', 'sao paulo': 'SP',
  sergipe: 'SE', tocantins: 'TO',
}

export function ufFromName(name?: string | null): string {
  if (!name) return ''
  const n = name.trim()
  if (/^[A-Za-z]{2}$/.test(n)) return n.toUpperCase()
  return UF_BY_NAME[n.toLowerCase()] ?? ''
}

export function normalizeCep(cep?: string | null): string | null {
  const digits = String(cep ?? '').replace(/\D/g, '')
  return digits.length === 8 ? digits : null
}

async function cached<T>(key: string, kind: string, ttlMs: number, load: () => Promise<T | null>): Promise<T | null> {
  try {
    const hit = await prisma.geoCache.findUnique({ where: { key } })
    if (hit && Date.now() - hit.created_at.getTime() < ttlMs) return hit.result as T
  } catch {
    // cache indisponível não impede a consulta
  }
  const value = await load()
  if (value) {
    await prisma.geoCache
      .upsert({
        where: { key },
        create: { key, kind, result: value as never },
        update: { result: value as never, created_at: new Date() },
      })
      .catch(() => {})
  }
  return value
}

async function fetchJson(url: string, headers: Record<string, string> = {}): Promise<any> {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(HTTP_TIMEOUT_MS) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// ---- Fila do Nominatim: no máximo 1 requisição por segundo por processo ----
let nominatimChain: Promise<unknown> = Promise.resolve()
let lastNominatimAt = 0
function nominatim<T>(path: string): Promise<T> {
  const run = async () => {
    const wait = lastNominatimAt + 1100 - Date.now()
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
    lastNominatimAt = Date.now()
    return fetchJson(`https://nominatim.openstreetmap.org/${path}`, {
      'User-Agent': env.NOMINATIM_USER_AGENT,
      'Accept-Language': 'pt-BR',
    }) as Promise<T>
  }
  const next = nominatimChain.then(run, run)
  nominatimChain = next.catch(() => {})
  return next
}

export async function lookupCep(cepRaw: string): Promise<CepResult | null> {
  const cep = normalizeCep(cepRaw)
  if (!cep) return null
  return cached<CepResult>(`cep:${cep}`, 'CEP', CEP_TTL_MS, async () => {
    try {
      const data = await fetchJson(`https://viacep.com.br/ws/${cep}/json/`)
      if (!data || data.erro) return null
      return {
        cep,
        street: data.logradouro ?? '',
        neighborhood: data.bairro ?? '',
        city: data.localidade ?? '',
        state: data.uf ?? '',
      }
    } catch (err) {
      console.error('[geo] ViaCEP falhou:', (err as Error).message)
      return null
    }
  })
}

/**
 * Endereço digitado → coordenadas. Tenta do mais específico (rua + número)
 * ao menos específico (CEP, cidade). Retorna null se o geocoder estiver
 * desligado (GEOCODER=none) ou nada for encontrado.
 */
export async function geocodeAddress(input: {
  street?: string | null
  number?: string | null
  neighborhood?: string | null
  city?: string | null
  state?: string | null
  cep?: string | null
}): Promise<GeocodeResult | null> {
  if (env.GEOCODER === 'none') return null
  const city = (input.city ?? '').trim()
  const state = ufFromName(input.state) || (input.state ?? '').trim()
  const street = (input.street ?? '').trim()
  const number = (input.number ?? '').trim()
  const cep = normalizeCep(input.cep)
  if (!city && !cep) return null

  const attempts: Array<{ params: Record<string, string>; precision: GeocodeResult['precision'] }> = []
  if (street) {
    const streetLine = number && !street.includes(number) ? `${number} ${street}` : street
    attempts.push({ params: { street: streetLine, city, state, country: 'Brasil' }, precision: number ? 'ADDRESS' : 'STREET' })
  }
  if (cep) attempts.push({ params: { postalcode: cep, country: 'Brasil' }, precision: 'CEP' })
  if (city) attempts.push({ params: { city, state, country: 'Brasil' }, precision: 'CITY' })

  for (const attempt of attempts) {
    const qs = new URLSearchParams({ format: 'jsonv2', limit: '1', countrycodes: 'br' })
    for (const [k, v] of Object.entries(attempt.params)) if (v) qs.set(k, v)
    const key = `geo:${qs.toString().toLowerCase()}`
    const result = await cached<GeocodeResult>(key, 'GEOCODE', GEOCODE_TTL_MS, async () => {
      try {
        const data = await nominatim<any[]>(`search?${qs.toString()}`)
        const hit = Array.isArray(data) ? data[0] : null
        if (!hit) return null
        const latitude = Number(hit.lat)
        const longitude = Number(hit.lon)
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
        return { latitude, longitude, precision: attempt.precision, display_name: hit.display_name }
      } catch (err) {
        console.error('[geo] Nominatim search falhou:', (err as Error).message)
        return null
      }
    })
    if (result) return result
  }
  return null
}

/** Coordenadas → endereço (para preencher o formulário quando o cliente está no local). */
export async function reverseGeocode(latitude: number, longitude: number): Promise<ReverseResult | null> {
  if (env.GEOCODER === 'none') return null
  const lat = latitude.toFixed(5)
  const lng = longitude.toFixed(5)
  return cached<ReverseResult>(`rev:${lat},${lng}`, 'REVERSE', GEOCODE_TTL_MS, async () => {
    try {
      const data = await nominatim<any>(`reverse?format=jsonv2&addressdetails=1&lat=${lat}&lon=${lng}`)
      const a = data?.address
      if (!a) return null
      return {
        street: a.road ?? a.pedestrian ?? '',
        number: a.house_number ?? '',
        neighborhood: a.suburb ?? a.neighbourhood ?? a.quarter ?? '',
        city: a.city ?? a.town ?? a.village ?? a.municipality ?? '',
        state: ufFromName(a['ISO3166-2-lvl4']?.split('-')[1] ?? a.state),
        cep: normalizeCep(a.postcode) ?? '',
      }
    } catch (err) {
      console.error('[geo] Nominatim reverse falhou:', (err as Error).message)
      return null
    }
  })
}
