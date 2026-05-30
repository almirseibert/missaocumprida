'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Edit3, Plus, Trash2, Star, Camera } from 'lucide-react'
import { api, getApiErrorMessage } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { Category, ProviderSkill, Rating } from '@/types'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { StarRating } from '@/components/ui/StarRating'
import { PageSpinner } from '@/components/ui/Spinner'
import { formatRelative } from '@/lib/utils'

export default function PerfilPage() {
  const { user, fetchMe } = useAuthStore()
  const router = useRouter()

  const [skills, setSkills] = useState<ProviderSkill[]>([])
  const [ratings, setRatings] = useState<Rating[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [skillModal, setSkillModal] = useState(false)
  const [selectedCatId, setSelectedCatId] = useState('')
  const [yearsExp, setYearsExp] = useState('')
  const [hourlyRate, setHourlyRate] = useState('')
  const [radius, setRadius] = useState('')
  const [addingSkill, setAddingSkill] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  const canManageSkills = user?.role === 'PROVIDER' || user?.role === 'BOTH'

  useEffect(() => {
    if (!user) return

    api.get('/users/me/skills').then((r) => setSkills(r.data.data)).catch(() => {})
    api.get(`/users/${user.id}/ratings`, { params: { limit: 5 } }).then((r) => setRatings(r.data.data)).catch(() => {})

    if (canManageSkills) {
      api.get('/categories').then((r) => setCategories(r.data.data)).catch(() => {})
    }
  }, [user, canManageSkills])

  const addSkill = async () => {
    if (!selectedCatId) { toast.error('Selecione uma categoria'); return }
    setAddingSkill(true)
    try {
      const res = await api.post('/users/me/skills', {
        category_id: selectedCatId,
        years_experience: yearsExp ? parseInt(yearsExp) : undefined,
        hourly_rate: hourlyRate ? parseFloat(hourlyRate) : undefined,
        service_radius_km: radius ? parseInt(radius) : undefined,
      })
      setSkills((prev) => [...prev, res.data.data])
      setSkillModal(false)
      setSelectedCatId('')
      setYearsExp('')
      setHourlyRate('')
      setRadius('')
      toast.success('Habilidade adicionada!')
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setAddingSkill(false)
    }
  }

  const removeSkill = async (skillId: string) => {
    try {
      await api.delete(`/users/me/skills/${skillId}`)
      setSkills((prev) => prev.filter((s) => s.id !== skillId))
      toast.success('Habilidade removida.')
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    }
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingAvatar(true)
    const fd = new FormData()
    fd.append('avatar', file)
    try {
      await api.post('/users/me/avatar', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      await fetchMe()
      toast.success('Foto atualizada!')
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setUploadingAvatar(false)
    }
  }

  if (!user) return <PageSpinner />

  const roleLabel = { CLIENT: 'Cliente', PROVIDER: 'Prestador', BOTH: 'Cliente & Prestador', ADMIN: 'Admin' }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Profile header */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-start gap-4">
          <div className="relative">
            <Avatar name={user.name} avatar={user.avatar} size="xl" />
            <label className="absolute bottom-0 right-0 w-8 h-8 bg-brand-500 rounded-full flex items-center justify-center cursor-pointer hover:bg-brand-600 transition-colors">
              <Camera className="w-4 h-4 text-white" />
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </label>
          </div>

          <div className="flex-1">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h1 className="text-xl font-bold text-gray-900">{user.name}</h1>
                <p className="text-sm text-gray-500">{user.email}</p>
                {user.phone && <p className="text-sm text-gray-500">{user.phone}</p>}
              </div>
              <Link href="/perfil/editar">
                <Button variant="outline" size="sm">
                  <Edit3 className="w-4 h-4" /> Editar
                </Button>
              </Link>
            </div>

            <div className="flex items-center gap-3 mt-3 flex-wrap">
              <Badge>{roleLabel[user.role]}</Badge>
              {user.document_verified && <Badge variant="success">✓ Verificado</Badge>}
              {user.rating_count > 0 && (
                <div className="flex items-center gap-1 text-sm">
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  <span className="font-medium">{user.rating_avg.toFixed(1)}</span>
                  <span className="text-gray-400">({user.rating_count} avaliações)</span>
                </div>
              )}
            </div>

            {user.bio && <p className="mt-3 text-sm text-gray-600">{user.bio}</p>}
          </div>
        </div>
      </div>

      {/* Skills (provider only) */}
      {canManageSkills && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Minhas Habilidades</h2>
            <Button size="sm" onClick={() => setSkillModal(true)}>
              <Plus className="w-4 h-4" /> Adicionar
            </Button>
          </div>

          {skills.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">
              Nenhuma habilidade cadastrada. Adicione as categorias de serviço que você oferece.
            </p>
          ) : (
            <div className="space-y-3">
              {skills.map((skill) => (
                <div key={skill.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-200">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{skill.category?.icon}</span>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{skill.category?.name}</p>
                      <p className="text-xs text-gray-500">
                        {skill.years_experience && `${skill.years_experience} anos exp.`}
                        {skill.hourly_rate && ` · R$${skill.hourly_rate}/h`}
                        {skill.service_radius_km && ` · ${skill.service_radius_km}km de raio`}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => removeSkill(skill.id)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Ratings */}
      {ratings.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Avaliações recebidas</h2>
          <div className="space-y-4">
            {ratings.map((rating) => (
              <div key={rating.id} className="flex gap-3">
                <Avatar name={rating.reviewer?.name || 'U'} avatar={rating.reviewer?.avatar} size="sm" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm text-gray-900">{rating.reviewer?.name}</p>
                    <StarRating value={rating.score} readonly size="sm" />
                  </div>
                  {rating.comment && <p className="text-sm text-gray-600 mt-0.5">{rating.comment}</p>}
                  <p className="text-xs text-gray-400 mt-1">{formatRelative(rating.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add skill modal */}
      <Modal isOpen={skillModal} onClose={() => setSkillModal(false)} title="Adicionar habilidade">
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Categoria *</label>
            <select
              value={selectedCatId}
              onChange={(e) => setSelectedCatId(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Selecione uma categoria...</option>
              {categories.filter((c) => !skills.find((s) => s.category_id === c.id)).map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Anos exp.</label>
              <input
                type="number"
                min="0"
                placeholder="0"
                value={yearsExp}
                onChange={(e) => setYearsExp(e.target.value)}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">R$/hora</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Raio (km)</label>
              <input
                type="number"
                min="1"
                placeholder="50"
                value={radius}
                onChange={(e) => setRadius(e.target.value)}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <Button fullWidth onClick={addSkill} isLoading={addingSkill}>
              Adicionar
            </Button>
            <Button variant="outline" onClick={() => setSkillModal(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
