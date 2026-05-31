import { Redirect } from 'expo-router'
import { useAuthStore } from '../src/store/auth'

export default function Index() {
  const { user } = useAuthStore()
  return <Redirect href={user ? '/(app)/home' : '/(auth)/login'} />
}
