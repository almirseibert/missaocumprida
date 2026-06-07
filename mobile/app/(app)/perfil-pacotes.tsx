import { useCallback, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  Alert, TextInput, Modal,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useFocusEffect } from 'expo-router'
import { ArrowLeft, Plus, Edit2, Trash2, Package, X } from 'lucide-react-native'
import { api, getApiError } from '../../src/lib/api'
import { ServicePackage } from '../../src/types'
import { formatCurrency } from '../../src/lib/utils'

type Category = { id: string; name: string; slug: string; icon: string }

export default function MeusPacotesScreen() {
  const [items, setItems] = useState<ServicePackage[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ServicePackage | null>(null)
  const [saving, setSaving] = useState(false)

  // form
  const [categoryId, setCategoryId] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [durationMin, setDurationMin] = useState('60')
  const [includesText, setIncludesText] = useState('')
  const [isActive, setIsActive] = useState(true)

  useFocusEffect(useCallback(() => {
    load()
  }, []))

  async function load() {
    setLoading(true)
    try {
      const [pkgRes, catRes] = await Promise.all([
        api.get('/packages/mine'),
        api.get('/categories/groups'),
      ])
      const pkgs = pkgRes.data.data
      setItems(Array.isArray(pkgs) ? pkgs : [])
      const groups = catRes.data.data
      const allCats: Category[] = []
      if (Array.isArray(groups)) {
        groups.forEach((g: any) => {
          (g.categories || []).forEach((c: Category) => allCats.push(c))
        })
      }
      setCategories(allCats)
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  function openNew() {
    setEditing(null)
    setCategoryId(categories[0]?.id ?? '')
    setTitle(''); setDescription(''); setPrice(''); setDurationMin('60')
    setIncludesText(''); setIsActive(true)
    setModalOpen(true)
  }

  function openEdit(pkg: ServicePackage) {
    setEditing(pkg)
    setCategoryId(pkg.category.id)
    setTitle(pkg.title); setDescription(pkg.description)
    setPrice(String(pkg.price)); setDurationMin(String(pkg.duration_min))
    setIncludesText(pkg.includes.join('\n'))
    setIsActive(pkg.is_active)
    setModalOpen(true)
  }

  async function save() {
    if (!title.trim() || !description.trim() || !categoryId || !price) {
      Alert.alert('Erro', 'Preencha categoria, título, descrição e preço')
      return
    }
    setSaving(true)
    try {
      const body: any = {
        category_id: categoryId,
        title: title.trim(),
        description: description.trim(),
        price: Number(price),
        duration_min: Number(durationMin) || 60,
        includes: includesText.split('\n').map(s => s.trim()).filter(Boolean),
        is_active: isActive,
      }
      if (editing) {
        await api.patch(`/packages/${editing.id}`, body)
      } else {
        await api.post('/packages', body)
      }
      setModalOpen(false)
      await load()
    } catch (err) {
      Alert.alert('Erro', getApiError(err))
    } finally {
      setSaving(false)
    }
  }

  async function remove(pkg: ServicePackage) {
    Alert.alert('Excluir pacote', `Excluir "${pkg.title}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir', style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/packages/${pkg.id}`)
            await load()
          } catch (err) {
            Alert.alert('Erro', getApiError(err))
          }
        },
      },
    ])
  }

  return (
    <SafeAreaView className="flex-1 bg-slate2-50" edges={['top']}>
      <View className="flex-row items-center justify-between px-4 py-3 bg-white border-b border-slate2-100">
        <View className="flex-row items-center gap-2">
          <TouchableOpacity onPress={() => router.back()} className="p-1">
            <ArrowLeft size={22} color="#0F172A" />
          </TouchableOpacity>
          <Text className="text-lg font-semibold text-slate2-900">Meus Pacotes</Text>
        </View>
        <TouchableOpacity
          onPress={openNew}
          className="bg-brand-700 px-3 py-2 rounded-xl flex-row items-center gap-1"
        >
          <Plus size={16} color="#fff" />
          <Text className="text-white text-sm font-medium">Novo</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#7C3AED" />
        </View>
      ) : items.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <Package size={48} color="#94A3B8" />
          <Text className="text-slate2-600 text-center mt-3">
            Você ainda não tem pacotes.{'\n'}Crie um para clientes contratarem em 1 clique.
          </Text>
          <TouchableOpacity
            onPress={openNew}
            className="bg-brand-700 px-5 py-3 rounded-xl mt-4"
          >
            <Text className="text-white font-medium">Criar pacote</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView className="flex-1 p-4">
          {items.map(pkg => (
            <View key={pkg.id} className="bg-white rounded-2xl p-4 mb-3 border border-slate2-100">
              <View className="flex-row items-start justify-between">
                <View className="flex-1 pr-3">
                  <View className="flex-row items-center gap-2 mb-1">
                    <Text className="text-base font-semibold text-slate2-900 flex-1">{pkg.title}</Text>
                    {!pkg.is_active && (
                      <Text className="text-[10px] bg-slate2-200 px-2 py-0.5 rounded-full text-slate2-600">Inativo</Text>
                    )}
                  </View>
                  <Text className="text-xs text-slate2-500 mb-2">{pkg.category.name}</Text>
                  <Text className="text-sm text-slate2-700" numberOfLines={2}>{pkg.description}</Text>
                  <View className="flex-row items-center gap-3 mt-2">
                    <Text className="text-lg font-bold text-brand-700">{formatCurrency(pkg.price)}</Text>
                    <Text className="text-xs text-slate2-500">{pkg.duration_min} min</Text>
                    <Text className="text-xs text-slate2-500">· {pkg.purchases_count} vendas</Text>
                  </View>
                </View>
              </View>
              <View className="flex-row gap-2 mt-3 pt-3 border-t border-slate2-100">
                <TouchableOpacity
                  onPress={() => openEdit(pkg)}
                  className="flex-1 flex-row items-center justify-center gap-1.5 py-2 rounded-lg bg-slate2-100"
                >
                  <Edit2 size={14} color="#475569" />
                  <Text className="text-sm text-slate2-700">Editar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => remove(pkg)}
                  className="flex-1 flex-row items-center justify-center gap-1.5 py-2 rounded-lg bg-rose-50"
                >
                  <Trash2 size={14} color="#E11D48" />
                  <Text className="text-sm text-rose-600">Excluir</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Modal CRUD */}
      <Modal visible={modalOpen} animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <SafeAreaView className="flex-1 bg-white">
          <View className="flex-row items-center justify-between px-4 py-3 border-b border-slate2-100">
            <Text className="text-lg font-semibold text-slate2-900">
              {editing ? 'Editar pacote' : 'Novo pacote'}
            </Text>
            <TouchableOpacity onPress={() => setModalOpen(false)}>
              <X size={22} color="#0F172A" />
            </TouchableOpacity>
          </View>

          <ScrollView className="flex-1 p-4">
            <Text className="text-sm font-medium text-slate2-700 mb-1">Categoria</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
              {categories.map(c => (
                <TouchableOpacity
                  key={c.id}
                  onPress={() => setCategoryId(c.id)}
                  className={`px-3 py-2 rounded-xl mr-2 ${categoryId === c.id ? 'bg-brand-700' : 'bg-slate2-100'}`}
                >
                  <Text className={categoryId === c.id ? 'text-white text-sm' : 'text-slate2-700 text-sm'}>
                    {c.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text className="text-sm font-medium text-slate2-700 mb-1">Título</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Ex: Limpeza pesada apto 2 quartos"
              className="border border-slate2-200 rounded-xl px-3 py-2.5 mb-3 bg-white"
            />

            <Text className="text-sm font-medium text-slate2-700 mb-1">Descrição</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="O que está incluso, restrições..."
              multiline
              numberOfLines={4}
              className="border border-slate2-200 rounded-xl px-3 py-2.5 mb-3 bg-white h-24"
              textAlignVertical="top"
            />

            <View className="flex-row gap-3 mb-3">
              <View className="flex-1">
                <Text className="text-sm font-medium text-slate2-700 mb-1">Preço (R$)</Text>
                <TextInput
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="numeric"
                  placeholder="350"
                  className="border border-slate2-200 rounded-xl px-3 py-2.5 bg-white"
                />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-medium text-slate2-700 mb-1">Duração (min)</Text>
                <TextInput
                  value={durationMin}
                  onChangeText={setDurationMin}
                  keyboardType="numeric"
                  placeholder="60"
                  className="border border-slate2-200 rounded-xl px-3 py-2.5 bg-white"
                />
              </View>
            </View>

            <Text className="text-sm font-medium text-slate2-700 mb-1">
              Inclui (um item por linha)
            </Text>
            <TextInput
              value={includesText}
              onChangeText={setIncludesText}
              placeholder={'Produtos de limpeza\nLimpeza de janelas\nLimpeza de geladeira'}
              multiline
              numberOfLines={4}
              className="border border-slate2-200 rounded-xl px-3 py-2.5 mb-3 bg-white h-24"
              textAlignVertical="top"
            />

            <TouchableOpacity
              onPress={() => setIsActive(!isActive)}
              className="flex-row items-center gap-2 mb-4"
            >
              <View className={`w-5 h-5 rounded border-2 items-center justify-center ${isActive ? 'bg-brand-700 border-brand-700' : 'border-slate2-300'}`}>
                {isActive && <Text className="text-white text-xs">✓</Text>}
              </View>
              <Text className="text-sm text-slate2-700">Pacote ativo (visível para clientes)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={save}
              disabled={saving}
              className="bg-brand-700 py-3 rounded-xl items-center"
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-semibold">
                  {editing ? 'Salvar alterações' : 'Criar pacote'}
                </Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  )
}
