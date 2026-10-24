import { useEffect } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { router } from 'expo-router'

// A assinatura Pro agora fica em Assinaturas (clientes e prestadores).
// Mantido para links e notificações antigos.
export default function VerificarProRedirect() {
  useEffect(() => { router.replace('/(app)/assinaturas' as any) }, [])
  return (
    <View className="flex-1 items-center justify-center bg-paper">
      <ActivityIndicator color="#059669" />
    </View>
  )
}
