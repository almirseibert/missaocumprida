import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native'
import * as Location from 'expo-location'
import { Crosshair, MapPin, Search } from 'lucide-react-native'
import { api } from '../lib/api'
import { maskCep } from '../lib/ids'

/**
 * Local exato do serviço (última etapa do pedido).
 * "Você está agora no local onde o serviço será prestado?"
 *  - Sim → GPS em alta precisão + endereço preenchido automaticamente;
 *  - Não → CEP + número, e o endereço é convertido em coordenadas.
 * O prestador só recebe o endereço exato depois das duas taxas de conexão.
 */
export interface ServiceLocationValue {
  mode: 'AT_SITE' | 'ADDRESS' | null
  cep: string
  street: string
  number: string
  complement: string
  neighborhood: string
  city: string
  state: string
  latitude: number | null
  longitude: number | null
  accuracy: number | null
  location_source: 'GPS_AT_SITE' | 'ADDRESS_GEOCODED' | null
}

export const EMPTY_LOCATION: ServiceLocationValue = {
  mode: null, cep: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '',
  latitude: null, longitude: null, accuracy: null, location_source: null,
}

const MAX_ACCURACY_M = 100
const GPS_TIMEOUT_MS = 15000

const UF: Record<string, string> = {
  acre: 'AC', alagoas: 'AL', amapá: 'AP', amazonas: 'AM', bahia: 'BA', ceará: 'CE', 'distrito federal': 'DF',
  'espírito santo': 'ES', goiás: 'GO', maranhão: 'MA', 'mato grosso': 'MT', 'mato grosso do sul': 'MS',
  'minas gerais': 'MG', pará: 'PA', paraíba: 'PB', paraná: 'PR', pernambuco: 'PE', piauí: 'PI',
  'rio de janeiro': 'RJ', 'rio grande do norte': 'RN', 'rio grande do sul': 'RS', rondônia: 'RO', roraima: 'RR',
  'santa catarina': 'SC', 'são paulo': 'SP', sergipe: 'SE', tocantins: 'TO',
}
function toUf(region?: string | null): string {
  if (!region) return ''
  const r = region.trim()
  if (/^[A-Za-z]{2}$/.test(r)) return r.toUpperCase()
  return UF[r.toLowerCase()] ?? ''
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))])
}

