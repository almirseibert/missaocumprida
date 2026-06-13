'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, ListChecks, FolderTree, ChevronDown, ChevronRight } from 'lucide-react'
import { api, getApiErrorMessage } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { PageSpinner } from '@/components/ui/Spinner'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'

type Group = { id: string; name: string; slug: string; icon: string; description?: string | null; order: number; is_active: boolean; _count?: { categories: number } }
type Category = {
  id: string; group_id: string; name: string; slug: string; icon: string; description?: string | null
  base_price_min: number; base_price_max: number; requires_photos: boolean; estimated_hours?: number | null
  is_active: boolean; order: number; archetype?: string | null; pricing_unit?: string | null
  _count?: { questionnaire_fields: number; orders: number }
}
type Field = {
  id: string; category_id: string; question: string; field_type: string; options?: string[] | null
  placeholder?: string | null; is_required: boolean; order: number; affects_price: boolean
  key?: string | null; help_text?: string | null
}

const FIELD_TYPES = [
  { v: 'TEXT', l: 'Texto curto' }, { v: 'TEXTAREA', l: 'Texto longo' },
  { v: 'SELECT', l: 'Lista (selecionar)' }, { v: 'RADIO', l: 'Opções (radio)' },
  { v: 'BOOLEAN', l: 'Sim/Não' }, { v: 'PHOTO', l: 'Foto' },
  { v: 'NUMBER', l: 'Número' }, { v: 'DATE', l: 'Data' },
]

