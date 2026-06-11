'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, ChevronDown } from 'lucide-react'
import type { Property } from '@/types/database'

export function PropertySelector({
  onPropertySelect,
  selectedPropertyId,
}: {
  onPropertySelect: (propertyId: string) => void
  selectedPropertyId?: string
}) {
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newPropertyData, setNewPropertyData] = useState({
    title: '',
    address: '',
    property_type: 'apartment' as const,
  })

  useEffect(() => {
    const loadProperties = async () => {
      const supabase = createClient()
      const { data } = await supabase.from('properties').select('id, title, address, property_type, status').limit(50)
      setProperties((data as Property[]) || [])
      setLoading(false)
    }
    loadProperties()
  }, [])

  const handleCreateProperty = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const supabase = createClient()
    const { data, error } = await supabase
      .from('properties')
      .insert([
        {
          title: newPropertyData.title,
          address: newPropertyData.address,
          property_type: newPropertyData.property_type,
          deal_type: 'rent',
          status: 'available',
        },
      ])
      .select()
      .single()

    if (error) {
      alert(`Ошибка: ${error.message}`)
      return
    }

    if (data) {
      setProperties([...properties, data as Property])
      onPropertySelect(data.id)
      setShowCreate(false)
      setNewPropertyData({ title: '', address: '', property_type: 'apartment' })
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <label className="block text-sm font-medium text-foreground">
          Объект недвижимости
        </label>
        <select
          value={selectedPropertyId || ''}
          onChange={(e) => onPropertySelect(e.target.value)}
          disabled={loading}
          className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary disabled:opacity-50"
        >
          <option value="">Выберите объект...</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title || p.address}
            </option>
          ))}
        </select>
      </div>

      {!showCreate ? (
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-dashed border-primary/50 text-primary hover:bg-primary/5 transition text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Создать новый объект
        </button>
      ) : (
        <form onSubmit={handleCreateProperty} className="bg-muted p-4 rounded-lg space-y-3">
          <input
            type="text"
            placeholder="Название объекта"
            value={newPropertyData.title}
            onChange={(e) => setNewPropertyData({ ...newPropertyData, title: e.target.value })}
            required
            className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary"
          />

          <input
            type="text"
            placeholder="Адрес"
            value={newPropertyData.address}
            onChange={(e) => setNewPropertyData({ ...newPropertyData, address: e.target.value })}
            required
            className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary"
          />

          <select
            value={newPropertyData.property_type}
            onChange={(e) => setNewPropertyData({ ...newPropertyData, property_type: e.target.value as any })}
            className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary"
          >
            <option value="apartment">Квартира</option>
            <option value="house">Дом</option>
            <option value="commercial">Коммерческое</option>
            <option value="land">Земельный участок</option>
          </select>

          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition"
            >
              Создать
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="flex-1 px-3 py-1.5 rounded-lg border border-border text-foreground text-sm font-medium hover:bg-muted transition"
            >
              Отмена
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
