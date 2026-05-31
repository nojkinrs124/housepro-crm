'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Property } from '@/types/database'

export function PropertySelectWithCreate({
  properties: initialProperties,
  selectedPropertyId,
  onChange,
}: {
  properties: Property[]
  selectedPropertyId?: string
  onChange: (id: string) => void
}) {
  const [properties, setProperties] = useState(initialProperties)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    address: '',
    property_type: 'apartment',
  })

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const supabase = createClient()
    const { data, error } = await supabase
      .from('properties')
      .insert([
        {
          title: formData.title,
          address: formData.address,
          property_type: formData.property_type,
          deal_type: 'rent',
          status: 'available',
        },
      ])
      .select()
      .single()

    if (error) {
      alert(`Ошибка: ${error.message}`)
    } else if (data) {
      const newProperty = data as Property
      setProperties([...properties, newProperty])
      onChange(newProperty.id)
      setShowCreateForm(false)
      setFormData({ title: '', address: '', property_type: 'apartment' })
    }

    setLoading(false)
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-foreground mb-2">
        Объект недвижимости *
      </label>

      <select
        name="property_id"
        value={selectedPropertyId || ''}
        onChange={(e) => onChange(e.target.value)}
        required
        className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary"
      >
        <option value="">Выберите объект...</option>
        {properties.map((p) => (
          <option key={p.id} value={p.id}>
            {p.title || p.address || 'Без названия'}
          </option>
        ))}
      </select>

      {!showCreateForm ? (
        <button
          type="button"
          onClick={() => setShowCreateForm(true)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-dashed border-primary/50 text-primary hover:bg-primary/5 transition text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Создать новый объект
        </button>
      ) : (
        <div className="bg-muted p-4 rounded-lg space-y-3 border border-border">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-sm text-foreground">Новый объект</h4>
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <input
            type="text"
            placeholder="Название объекта (требуется)"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            required
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary"
          />

          <input
            type="text"
            placeholder="Адрес (требуется)"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            required
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary"
          />

          <select
            value={formData.property_type}
            onChange={(e) => setFormData({ ...formData, property_type: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary"
          >
            <option value="apartment">Квартира</option>
            <option value="house">Дом</option>
            <option value="commercial">Коммерческое помещение</option>
            <option value="land">Земельный участок</option>
            <option value="other">Другое</option>
          </select>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={handleCreate}
              disabled={loading || !formData.title || !formData.address}
              className="flex-1 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Создание...' : 'Создать'}
            </button>
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="flex-1 px-3 py-2 rounded-lg border border-border text-foreground text-sm font-medium hover:bg-muted transition"
            >
              Отмена
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
