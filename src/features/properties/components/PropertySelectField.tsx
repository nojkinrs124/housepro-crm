'use client'

import { useState } from 'react'
import { Building2 } from 'lucide-react'
import { QuickCreateModal } from '@/components/ui/QuickCreateModal'
import { QuickCreatePropertyForm, type QuickProperty } from './QuickCreatePropertyForm'

interface PropertyOption {
 id: string
 title: string
 address?: string | null
}

export function PropertySelectField({
 properties: initialProperties,
 defaultPropertyId = '',
}: {
 properties: PropertyOption[]
 defaultPropertyId?: string
}) {
 const [properties, setProperties] = useState(initialProperties)
 const [propertyId, setPropertyId] = useState(defaultPropertyId)
 const [showQuickCreate, setShowQuickCreate] = useState(false)

 const handleCreated = (property: QuickProperty) => {
 setProperties(prev => [...prev, property])
 setPropertyId(property.id)
 setShowQuickCreate(false)
 }

 return (
 <div className="space-y-1.5">
 <label className="text-sm font-medium text-foreground">Объект</label>
 <div className="flex flex-col sm:flex-row sm:items-stretch gap-2">
 <select
 name="property_id"
 value={propertyId}
 onChange={(e) => setPropertyId(e.target.value)}
 className="w-full sm:flex-1 sm:min-w-0 h-10 px-4 border border-input bg-background text-foreground text-sm outline-none focus:border-[var(--hp-ink)] cursor-pointer"
 >
 <option value="">Выберите объект</option>
 {properties.map(p => (
 <option key={p.id} value={p.id}>{p.title}{p.address ? ` — ${p.address}` : ''}</option>
 ))}
 </select>
 <button
 type="button"
 onClick={() => setShowQuickCreate(true)}
 className="h-10 px-4 border border-primary/30 text-primary text-sm font-medium hover:bg-primary/10 transition flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
 >
 <Building2 className="w-4 h-4" />
 Создать
 </button>
 </div>

 {showQuickCreate && (
 <QuickCreateModal title="Новый объект" onClose={() => setShowQuickCreate(false)}>
 <QuickCreatePropertyForm
 onCancel={() => setShowQuickCreate(false)}
 onCreated={handleCreated}
 />
 </QuickCreateModal>
 )}
 </div>
 )
}
