'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { ArrowLeft, MapPin, Loader2 } from 'lucide-react'
import { api, getApiErrorMessage } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { useState } from 'react'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'

const schema = z.object({
  name: z.string().min(3, 'Nome muito curto'),
  phone: z.string().optional(),
  bio: z.string().max(500, 'Máximo 500 caracteres').optional(),
  role: z.enum(['CLIENT', 'PROVIDER', 'BOTH']),
})

type FormData = z.infer<typeof schema>

interface LocationState {
  latitude: number | null
  longitude: number | null
}

export default function EditarPerfilPage() {
  const { user, fetchMe } = useAuthStore()
  const router = useRouter()
  const [location, setLocation] = useState<LocationState>({
    latitude: user?.latitude ?? null,
    longitude: user?.longitude ?? null,
  })
  const [gettingLocation, setGettingLocation] = useState(false)

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    if (user) {
      reset({
        name: user.name,
        phone: user.phone || '',
        bio: user.bio || '',
        role: user.role === 'ADMIN' ? 'BOTH' : user.role,
      })
      setLocation({ latitude: user.latitude ?? null, longitude: user.longitude ?? null })
    }
  }, [user, reset])

  const captureLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocalização não suportada pelo navegador')
      return
    }
    setGettingLocation(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude })
        setGettingLocation(false)
        toast.success('Localização capturada!')
      },
      () => {
        setGettingLocation(false)
        toast.error('Não foi possível obter sua localização')
      },
      { timeout: 10000 }
    )
  }

  const onSubmit = async (data: FormData) => {
    try {
      await api.put('/users/me', { ...data, ...location })
      await fetchMe()
      toast.success('Perfil atualizado!')
      router.push('/perfil')
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-xl font-bold text-gray-900">Editar Perfil</h1>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Nome completo"
            error={errors.name?.message}
            {...register('name')}
          />

          <Input
            label="Telefone"
            type="tel"
            placeholder="(11) 99999-9999"
            error={errors.phone?.message}
            {...register('phone')}
          />

          <Textarea
            label="Bio"
            placeholder="Conte um pouco sobre você ou seus serviços..."
            error={errors.bio?.message}
            {...register('bio')}
          />

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Tipo de conta</label>
            <select
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              {...register('role')}
            >
              <option value="CLIENT">Cliente</option>
              <option value="PROVIDER">Prestador de serviço</option>
              <option value="BOTH">Cliente e Prestador</option>
            </select>
          </div>

          {/* Localização do prestador */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Sua localização (para raio de atendimento)</label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={captureLocation}
                disabled={gettingLocation}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                {gettingLocation ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4 text-brand-500" />}
                {location.latitude ? 'Atualizar localização' : 'Usar minha localização'}
              </button>
              {location.latitude != null && (
                <span className="text-xs text-green-600 font-medium">
                  ✓ {location.latitude.toFixed(4)}, {location.longitude?.toFixed(4)}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400">Necessário para o filtro de proximidade no feed de pedidos</p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" fullWidth isLoading={isSubmitting}>
              Salvar alterações
            </Button>
            <Button variant="outline" type="button" onClick={() => router.back()}>
              Cancelar
            </Button>
          </div>
        </form>
      </div>

      {/* Change password */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 mt-4">
        <h2 className="font-semibold text-gray-900 mb-4">Alterar senha</h2>
        <ChangePasswordForm />
      </div>
    </div>
  )
}

function ChangePasswordForm() {
  const pwSchema = z.object({
    currentPassword: z.string().min(1, 'Obrigatório'),
    newPassword: z.string().min(8, 'Mínimo 8 caracteres'),
    confirmNewPassword: z.string(),
  }).refine((d) => d.newPassword === d.confirmNewPassword, {
    message: 'Senhas não conferem',
    path: ['confirmNewPassword'],
  })

  type PwForm = z.infer<typeof pwSchema>

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<PwForm>({
    resolver: zodResolver(pwSchema),
  })

  const onSubmit = async (data: PwForm) => {
    try {
      await api.patch('/users/me/password', {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      })
      toast.success('Senha alterada com sucesso!')
      reset()
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <Input
        label="Senha atual"
        type="password"
        error={errors.currentPassword?.message}
        {...register('currentPassword')}
      />
      <Input
        label="Nova senha"
        type="password"
        error={errors.newPassword?.message}
        {...register('newPassword')}
      />
      <Input
        label="Confirmar nova senha"
        type="password"
        error={errors.confirmNewPassword?.message}
        {...register('confirmNewPassword')}
      />
      <Button type="submit" variant="secondary" isLoading={isSubmitting}>
        Alterar senha
      </Button>
    </form>
  )
}
