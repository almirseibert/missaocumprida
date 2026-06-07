'use client'

import { useRouter } from 'next/navigation'
import { Briefcase, ShoppingBag } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { useAuthStore } from '@/store/auth'

export default function ComecarPage() {
  const router = useRouter()
  const { user } = useAuthStore()

  const isProvider = user?.role === 'PROVIDER' || user?.role === 'BOTH'
  const isClient = user?.role === 'CLIENT' || user?.role === 'BOTH'

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Bem-vindo(a), {user?.name?.split(' ')[0]}!</h1>
      <p className="text-slate2-600 mb-8">Como você quer começar?</p>

      <div className="grid md:grid-cols-2 gap-4">
        {isClient && (
          <Card
            className="p-6 cursor-pointer hover:border-brand-500 hover:shadow-md transition"
            onClick={() => router.push('/comecar/cliente')}
          >
            <div className="w-12 h-12 rounded-full bg-brand-100 flex items-center justify-center mb-3">
              <ShoppingBag className="text-brand-600" size={24} />
            </div>
            <div className="font-bold text-lg mb-1">Contratar serviços</div>
            <div className="text-sm text-slate2-600">
              Tour rápido para você fazer seu primeiro pedido.
            </div>
          </Card>
        )}
        {isProvider && (
          <Card
            className="p-6 cursor-pointer hover:border-brand-500 hover:shadow-md transition"
            onClick={() => router.push('/comecar/prestador')}
          >
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mb-3">
              <Briefcase className="text-emerald-600" size={24} />
            </div>
            <div className="font-bold text-lg mb-1">Ganhar como prestador</div>
            <div className="text-sm text-slate2-600">
              6 passos rápidos até receber seu primeiro pedido.
            </div>
          </Card>
        )}
      </div>

      <button
        onClick={() => router.push('/home')}
        className="mt-6 text-sm text-slate2-500 hover:text-slate2-700"
      >
        Pular por enquanto
      </button>
    </div>
  )
}