export default function AdminCategoriasPage() {
  const { user } = useAuthStore()
  const router = useRouter()
  const [groups, setGroups] = useState<Group[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const [groupModal, setGroupModal] = useState<{ open: boolean; edit?: Group } | null>(null)
  const [catModal, setCatModal] = useState<{ open: boolean; groupId: string; edit?: Category } | null>(null)
  const [fieldsFor, setFieldsFor] = useState<Category | null>(null)

  useEffect(() => { if (user && user.role !== 'ADMIN') router.replace('/home') }, [user, router])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [g, c] = await Promise.all([
        api.get('/categories/admin/groups'),
        api.get('/categories/admin/categories'),
      ])
      setGroups(g.data.data)
      setCategories(c.data.data)
    } catch (e) { toast.error(getApiErrorMessage(e)) } finally { setLoading(false) }
  }, [])

  useEffect(() => { if (user?.role === 'ADMIN') load() }, [user, load])

  if (!user) return <PageSpinner />
  if (user.role !== 'ADMIN') return null

  const delGroup = async (g: Group) => {
    if (!confirm(`Excluir o grupo "${g.name}"?`)) return
    try { await api.delete(`/categories/admin/groups/${g.id}`); toast.success('Grupo excluído'); load() }
    catch (e) { toast.error(getApiErrorMessage(e)) }
  }
  const delCat = async (c: Category) => {
    if (!confirm(`Excluir a categoria "${c.name}"?`)) return
    try { await api.delete(`/categories/admin/categories/${c.id}`); toast.success('Categoria excluída'); load() }
    catch (e) { toast.error(getApiErrorMessage(e)) }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate2-900">Categorias & Questionários</h1>
          <p className="text-sm text-slate2-600 mt-1">Grupos, serviços e perguntas de cada serviço.</p>
        </div>
        <Button size="sm" onClick={() => setGroupModal({ open: true })}><Plus className="w-4 h-4 mr-1" /> Novo grupo</Button>
      </div>

      {loading ? (
        <div className="py-16"><PageSpinner /></div>
      ) : groups.length === 0 ? (
        <p className="text-sm text-slate2-400 py-8 text-center">Nenhum grupo cadastrado.</p>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => {
            const cats = categories.filter((c) => c.group_id === g.id)
            const open = expanded[g.id] ?? true
            return (
              <div key={g.id} className="bg-white border border-slate2-200 rounded-2xl overflow-hidden">
                <div className="flex items-center gap-3 p-4">
                  <button onClick={() => setExpanded((s) => ({ ...s, [g.id]: !open }))} className="text-slate2-400">
                    {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                  <FolderTree className="w-5 h-5 text-brand-600" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate2-900">{g.icon} {g.name} {!g.is_active && <span className="text-[11px] text-slate2-400">(inativo)</span>}</p>
                    <p className="text-xs text-slate2-500">{cats.length} categoria(s)</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setCatModal({ open: true, groupId: g.id })}><Plus className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => setGroupModal({ open: true, edit: g })}><Pencil className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => delGroup(g)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                </div>

                {open && (
                  <div className="border-t border-slate2-100 divide-y divide-slate2-100">
                    {cats.length === 0 ? (
                      <p className="text-xs text-slate2-400 p-4">Sem categorias. Use o + para adicionar.</p>
                    ) : cats.map((c) => (
                      <div key={c.id} className="flex items-center gap-3 px-4 py-3 pl-12">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate2-800">{c.icon} {c.name} {!c.is_active && <span className="text-[11px] text-slate2-400">(inativo)</span>}</p>
                          <p className="text-[11px] text-slate2-400">
                            R$ {c.base_price_min}–{c.base_price_max} · {c._count?.questionnaire_fields ?? 0} perguntas · {c._count?.orders ?? 0} pedidos
                          </p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => setFieldsFor(c)}><ListChecks className="w-4 h-4 mr-1" /> Perguntas</Button>
                        <Button variant="ghost" size="sm" onClick={() => setCatModal({ open: true, groupId: g.id, edit: c })}><Pencil className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => delCat(c)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {groupModal?.open && (
        <GroupModal group={groupModal.edit} onClose={() => setGroupModal(null)} onSaved={() => { setGroupModal(null); load() }} />
      )}
      {catModal?.open && (
        <CategoryModal groupId={catModal.groupId} category={catModal.edit} onClose={() => setCatModal(null)} onSaved={() => { setCatModal(null); load() }} />
      )}
      {fieldsFor && (
        <FieldsModal category={fieldsFor} onClose={() => { setFieldsFor(null); load() }} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
function GroupModal({ group, onClose, onSaved }: { group?: Group; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(group?.name ?? '')
  const [icon, setIcon] = useState(group?.icon ?? '📁')
  const [description, setDescription] = useState(group?.description ?? '')
  const [isActive, setIsActive] = useState(group?.is_active ?? true)
  const [busy, setBusy] = useState(false)

  const save = async () => {
    if (!name.trim()) return toast.error('Informe o nome')
    setBusy(true)
    try {
      const body = { name, icon, description: description || null, is_active: isActive }
      if (group) await api.put(`/categories/admin/groups/${group.id}`, body)
      else await api.post('/categories/admin/groups', body)
      toast.success('Salvo'); onSaved()
    } catch (e) { toast.error(getApiErrorMessage(e)) } finally { setBusy(false) }
  }

  return (
    <Modal isOpen onClose={onClose} title={group ? 'Editar grupo' : 'Novo grupo'}>
      <div className="space-y-3">
        <Input label="Nome" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input label="Ícone (emoji)" value={icon} onChange={(e) => setIcon(e.target.value)} />
        <Textarea label="Descrição" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        <label className="flex items-center gap-2 text-sm text-slate2-700">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> Ativo
        </label>
        <Button fullWidth isLoading={busy} onClick={save}>Salvar</Button>
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
function CategoryModal({ groupId, category, onClose, onSaved }: { groupId: string; category?: Category; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    name: category?.name ?? '', icon: category?.icon ?? '🔧',
    description: category?.description ?? '',
    base_price_min: category?.base_price_min ?? 50, base_price_max: category?.base_price_max ?? 200,
    requires_photos: category?.requires_photos ?? true, is_active: category?.is_active ?? true,
    pricing_unit: category?.pricing_unit ?? '',
  })
  const [busy, setBusy] = useState(false)
  const set = (k: string, v: any) => setF((s) => ({ ...s, [k]: v }))

  const save = async () => {
    if (!f.name.trim()) return toast.error('Informe o nome')
    setBusy(true)
    try {
      const body = {
        group_id: groupId, name: f.name, icon: f.icon, description: f.description || null,
        base_price_min: Number(f.base_price_min), base_price_max: Number(f.base_price_max),
        requires_photos: f.requires_photos, is_active: f.is_active, pricing_unit: f.pricing_unit || null,
      }
      if (category) await api.put(`/categories/admin/categories/${category.id}`, body)
      else await api.post('/categories/admin/categories', body)
      toast.success('Salvo'); onSaved()
    } catch (e) { toast.error(getApiErrorMessage(e)) } finally { setBusy(false) }
  }

  return (
    <Modal isOpen onClose={onClose} title={category ? 'Editar categoria' : 'Nova categoria'}>
      <div className="space-y-3">
        <Input label="Nome do serviço" value={f.name} onChange={(e) => set('name', e.target.value)} required />
        <Input label="Ícone (emoji)" value={f.icon} onChange={(e) => set('icon', e.target.value)} />
        <Textarea label="Descrição" value={f.description} onChange={(e) => set('description', e.target.value)} rows={2} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Preço mín. (R$)" type="number" value={f.base_price_min} onChange={(e) => set('base_price_min', e.target.value)} />
          <Input label="Preço máx. (R$)" type="number" value={f.base_price_max} onChange={(e) => set('base_price_max', e.target.value)} />
        </div>
        <Input label="Unidade de preço (ex: m², hora)" value={f.pricing_unit} onChange={(e) => set('pricing_unit', e.target.value)} />
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm text-slate2-700">
            <input type="checkbox" checked={f.requires_photos} onChange={(e) => set('requires_photos', e.target.checked)} /> Exige fotos
          </label>
          <label className="flex items-center gap-2 text-sm text-slate2-700">
            <input type="checkbox" checked={f.is_active} onChange={(e) => set('is_active', e.target.checked)} /> Ativo
          </label>
        </div>
        <Button fullWidth isLoading={busy} onClick={save}>Salvar</Button>
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
function FieldsModal({ category, onClose }: { category: Category; onClose: () => void }) {
  const [fields, setFields] = useState<Field[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Field | 'new' | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get(`/categories/admin/categories/${category.id}/fields`)
      setFields(res.data.data)
    } catch (e) { toast.error(getApiErrorMessage(e)) } finally { setLoading(false) }
  }, [category.id])

  useEffect(() => { load() }, [load])

  const del = async (fld: Field) => {
    if (!confirm('Remover esta pergunta?')) return
    try { await api.delete(`/categories/admin/fields/${fld.id}`); toast.success('Removida'); load() }
    catch (e) { toast.error(getApiErrorMessage(e)) }
  }

  return (
    <Modal isOpen onClose={onClose} title={`Perguntas — ${category.name}`} size="lg">
      <div className="space-y-3 max-h-[70vh] overflow-y-auto">
        {loading ? <PageSpinner /> : (
          <>
            {fields.length === 0 && <p className="text-sm text-slate2-400">Nenhuma pergunta ainda.</p>}
            {fields.map((fld) => (
              <div key={fld.id} className="flex items-start gap-3 border border-slate2-200 rounded-xl p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate2-800">{fld.question}</p>
                  <p className="text-[11px] text-slate2-400">
                    {FIELD_TYPES.find((t) => t.v === fld.field_type)?.l ?? fld.field_type}
                    {fld.is_required ? ' · obrigatória' : ''}{fld.affects_price ? ' · afeta preço' : ''}
                    {fld.options?.length ? ` · ${fld.options.length} opções` : ''}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setEditing(fld)}><Pencil className="w-4 h-4" /></Button>
                <Button variant="ghost" size="sm" onClick={() => del(fld)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
              </div>
            ))}
            {editing ? (
              <FieldForm
                categoryId={category.id}
                field={editing === 'new' ? undefined : editing}
                onCancel={() => setEditing(null)}
                onSaved={() => { setEditing(null); load() }}
              />
            ) : (
              <Button variant="outline" size="sm" onClick={() => setEditing('new')}><Plus className="w-4 h-4 mr-1" /> Adicionar pergunta</Button>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
function FieldForm({ categoryId, field, onCancel, onSaved }: { categoryId: string; field?: Field; onCancel: () => void; onSaved: () => void }) {
  const [question, setQuestion] = useState(field?.question ?? '')
  const [fieldType, setFieldType] = useState(field?.field_type ?? 'TEXT')
  const [isRequired, setIsRequired] = useState(field?.is_required ?? true)
  const [affectsPrice, setAffectsPrice] = useState(field?.affects_price ?? false)
  const [optionsText, setOptionsText] = useState((field?.options ?? []).join('\n'))
  const [helpText, setHelpText] = useState(field?.help_text ?? '')
  const [busy, setBusy] = useState(false)
  const needsOptions = fieldType === 'SELECT' || fieldType === 'RADIO'

  const save = async () => {
    if (!question.trim()) return toast.error('Informe a pergunta')
    const options = needsOptions ? optionsText.split('\n').map((s) => s.trim()).filter(Boolean) : null
    if (needsOptions && (!options || options.length < 2)) return toast.error('Liste ao menos 2 opções (uma por linha)')
    setBusy(true)
    try {
      const body = { question, field_type: fieldType, is_required: isRequired, affects_price: affectsPrice, options, help_text: helpText || null }
      if (field) await api.put(`/categories/admin/fields/${field.id}`, body)
      else await api.post(`/categories/admin/categories/${categoryId}/fields`, body)
      toast.success('Salvo'); onSaved()
    } catch (e) { toast.error(getApiErrorMessage(e)) } finally { setBusy(false) }
  }

  return (
    <div className="border border-brand-200 bg-brand-50/40 rounded-xl p-3 space-y-3">
      <Textarea label="Pergunta" value={question} onChange={(e) => setQuestion(e.target.value)} rows={2} required />
      <div>
        <label className="text-sm font-medium text-slate2-700">Tipo de resposta</label>
        <select value={fieldType} onChange={(e) => setFieldType(e.target.value)}
          className="mt-1 block w-full rounded-lg border-[1.5px] border-slate2-300 px-3 py-2.5 text-sm text-slate2-900 focus:border-brand-500 focus:outline-none">
          {FIELD_TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
        </select>
      </div>
      {needsOptions && (
        <Textarea label="Opções (uma por linha)" value={optionsText} onChange={(e) => setOptionsText(e.target.value)} rows={3} />
      )}
      <Textarea label="Texto de ajuda (opcional)" value={helpText} onChange={(e) => setHelpText(e.target.value)} rows={1} />
      <div className="flex gap-4">
        <label className="flex items-center gap-2 text-sm text-slate2-700">
          <input type="checkbox" checked={isRequired} onChange={(e) => setIsRequired(e.target.checked)} /> Obrigatória
        </label>
        <label className="flex items-center gap-2 text-sm text-slate2-700">
          <input type="checkbox" checked={affectsPrice} onChange={(e) => setAffectsPrice(e.target.checked)} /> Afeta preço
        </label>
      </div>
      <div className="flex gap-2">
        <Button size="sm" isLoading={busy} onClick={save}>Salvar</Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancelar</Button>
      </div>
    </div>
  )
}
