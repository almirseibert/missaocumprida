'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { Eye, EyeOff, UserCircle, Wrench } from 'lucide-react'
import { api, getApiErrorMessage } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { UserRole } from '@/types'

const schema = z.object({
  name: z.string().min(3, 'Nome muito curto'),
  email: z.string().email('E-mail inválido'),
  phone: z.string().optional(),
  password: z.string().min(8, 'Mínimo 8 caracteres').regex(/[A-Z]/, 'Precisa de ao menos uma maiúscula').regex(/[0-9]/, 'Precisa de ao menos um número'),
  confirmPassword: z.string(),
  role: z.enum(['CLIENT', 'PROVIDER', 'BOTH']),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Senhas não conferem',
  path: ['confirmPassword'],
})

type FormData = z.infer<typeof schema>

export default function RegisterPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setTokens, setUser } = useAuthStore()
  const [showPass, setShowPass] = useState(false)
  const defaultRole: UserRole = searchParams.get('tipo') === 'prestador' ? 'PROVIDER' : 'CLIENT'

  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { role: defaultRole },
  })

  const selectedRole = watch('role')

  const onSubmit = async (data: FormData) => {
    try {
      const { confirmPassword, ...payload } = data
      const res = await api.post('/auth/register', payload)
      const { user, accessToken, refreshToken } = res.data.data
      setTokens(accessToken, refreshToken)
      setUser(user)
      toast.success('Conta criada com sucesso!')
      router.replace('/home')
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    }
  }

  const roles = [
    { value: 'CLIENT', label: 'Quero contratar', desc: 'Preciso de serviços', icon: <UserCircle className="w-6 h-6" /> },
    { value: 'PROVIDER', label: 'Sou prestador', desc: 'Quero oferecer serviços', icon: <Wrench className="w-6 h-6" /> },
    { value: 'BOTH', label: 'Os dois', desc: 'Contratar e prestar', icon: <span className="text-xl">🔁</span> },
  ]

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <span className="text-3xl">✅</span>
            <span className="text-2xl font-bold text-gray-900">Missão Cumprida</span>
          </Link>
          <p className="mt-2 text-gray-600">Crie sua conta grátis</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Tipo de conta */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Tipo de conta</p>
              <div className="grid grid-cols-3 gap-2">
                {roles.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setValue('role', r.value as UserRole)}
                    className={cn(
                      'flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all text-center',
                      selectedRole === r.value
                        ? 'border-brand-500 bg-brand-50 text-brand-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    )}
                  >
                    {r.icon}
                    <span className="text-xs font-medium">{r.label}</span>
                    <span className="text-[10px] text-gray-500 hidden sm:block">{r.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <Input
              label="Nome completo"
              placeholder="João da Silva"
              error={errors.name?.message}
              autoComplete="name"
              {...register('name')}
            />

            <Input
              label="E-mail"
              type="email"
              placeholder="seu@email.com"
              error={errors.email?.message}
              autoComplete="email"
              {...register('email')}
            />

            <Input
              label="Telefone"
              type="tel"
              placeholder="(11) 99999-9999"
              error={errors.phone?.message}
              autoComplete="tel"
              {...register('phone')}
            />

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                Senha <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  placeholder="Mín. 8 caracteres"
                  autoComplete="new-password"
                  className={`block w-full rounded-lg border px-3 py-2 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent ${errors.password ? 'border-red-400' : 'border-gray-300'}`}
                  {...register('password')}
                />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-red-500">{errors.password.message}</p>}
            </div>

            <Input
              label="Confirmar senha"
              type="password"
              placeholder="Repita a senha"
              error={errors.confirmPassword?.message}
              autoComplete="new-password"
              {...register('confirmPassword')}
            />

            <Button type="submit" fullWidth isLoading={isSubmitting} size="lg">
              Criar conta
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-600">
            Já tem conta?{' '}
            <Link href="/login" className="font-medium text-brand-600 hover:text-brand-700">
              Entrar
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
