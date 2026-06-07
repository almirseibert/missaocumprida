'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  User as UserIcon, MapPin, Briefcase, ShieldCheck, Wallet,
  ArrowRight, ArrowLeft, Check,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { useAuthStore } from '@/store/auth'
import { api, getApiErrorMessage } from '@/lib/api'
import type { ServiceGroup, Category } from '@/types'

const TOTAL_STEPS = 6

export default function OnboardingProviderPage() {
  const router = useRouter()
  const { user, setUser } = useAuthStore()
  const [step, setStep] = useState<number>(
    (user?.onboarding_state?.provider?.step as number) ?? 0
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // 1 - perfil
  const [name, setName] = useState(user?.name ?? '')
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [bio, setBio] = useState(user?.bio ?? '')
  // 2 - localização (auto)
  // 3 - skills
  const [groups, setGroups] = useState<ServiceGroup[]>([])
  const [categoryId, setCategoryId] = useState('')
  const [years, setYears] = useState('1')
  const [radius, setRadius] = useState('20')
  // 4 - cpf
  const [cpf, setCpf] = useState(user?.cpf ?? '')
  // 5 - pix
  const [pixKey, setPixKey] = useState(user?.pix_key ?? '')
  const [pixKeyType, setPixKeyType] = useState(user?.pix_key_type ?? 'CPF')

  useEffect(() => {
    if (step === 3 && groups.length === 0) {
      api.get('/categories/groups').then(r => setGroups(r.data.data ?? [])).catch(() => {})
    }
  }, [step, groups.length])

  const allCategories: Category[] = groups.flatMap(g => g.categories ?? [])

  async function patchState(next: number, completed = false, data?: Record<string, unknown>) {
    await api.put('/users/me/onboarding', { flow: 'provider', step: next, completed, data })
    const r = await api.get('/users/me')
    setUser(r.data.data)
  }

  async function handleSkip() {
    setLoading(true)
    try { await patchState(step, true, { skipped: true }) } catch { /* segue para o feed mesmo assim */ }
    setLoading(false)
    router.replace('/feed')
  }

  async function go(nextStep: number, completed = false, work?: () => Promise<void>) {
    setLoading(true); setError(''); setSuccess('')
    try {
      if (work) await work()
      await patchState(nextStep, completed)
      if (completed) router.replace('/feed')
      else setStep(nextStep)
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  async function saveProfile() {
    await api.put('/users/me', { name, phone, bio })
  }

  async function saveLocation() {
    return new Promise<void>((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error('Geolocalização indisponível'))
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            await api.put('/users/me', { latitude: pos.coords.latitude, longitude: pos.coords.longitude })
            resolve()
          } catch (err) { reject(err) }
        },
        () => reject(new Error('Permissão de localização negada')),
      )
    })
  }

  async function addSkill() {
    if (!categoryId) throw new Error('Escolha uma categoria')
    await api.post('/users/me/skills', {
      category_id: categoryId,
      years_experience: Number(years) || 0,
      service_radius_km: Number(radius) || 20,
    })
  }

  async function saveCpf() {
    if (cpf) await api.put('/users/me', { cpf })
  }

  async function savePix() {
    if (pixKey) await api.put('/payments/pix-key', { pix_key: pixKey, pix_key_type: pixKeyType })
  }

  return (
    <div>
      <Progress current={step + 1} total={TOTAL_STEPS} />

      {step === 0 && (
        <StepShell
          icon={<Briefcase className="text-emerald-600" size={28} />}
          title="Vamos te preparar para ganhar"
          subtitle="6 passos rápidos. Depois você cai direto no seu feed de pedidos."
        >
          <ul className="text-sm text-slate2-700 space-y-2 mb-6 list-disc pl-5">
            <li>Perfil + foto e bio (clientes confiam mais)</li>
            <li>Localização para receber pedidos perto</li>
            <li>Categorias que você atende</li>
            <li>CPF para o PIX e chave para receber</li>
          </ul>
          <Button onClick={() => go(1)} isLoading={loading} className="w-full">
            Começar <ArrowRight size={16} className="ml-1" />
          </Button>
        </StepShell>
      )}

      {step === 1 && (
        <StepShell
          icon={<UserIcon className="text-brand-600" size={28} />}
          title="Seu perfil"
          subtitle="Mostre quem você é."
        >
          <div className="space-y-3 mb-4">
            <Input label="Nome completo" value={name} onChange={(e) => setName(e.target.value)} />
            <Input label="Telefone (WhatsApp)" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Textarea label="Bio" placeholder="Conte um pouco sobre seu trabalho..." value={bio} onChange={(e) => setBio(e.target.value)} />
          </div>
          <Nav onBack={() => setStep(0)} onNext={() => go(2, false, saveProfile)} loading={loading} />
        </StepShell>
      )}

      {step === 2 && (
        <StepShell
          icon={<MapPin className="text-brand-600" size={28} />}
          title="Sua localização"
          subtitle="Para recebermos pedidos perto de você."
        >
          <p className="text-sm text-slate2-600 mb-4">
            Vamos usar sua localização atual para definir o ponto base de atendimento.
          </p>
          <Nav
            onBack={() => setStep(1)}
            onNext={() => go(3, false, saveLocation)}
            nextLabel="Usar minha localização"
            loading={loading}
          />
          <button onClick={() => go(3)} disabled={loading} className="mt-3 text-sm text-slate2-500">
            Pular por enquanto
          </button>
        </StepShell>
      )}

      {step === 3 && (
        <StepShell
          icon={<Briefcase className="text-emerald-600" size={28} />}
          title="Suas habilidades"
          subtitle="Adicione pelo menos uma categoria."
        >
          <div className="space-y-3 mb-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate2-700">Categoria</span>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="rounded-lg border border-slate2-300 px-3 py-2 text-sm"
              >
                <option value="">Selecione...</option>
                {groups.map((g) => (
                  <optgroup key={g.id} label={g.name}>
                    {(g.categories ?? []).map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Anos de experiência" type="number" value={years} onChange={(e) => setYears(e.target.value)} />
              <Input label="Raio (km)" type="number" value={radius} onChange={(e) => setRadius(e.target.value)} />
            </div>
            <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-2.5">
              💡 Quanto maior o raio que você informa, mais propostas de trabalho você recebe.
              Pedidos fora do seu raio não aparecem no seu feed.
            </p>
            {allCategories.length === 0 && (
              <div className="text-xs text-slate2-500">Carregando categorias...</div>
            )}
          </div>
          <Nav
            onBack={() => setStep(2)}
            onNext={() => go(4, false, addSkill)}
            nextLabel="Adicionar e continuar"
            loading={loading}
          />
        </StepShell>
      )}

      {step === 4 && (
        <StepShell
          icon={<ShieldCheck className="text-brand-600" size={28} />}
          title="Verificação básica"
          subtitle="CPF é obrigatório para PIX."
        >
          <Input
            label="CPF"
            value={cpf}
            onChange={(e) => setCpf(e.target.value)}
            placeholder="000.000.000-00"
          />
          <div className="text-xs text-slate2-500 mt-2 mb-4">
            Você pode enviar foto do RG depois em Perfil → Verificação.
          </div>
          <Nav onBack={() => setStep(3)} onNext={() => go(5, false, saveCpf)} loading={loading} />
        </StepShell>
      )}

      {step === 5 && (
        <StepShell
          icon={<Wallet className="text-emerald-600" size={28} />}
          title="Chave PIX"
          subtitle="Onde vamos depositar seus ganhos."
        >
          <div className="space-y-3 mb-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate2-700">Tipo da chave</span>
              <select
                value={pixKeyType ?? 'CPF'}
                onChange={(e) => setPixKeyType(e.target.value as typeof pixKeyType)}
                className="rounded-lg border border-slate2-300 px-3 py-2 text-sm"
              >
                <option value="CPF">CPF</option>
                <option value="CNPJ">CNPJ</option>
                <option value="EMAIL">E-mail</option>
                <option value="PHONE">Telefone</option>
                <option value="RANDOM">Chave aleatória</option>
              </select>
            </label>
            <Input label="Chave PIX" value={pixKey ?? ''} onChange={(e) => setPixKey(e.target.value)} />
          </div>
          <Nav
            onBack={() => setStep(4)}
            onNext={() => go(TOTAL_STEPS, true, savePix)}
            nextLabel="Concluir"
            loading={loading}
          />
        </StepShell>
      )}

      {error && <div className="mt-4 text-sm text-red-600">{error}</div>}
      {success && <div className="mt-4 text-sm text-emerald-700">{success}</div>}

      <button
        onClick={handleSkip}
        disabled={loading}
        className="mt-6 text-sm text-slate2-500 hover:text-slate2-700 disabled:opacity-50"
      >
        Pular por enquanto
      </button>
    </div>
  )
}

function Progress({ current, total }: { current: number; total: number }) {
  const pct = Math.min(100, Math.round((current / total) * 100))
  return (
    <div className="mb-6">
      <div className="flex justify-between text-xs text-slate2-500 mb-2">
        <span>Passo {Math.min(current, total)} de {total}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 bg-slate2-100 rounded-full overflow-hidden">
        <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function StepShell({
  title, subtitle, icon, children,
}: {
  title: string; subtitle: string; icon: React.ReactNode; children: React.ReactNode
}) {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-12 h-12 rounded-full bg-slate2-50 flex items-center justify-center">{icon}</div>
        <div>
          <div className="text-xl font-bold">{title}</div>
          <div className="text-sm text-slate2-600">{subtitle}</div>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </Card>
  )
}

function Nav({
  onBack, onNext, nextLabel = 'Continuar', loading,
}: {
  onBack: () => void; onNext: () => void; nextLabel?: string; loading?: boolean
}) {
  return (
    <div className="flex gap-2">
      <Button variant="outline" onClick={onBack} disabled={loading}>
        <ArrowLeft size={16} className="mr-1" /> Voltar
      </Button>
      <Button onClick={onNext} isLoading={loading} className="flex-1">
        {nextLabel}
      </Button>
    </div>
  )
}
