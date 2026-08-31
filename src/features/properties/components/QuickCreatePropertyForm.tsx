'use client'

import { useState, useTransition } from 'react'
import { AlertCircle } from 'lucide-react'
import { createPropertyQuickAction } from '../actions/properties.actions'

export interface QuickProperty {
 id: string
 title: string
 address: string
 property_type: string
}

const input = 'w-full h-10 px-4 border border-input bg-background text-foreground text-sm outline-none focus:border-[var(--hp-ink)] transition-all'

export function QuickCreatePropertyForm({
 onCreated,
 onCancel,
}: {
 onCreated: (property: QuickProperty) => void
 onCancel: () => void
}) {
 const [title, setTitle] = useState('')
 const [address, setAddress] = useState('')
 const [propertyType, setPropertyType] = useState('apartment')
 const [error, setError] = useState<string | null>(null)
 const [pending, startTransition] = useTransition()

 const submit = () => {
 if (!title.trim() || !address.trim()) {
 setError('Название и адрес обязательны')
 return
 }
 setError(null)

 const fd = new FormData()
 fd.set('title', title.trim())
 fd.set('address', address.trim())
 fd.set('property_type', propertyType)
 fd.set('deal_type', 'rent')
 fd.set('status', 'available')

 startTransition(async () => {
 const res = await createPropertyQuickAction(fd)
 if (res && 'error' in res) {
 setError(res.error)
 } else if (res && 'data' in res) {
 onCreated(res.data as QuickProperty)
 }
 })
 }

 return (
 <div className="space-y-3">
 {error && (
 <div className="flex items-center gap-2 border border-[var(--hp-border)] bg-[var(--hp-danger-tint)] px-3 py-2 text-sm text-[var(--hp-danger)]">
 <AlertCircle className="w-4 h-4 shrink-0" />
 {error}
 </div>
 )}

 <div className="space-y-1.5">
 <label className="text-sm font-medium text-foreground">Название *</label>
 <input
 autoFocus
 value={title}
 onChange={(e) => setTitle(e.target.value)}
 placeholder="2-к квартира на Ленина"
 className={input}
 />
 </div>

 <div className="space-y-1.5">
 <label className="text-sm font-medium text-foreground">Адрес *</label>
 <input
 value={address}
 onChange={(e) => setAddress(e.target.value)}
 placeholder="г. Москва, ул. Ленина, д. 1"
 className={input}
 />
 </div>

 <div className="space-y-1.5">
 <label className="text-sm font-medium text-foreground">Тип</label>
 <select
 value={propertyType}
 onChange={(e) => setPropertyType(e.target.value)}
 className={input}
 >
 <option value="apartment">Квартира</option>
 <option value="house">Дом</option>
 <option value="commercial">Коммерческое помещение</option>
 <option value="land">Земельный участок</option>
 <option value="other">Другое</option>
 </select>
 </div>

 <p className="text-xs text-muted-foreground">
 Остальные поля (площадь, цена, характеристики и др.) можно заполнить позже в карточке объекта.
 </p>

 <div className="flex gap-2 pt-2">
 <button
 type="button"
 onClick={submit}
 disabled={pending || !title.trim() || !address.trim()}
 className="flex-1 h-10 bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
 >
 {pending ? 'Создание...' : 'Создать и выбрать'}
 </button>
 <button
 type="button"
 onClick={onCancel}
 disabled={pending}
 className="flex-1 h-10 border border-border text-foreground text-sm font-medium hover:bg-muted transition"
 >
 Отмена
 </button>
 </div>
 </div>
 )
}
