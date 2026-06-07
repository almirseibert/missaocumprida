'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { ShieldCheck, ChevronRight, LifeBuoy } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { PageSpinner } from '@/components/ui/Spinner'

export default function AdminHomePage() {
  const { user } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    if (user && user.role !== 'ADMIN') router.replace('/home')
  }, [user, router])

  if (!user) return <PageSpinner />
  if (user.role !== 'ADMIN') return null

  const cards = [
    {
      href: '/admin/verificacoes',
      title: 'Verificações de identidade',
      desc: 'Aprovar ou recusar documentos enviados por usuários',
      icon: ShieldCheck,
      color: 'brand',
    },
    {
      href: '/admin/suporte',
      title: 'Suporte ao usuário',
      desc: 'Receber, tratar e responder mensagens de clientes e prestadores',
      icon: LifeBuoy,
      color: 'brand',
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate2-900">Painel administrativo</h1>
        <p className="text-sm text-slate2-600 mt-1">Bem-vindo, {user.name.split(' ')[0]}.</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {cards.map((c) => {
          const Icon = c.icon
          return (
            <Link
              key={c.href}
              href={c.href}
              className="bg-white border border-slate2-200 rounded-2xl p-5 hover:border-brand-300 hover:shadow-sm transition-all flex items-start gap-3"
            >
              <div className="w-10 h-10 rounded-full bg-brand-50 flex items-center justify-center text-brand-600 flex-shrink-0">
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate2-900">{c.title}</h3>
                <p className="text-xs text-slate2-500 mt-0.5">{c.desc}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate2-400 mt-1.5" />
            </Link>
          )
        })}
      </div>
    </div>
  )
}
