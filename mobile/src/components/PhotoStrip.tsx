import { View, Text, Image, TouchableOpacity, ScrollView } from 'react-native'
import { Camera, X } from 'lucide-react-native'
import { PickedPhoto, choosePhotos } from '../lib/photos'

/**
 * Faixa de fotos com miniaturas e botão "adicionar" (câmera ou galeria).
 * Fotos são sempre opcionais; `max` vem da configuração do admin.
 */
export function PhotoStrip({
  photos,
  onChange,
  max,
  hint,
}: {
  photos: PickedPhoto[]
  onChange: (p: PickedPhoto[]) => void
  max: number
  hint?: string | null
}) {
  const room = Math.max(0, max - photos.length)
  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2.5">
        {photos.map((p, i) => (
          <View key={`${p.uri}-${i}`} className="w-20 h-20 rounded-xl overflow-hidden border border-slate2-200">
            <Image source={{ uri: p.remoteUrl ?? p.uri }} style={{ width: '100%', height: '100%' }} />
            <TouchableOpacity
              accessibilityLabel="Remover foto"
              onPress={() => onChange(photos.filter((_, j) => j !== i))}
              className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 items-center justify-center"
            >
              <X size={14} color="#fff" />
            </TouchableOpacity>
          </View>
        ))}
        {room > 0 && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Adicionar fotos"
            onPress={async () => {
              const picked = await choosePhotos(room)
              if (picked.length) onChange([...photos, ...picked].slice(0, max))
            }}
            className="w-20 h-20 rounded-xl border-2 border-dashed border-slate2-300 items-center justify-center bg-white"
          >
            <Camera size={20} color="#94A3B8" />
            <Text className="font-sans text-[11px] text-slate2-400 mt-1">Adicionar</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
      <Text className="font-sans text-xs text-slate2-500 mt-2">
        {photos.length}/{max} fotos{hint ? ` · Sugestão: ${hint}` : ''}
      </Text>
    </View>
  )
}
