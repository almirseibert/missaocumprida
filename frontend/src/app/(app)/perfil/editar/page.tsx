'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { ArrowLeft, MapPin, Loader2, User, MapPinned, PhoneCall, ShieldAlert } from 'lucide-react'
import { api, getApiErrorMessage } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'

const onlyDigits = (v?: string | null) => (v ?? '').replace(/\D/g, '')

const schema = z.object({
  name: z.string().min(3, 'Nome muito curto'),
  phone: z.string().optional().or(z.literal('')),
  bio: z.string().max(500, 'Máximo 500 caracteres').optional().or(z.literal('')),
  role: z.enum(['CLIENT', 'PROVIDER', 'BOTH']),
  cpf: z.string().optional().or(z.literal('')).refine(
    (v) => !v || onlyDigits(v).length === 11 || onlyDigits(v).length === 14,
    'CPF (11) ou CNPJ (14) inválido',
  ),
  rg: z.string().optional().or(z.literal('')),
  birth_date: z.string().optional().or(z.literal('')),
  mother_name: z.string().optional().or(z.literal('')),
  address_zip: z.string().optional().or(z.literal('')),
  address_street: z.string().optional().or(z.literal('')),
  address_number: z.string().optional().or(z.literal('')),
  address_complement: z.string().optional().or(z.literal('')),
  address_neighborhood: z.string().optional().or(z.literal('')),
  address_city: z.string().optional().or(z.literal('')),
  address_state: z.string().optional().or(z.literal('')),
  emergency_contact_name: z.string().optional().or(z.literal('')),
  emergency_contact_phone: z.string().optional().or(z.literal('')),
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
  const [cepLoading, setCepLoading] = useState(false)

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    if (user) {
      reset({
        name: user.name,
        phone: user.phone || '',
        bio: user.bio || '',
        role: user.role === 'ADMIN' ? 'BOTH' : user.role,
        cpf: user.cpf || '',
        rg: user.rg || '',
        birth_date: user.birth_date ? user.birth_date.slice(0, 10) : '',
        mother_name: user.mother_name || '',
        address_zip: user.address_zip || '',
        address_street: user.address_street || '',
        address_number: user.address_number || '',
        address_complement: user.address_complement || '',
        address_neighborhood: user.address_neighborhood || '',
        address_city: user.address_city || '',
        address_state: user.address_state || '',
        emergency_contact_name: user.emergency_contact_name || '',
        emergency_contact_phone: user.emergency_contact_phone || '',
      })
      setLocation({ latitude: user.latitude ?? null, longitude: user.longitude ?? null })
    }
  }, [user, reset])

  const captureLocation = () => {
    if (!navigator.geolocation) { toast.error('Geolocalização não suportada'); return }
    setGettingLocation(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude })
        setGettingLocation(false)
        toast.success('Localização capturada!')
      },
      () => { setGettingLocation(false); toast.error('Não foi possível obter localização') },
      { timeout: 10000 }
    )
  }

  // Consulta de CEP (ViaCEP)
  const zipVal = watch('address_zip')
  async function lookupCep() {
    const cep = onlyDigits(zipVal)
    if (cep.length !== 8) { toast.error('CEP deve ter 8 dígitos'); return }
    setCepLoading(true)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
      const data = await res.json()
      if (data.erro) { toast.error('CEP não encontrado'); return }
      setValue('address_street', data.logradouro || '')
      setValue('address_neighborhood', data.bairro || '')
      setValue('address_city', data.localidade || '')
      setValue('address_state', data.uf || '')
      toast.success('Endereço preenchido pelo CEP')
    } catch {
      toast.error('Falha ao consultar CEP')
    } finally {
      setCepLoading(false)
    }
  }

  const onSubmit = async (data: FormData) => {
    try {
      const payload: Record<string, unknown> = {
        name: data.name,
        phone: data.phone || undefined,
        bio: data.bio || undefined,
        role: data.role,
        cpf: data.cpf ? onlyDigits(data.cpf) : undefined,
        rg: data.rg || undefined,
        birth_date: data.birth_date ? new Date(data.birth_date + 'T00:00:00Z').toISOString() : undefined,
        mother_name: data.mother_name || undefined,
        address_zip: data.address_zip ? onlyDigits(data.address_zip) : undefined,
        address_street: data.address_street || undefined,
        address_number: data.address_number || undefined,
        address_complement: data.address_complement || undefined,
        address_neighborhood: data.address_neighborhood || undefined,
        address_city: data.address_city || undefined,
        address_state: data.address_state ? data.address_state.toUpperCase() : undefined,
        emergency_contact_name: data.emergency_contact_name || undefined,
        emergency_contact_phone: data.emergency_contact_phone || undefined,
        latitude: location.latitude,
        longitude: location.longitude,
      }
      await api.put('/users/me', payload)
      await fetchMe()
      toast.success('Perfil atualizado!')
      router.replace('/perfil')
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    }
  }

  if (!user) return null

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-slate2-100">
          <ArrowLeft className="w-5 h-5 text-slate2-600" />
        </button>
        <h1 className="text-xl font-bold text-slate2-900">Editar Perfil</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Dados básicos */}
        <Section icon={<User className="w-4 h-4" />} title="Dados básicos">
          <Input label="Nome completo *" {...register('name')} error={errors.name?.message} />
          <Input label="Telefone *" placeholder="(00) 00000-0000" {...register('phone')} error={errors.phone?.message} />
          <Input label="CPF / CNPJ *" placeholder="000.000.000-00" {...register('cpf')} error={errors.cpf?.message} />
          <div className="grid sm:grid-cols-2 gap-3">
            <Input label="RG / Identidade *" {...register('rg')} error={errors.rg?.message} />
            <Input label="Data de nascimento *" type="date" {...register('birth_date')} error={errors.birth_date?.message} />
          </div>
          <Input label="Nome da mãe *" {...register('mother_name')} error={errors.mother_name?.message} />
          <Textarea label="Bio" placeholder="Conte um pouco sobre você..." rows={3} {...register('bio')} error={errors.bio?.message} />
        </Section>

        {/* Endereço */}
        <Section icon={<MapPinned className="w-4 h-4" />} title="Endereço">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Input label="CEP *" placeholder="00000-000" {...register('address_zip')} error={errors.address_zip?.message} />
            </div>
            <Button type="button" variant="outline" size="md" onClick={lookupCep} disabled={cepLoading}>
              {cepLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Buscar CEP'}
            </Button>
          </div>
          <Input label="Logradouro *" {...register('address_street')} error={errors.address_street?.message} />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Input label="Número *" {...register('address_number')} error={errors.address_number?.message} />
            <Input label="Complemento" className="col-span-1 sm:col-span-2" {...register('address_complement')} error={errors.address_complement?.message} />
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <Input label="Bairro *" {...register('address_neighborhood')} error={errors.address_neighborhood?.message} />
            <Input label="Cidade *" {...register('address_city')} error={errors.address_city?.message} />
            <Input label="UF *" maxLength={2} placeholder="RS" {...register('address_state')} error={errors.address_state?.message} />
          </div>

          {/* GPS */}
          <div className="rounded-xl border border-slate2-200 p-3 bg-slate2-50">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="text-sm">
                <p className="font-medium text-slate2-800">Localização aproximada (GPS)</p>
                {location.latitude != null && location.longitude != null ? (
                  <p className="text-xs text-green-700 mt-0.5">
                    ✓ {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                  </p>
                ) : (
                  <p className="text-xs text-slate2-500 mt-0.5">Sem coordenadas — capture para receber pedidos por proximidade</p>
                )}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={captureLocation} disabled={gettingLocation}>
                {gettingLocation ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                {gettingLocation ? 'Capturando...' : 'Capturar GPS'}
              </Button>
            </div>
          </div>
        </Section>

        {/* Contato de emergência */}
        <Section icon={<PhoneCall className="w-4 h-4" />} title="Contato de emergência">
          <div className="grid sm:grid-cols-2 gap-3">
            <Input label="Nome do contato *" {...register('emergency_contact_name')} error={errors.emergency_contact_name?.message} />
            <Input label="Telefone do contato *" placeholder="(00) 00000-0000" {...register('emergency_contact_phone')} error={errors.emergency_contact_phone?.message} />
          </div>
        </Section>

        {/* Tipo de conta */}
        <Section icon={<ShieldAlert className="w-4 h-4" />} title="Tipo de conta">
          <div className="grid grid-cols-3 gap-2">
            {(['CLIENT', 'PROVIDER', 'BOTH'] as const).map((r) => {
              const isActive = watch('role') === r
              const label = r === 'CLIENT' ? 'Cliente' : r === 'PROVIDER' ? 'Prestador' : 'Os dois'
              return (
                <button
                  type="button"
                  key={r}
                  onClick={() => setValue('role', r)}
                  className={`p-3 rounded-xl border-2 text-sm font-medium transition-all ${isActive ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate2-200 text-slate2-600 hover:border-slate2-300'}`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </Section>

        <p className="text-xs text-slate2-500">
          * Campos obrigatórios para cadastro completo. Os dados aqui informados podem ser
          utilizados para consultas de antecedentes e verificações conforme nossos termos.
        </p>

        <div className="flex gap-3">
          <Button type="submit" isLoading={isSubmitting}>Salvar</Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancelar</Button>
        </div>
      </form>
    </div>
  )
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate2-200 p-5 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-brand-500">{icon}</span>
        <h2 className="font-semibold text-slate2-900 text-sm uppercase tracking-wide">{title}</h2>
      </div>
      {children}
    </div>
  )
}
