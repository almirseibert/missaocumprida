'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Package, Plus, Edit2, Trash2, ArrowLeft, X } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Modal } from '@/components/ui/Modal'
import { PageSpinner } from '@/components/ui/Spinner'
import { api, getApiErrorMessage } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { ServicePackage, ProviderSkill } from '@/types'
import { useAuthStore } from '@/store/auth'
import toast from 'react-hot-toast'

type FormState = {
  id?: string
  category_id: string
  title: string
  description: string
  price: string
  duration_min: string
  includes: string
  is_active: boolean
}

const emptyForm: FormState = {
  category_id: '',
  title: '',
  description: '',
  price: '',
  duration_min: '60',
  includes: '',
  is_active: true,
}

export default function MeusPacotesPage() {
  const router = useRouter()
  const { user } = useAuthStore()
  const [packages, setPackages] = useState<ServicePackage[]>([])
  const [skills, setSkills] = useState<ProviderSkill[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user) return
    Promise.all([
      api.get(`/users/${user.id}/packages`),
      api.get('/users/me/skills'),
    ])
      .then(([p, s]) => {
        setPackages(p.data.data)
        setSkills(s.data.data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user])

  function openNew() {
    setForm({ ...emptyForm, category_id: skills[0]?.category_id ?? '' })
    setModalOpen(true)
  }
  function openEdit(p: ServicePackage) {
    setForm({
      id: p.id,
      category_id: p.category.id,
      title: p.title,
      description: p.description,
      price: String(p.price),
      duration_min: String(p.duration_min),
      includes: p.includes.join('\n'),
      is_active: p.is_active,
    })
    setModalOpen(true)
  }

  async function save() {
    if (!form.title || !form.description || !form.price) {
      toast.error('Preencha título, descrição e preço.'); return
    }
    setSaving(true)
    try {
      const payload = {
        category_id: form.category_id,
        title: form.title,
        description: form.description,
        price: Number(form.price),
        duration_min: parseInt(form.duration_min) || 60,
        includes: form.includes.split('\n').map((s) => s.trim()).filter(Boolean),
        is_active: form.is_active,
      }
      const r = form.id
        ? await api.patch(`/packages/${form.id}`, payload)
        : await api.post('/packages', payload)
      const updated = r.data.data
      setPackages((prev) =>
        form.id ? prev.map((p) => (p.id === updated.id ? updated : p)) : [updated, ...prev]
      )
      setModalOpen(false)
      toast.success(form.id ? 'Pacote atualizado' : 'Pacote criado')
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  async function remove(p: ServicePackage) {
    if (!confirm(`Excluir o pacote "${p.title}"?`)) return
    try {
      await api.delete(`/packages/${p.id}`)
      setPackages((prev) => prev.filter((x) => x.id !== p.id))
      toast.success('Pacote removido')
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    }
  }

  if (loading) return <PageSpinner />

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={() => router.back()} className="text-sm text-slate2-600 hover:text-slate2-900 mb-4 flex items-center gap-1.5">
        <ArrowLeft size={16} /> Voltar
      </button>

      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Package size={22} className="text-emerald-600" /> Meus Pacotes
        </h1>
        <Button onClick={openNew} disabled={skills.length === 0}>
          <Plus size={16} className="mr-1" /> Novo
        </Button>
      </div>
      <p className="text-sm text-slate2-600 mb-6">
        Crie ofertas pré-precificadas que clientes podem contratar em 1 clique.
      </p>

      {skills.length === 0 && (
        <Card className="p-5 bg-amber-50 border-amber-200 mb-4">
          <div className="text-sm text-amber-800">
            Cadastre ao menos uma <strong>habilidade</strong> em Perfil antes de criar pacotes.
          </div>
        </Card>
      )}

      {packages.length === 0 ? (
        <Card className="p-8 text-center">
          <Package size={32} className="text-slate2-300 mx-auto mb-2" />
          <div className="font-semibold">Nenhum pacote ainda</div>
          <div className="text-sm text-slate2-500 mt-1">Crie um para clientes contratarem direto, sem proposta.</div>
        </Card>
      ) : (
        <div className="space-y-3">
          {packages.map((p) => (
            <Card key={p.id} className="p-4 flex gap-3 items-start">
              <div className="text-2xl">{p.category.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold truncate">{p.title}</h3>
                  {!p.is_active && <span className="text-[10px] bg-slate2-200 text-slate2-700 px-1.5 py-0.5 rounded-full">Inativo</span>}
                </div>
                <div className="text-xs text-slate2-500">{p.category.name} · {p.duration_min} min · {p.purchases_count} contratações</div>
                <p className="text-sm text-slate2-600 mt-1 line-clamp-2">{p.description}</p>
              </div>
              <div className="text-right">
                <div className="font-bold text-emerald-700">{formatCurrency(p.price)}</div>
                <div className="flex gap-1 mt-2">
                  <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg hover:bg-slate2-100" title="Editar">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => remove(p)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-600" title="Excluir">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {modalOpen && (
        <Modal isOpen={modalOpen} title={form.id ? 'Editar pacote' : 'Novo pacote'} onClose={() => setModalOpen(false)} size="lg">
          <div className="space-y-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate2-700">Categoria</span>
              <select
                value={form.category_id}
                onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                className="rounded-lg border border-slate2-300 px-3 py-2 text-sm"
              >
                {skills.map((s) => (
                  <option key={s.id} value={s.category_id}>{s.category?.name ?? s.category_id}</option>
                ))}
              </select>
            </label>
            <Input label="Título" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder='Ex: "Limpeza pesada apartamento 2 quartos"' />
            <Textarea label="Descrição" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="O que está incluso, condições, prazo, materiais..." />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Preço (R$)" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
              <Input label="Duração (min)" type="number" value={form.duration_min} onChange={(e) => setForm({ ...form, duration_min: e.target.value })} />
            </div>
            <Textarea
              label="Itens inclusos (1 por linha)"
              value={form.includes}
              onChange={(e) => setForm({ ...form, includes: e.target.value })}
              placeholder={'Inclui produtos de limpeza\nLimpeza de janelas externas\nGarantia de 30 dias'}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                className="w-4 h-4 accent-emerald-600"
              />
              Pacote ativo (visível para clientes)
            </label>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>Cancelar</Button>
              <Button onClick={save} isLoading={saving} className="flex-1">{form.id ? 'Salvar' : 'Criar pacote'}</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
