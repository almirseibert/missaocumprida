import { Alert } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { api } from './api'

/** Foto local escolhida (ainda não enviada) ou já enviada (url). */
export type PickedPhoto = { uri: string; name?: string | null; type?: string | null; remoteUrl?: string }

function toPicked(a: ImagePicker.ImagePickerAsset, i: number): PickedPhoto {
  return { uri: a.uri, name: a.fileName ?? `foto-${Date.now()}-${i}.jpg`, type: a.mimeType ?? 'image/jpeg' }
}

/** Tira uma foto com a câmera. */
export async function takePhoto(): Promise<PickedPhoto | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync()
  if (!perm.granted) {
    Alert.alert('Câmera bloqueada', 'Permita o acesso à câmera nas configurações do celular para tirar fotos.')
    return null
  }
  const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.6 })
  if (res.canceled || !res.assets?.length) return null
  return toPicked(res.assets[0], 0)
}

/** Escolhe várias fotos da galeria (até `max`). */
export async function pickFromLibrary(max: number): Promise<PickedPhoto[]> {
  if (max <= 0) return []
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!perm.granted && perm.accessPrivileges !== 'limited') {
    Alert.alert('Galeria bloqueada', 'Permita o acesso às fotos nas configurações do celular.')
    return []
  }
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: max,
    quality: 0.6,
  })
  if (res.canceled || !res.assets?.length) return []
  return res.assets.slice(0, max).map(toPicked)
}

/** Pergunta câmera ou galeria e devolve as fotos escolhidas. */
export function choosePhotos(max: number): Promise<PickedPhoto[]> {
  return new Promise((resolve) => {
    Alert.alert('Adicionar fotos', 'De onde vêm as fotos?', [
      { text: 'Câmera', onPress: () => takePhoto().then((p) => resolve(p ? [p] : [])) },
      { text: 'Galeria', onPress: () => pickFromLibrary(max).then(resolve) },
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve([]) },
    ])
  })
}

/** Monta o multipart (campo `field`) com as fotos locais. */
export function photosFormData(photos: PickedPhoto[], field = 'photos', extra?: Record<string, string>): FormData {
  const fd = new FormData()
  photos.forEach((p, i) => {
    fd.append(field, { uri: p.uri, name: p.name ?? `foto-${i}.jpg`, type: p.type ?? 'image/jpeg' } as unknown as Blob)
  })
  for (const [k, v] of Object.entries(extra ?? {})) fd.append(k, v)
  return fd
}

/**
 * Envia as fotos locais do pedido ANTES de criar/editar o pedido e devolve as
 * URLs. Fotos já enviadas (remoteUrl) são mantidas como estão.
 */
export async function uploadOrderPhotos(photos: PickedPhoto[]): Promise<string[]> {
  const kept = photos.filter((p) => p.remoteUrl).map((p) => p.remoteUrl as string)
  const local = photos.filter((p) => !p.remoteUrl)
  if (local.length === 0) return kept
  const res = await api.post('/orders/photos', photosFormData(local), {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  })
  return [...kept, ...(res.data.data.urls as string[])]
}