export function ServiceLocationStep({
  value,
  onChange,
}: {
  value: ServiceLocationValue
  onChange: (v: ServiceLocationValue) => void
}) {
  const [locating, setLocating] = useState(false)
  const [lookingCep, setLookingCep] = useState(false)
  const [geocoding, setGeocoding] = useState(false)
  const set = (patch: Partial<ServiceLocationValue>) => onChange({ ...value, ...patch })

  async function captureAtSite() {
    setLocating(true)
    try {
      const perm = await Location.requestForegroundPermissionsAsync()
      if (!perm.granted) {
        Alert.alert('Localização bloqueada', 'Sem permissão de localização. Informe o endereço pelo CEP.')
        onChange({ ...value, mode: 'ADDRESS', location_source: null, latitude: null, longitude: null, accuracy: null })
        return
      }
      const pos = await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest }), GPS_TIMEOUT_MS)
      const { latitude, longitude, accuracy } = pos.coords
      const next: ServiceLocationValue = {
        ...value,
        mode: 'AT_SITE',
        latitude,
        longitude,
        accuracy: accuracy != null ? Math.round(accuracy) : null,
        location_source: 'GPS_AT_SITE',
      }
      // Endereço a partir do GPS: primeiro no aparelho, depois no servidor
      try {
        const [a] = await Location.reverseGeocodeAsync({ latitude, longitude })
        if (a) {
          next.street = a.street || next.street
          next.number = a.streetNumber || next.number
          next.neighborhood = a.district || a.subregion || next.neighborhood
          next.city = a.city || a.subregion || next.city
          next.state = toUf(a.region) || next.state
          next.cep = a.postalCode ? maskCep(a.postalCode) : next.cep
        }
      } catch {
        try {
          const r = await api.post('/geo/reverse', { latitude, longitude })
          const a = r.data.data
          next.street = a.street || next.street
          next.number = a.number || next.number
          next.neighborhood = a.neighborhood || next.neighborhood
          next.city = a.city || next.city
          next.state = a.state || next.state
          next.cep = a.cep ? maskCep(a.cep) : next.cep
        } catch { /* o cliente preenche */ }
      }
      onChange(next)
      if (accuracy != null && accuracy > MAX_ACCURACY_M) {
        Alert.alert(
          'Sinal de GPS fraco',
          `A precisão está em ±${Math.round(accuracy)} m. Se puder, vá para perto de uma janela e toque em "Sim, estou no local" de novo. Confira o número e o complemento abaixo.`,
        )
      }
    } catch {
      Alert.alert('Não foi possível obter sua localização', 'Verifique se o GPS está ligado ou informe o endereço pelo CEP.')
      onChange({ ...value, mode: 'ADDRESS', location_source: null, latitude: null, longitude: null, accuracy: null })
    } finally {
      setLocating(false)
    }
  }

  async function lookupCep(masked: string) {
    const cep = masked.replace(/\D/g, '')
    if (cep.length !== 8) return
    setLookingCep(true)
    try {
      const r = await api.get(`/geo/cep/${cep}`)
      const a = r.data.data
      onChange({
        ...value,
        cep: maskCep(cep),
        street: a.street || value.street,
        neighborhood: a.neighborhood || value.neighborhood,
        city: a.city || value.city,
        state: a.state || value.state,
        latitude: null, longitude: null, accuracy: null, location_source: null,
      })
    } catch {
      Alert.alert('CEP não encontrado', 'Preencha o endereço manualmente.')
    } finally {
      setLookingCep(false)
    }
  }

  async function geocode() {
    if (!value.city || !value.street) { Alert.alert('Atenção', 'Informe ao menos a rua e a cidade.'); return }
    setGeocoding(true)
    try {
      const query = `${value.street}, ${value.number}, ${value.neighborhood}, ${value.city} - ${value.state}, Brasil`
      let coords: { latitude: number; longitude: number } | null = null
      try {
        const perm = await Location.getForegroundPermissionsAsync()
        if (perm.granted) {
          const [g] = await Location.geocodeAsync(query)
          if (g) coords = { latitude: g.latitude, longitude: g.longitude }
        }
      } catch { /* cai para o servidor */ }
      if (!coords) {
        const r = await api.post('/geo/geocode', {
          street: value.street, number: value.number, neighborhood: value.neighborhood,
          city: value.city, state: value.state, cep: value.cep,
        })
        coords = { latitude: r.data.data.latitude, longitude: r.data.data.longitude }
      }
      set({ ...coords, location_source: 'ADDRESS_GEOCODED', accuracy: null })
    } catch {
      Alert.alert('Endereço não localizado no mapa', 'Sem problema: ele será localizado ao publicar o pedido.')
    } finally {
      setGeocoding(false)
    }
  }

  const input = 'bg-white border border-slate2-300 rounded-xl px-3.5 py-3 text-slate2-900 font-sans'
  const chip = (active: boolean) =>
    `flex-row items-center justify-center gap-2 px-3.5 py-3 rounded-xl border-2 ${active ? 'border-brand-600 bg-brand-50' : 'border-slate2-200 bg-white'}`

  return (
    <View className="bg-white rounded-2xl border border-slate2-200 p-4 gap-3">
      <View className="flex-row items-center gap-2">
        <MapPin size={18} color="#059669" />
        <Text className="font-display-bold text-slate2-900">Local do serviço</Text>
      </View>
      <Text className="font-display-semibold text-sm text-slate2-800">
        Você está agora no local onde o serviço será prestado?
      </Text>
      <View className="gap-2">
        <TouchableOpacity accessibilityRole="button" onPress={captureAtSite} disabled={locating} className={chip(value.mode === 'AT_SITE')}>
          {locating ? <ActivityIndicator color="#059669" /> : <Crosshair size={18} color="#047857" />}
          <Text className="font-display-semibold text-sm text-slate2-900">Sim, estou no local</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() =>
            set({
              mode: 'ADDRESS',
              ...(value.location_source === 'GPS_AT_SITE' ? { latitude: null, longitude: null, accuracy: null, location_source: null } : {}),
            })
          }
          className={chip(value.mode === 'ADDRESS')}
        >
          <Text className="font-display-semibold text-sm text-slate2-900">Não, vou informar o endereço</Text>
        </TouchableOpacity>
      </View>
      {value.mode === 'AT_SITE' && value.latitude != null && (
        <Text className="font-sans text-xs text-green-700">
          ✓ Localização capturada{value.accuracy ? ` (precisão ±${value.accuracy} m)` : ''}. Confira o endereço.
        </Text>
      )}

      {value.mode && (
        <View className="gap-2.5">
          <View className="flex-row gap-2.5">
            <View className="w-32">
              <Text className="font-sans text-xs text-slate2-600 mb-1">CEP</Text>
              <TextInput
                className={input}
                keyboardType="number-pad"
                placeholder="00000-000"
                placeholderTextColor="#94A3B8"
                value={value.cep}
                onChangeText={(t) => {
                  const v = maskCep(t)
                  set({ cep: v })
                  if (value.mode === 'ADDRESS' && v.replace(/\D/g, '').length === 8) lookupCep(v)
                }}
              />
            </View>
            {lookingCep && <ActivityIndicator className="mt-6" color="#059669" />}
          </View>
          <View>
            <Text className="font-sans text-xs text-slate2-600 mb-1">Rua *</Text>
            <TextInput className={input} value={value.street} onChangeText={(t) => set({ street: t })} placeholder="Nome da rua" placeholderTextColor="#94A3B8" />
          </View>
          <View className="flex-row gap-2.5">
            <View className="w-24">
              <Text className="font-sans text-xs text-slate2-600 mb-1">Número *</Text>
              <TextInput className={input} value={value.number} onChangeText={(t) => set({ number: t })} placeholder="123" placeholderTextColor="#94A3B8" />
            </View>
            <View className="flex-1">
              <Text className="font-sans text-xs text-slate2-600 mb-1">Complemento</Text>
              <TextInput className={input} value={value.complement} onChangeText={(t) => set({ complement: t })} placeholder="Apto, bloco…" placeholderTextColor="#94A3B8" />
            </View>
          </View>
          <View>
            <Text className="font-sans text-xs text-slate2-600 mb-1">Bairro</Text>
            <TextInput className={input} value={value.neighborhood} onChangeText={(t) => set({ neighborhood: t })} />
          </View>
          <View className="flex-row gap-2.5">
            <View className="flex-1">
              <Text className="font-sans text-xs text-slate2-600 mb-1">Cidade *</Text>
              <TextInput className={input} value={value.city} onChangeText={(t) => set({ city: t })} />
            </View>
            <View className="w-20">
              <Text className="font-sans text-xs text-slate2-600 mb-1">UF</Text>
              <TextInput className={input} value={value.state} maxLength={2} autoCapitalize="characters" onChangeText={(t) => set({ state: t.toUpperCase() })} />
            </View>
          </View>
          {value.mode === 'ADDRESS' && (
            <View className="flex-row items-center gap-3">
              <TouchableOpacity onPress={geocode} disabled={geocoding} className="flex-row items-center gap-1.5 px-3 py-2 rounded-lg border border-slate2-300">
                {geocoding ? <ActivityIndicator size="small" color="#059669" /> : <Search size={14} color="#334155" />}
                <Text className="font-sans-semibold text-xs text-slate2-700">Localizar no mapa</Text>
              </TouchableOpacity>
              {value.location_source === 'ADDRESS_GEOCODED' && <Text className="font-sans text-xs text-green-700">✓ Localizado</Text>}
            </View>
          )}
          <Text className="font-sans text-xs text-slate2-500">
            🔒 O prestador vê só o bairro e a região até que vocês dois paguem a taxa de conexão. Depois disso ele recebe o endereço completo e o ponto exato no mapa.
          </Text>
        </View>
      )}
    </View>
  )
}
