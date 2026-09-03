import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Home, MapPin, Phone } from 'lucide-react'
import { PropertyMap, type MapPoint } from '@/features/properties/components/PropertyMap'
import { PROPERTY_PURPOSE_LABELS as DEAL_LABELS } from '@/features/properties/config/purpose'

export default async function PublicCollectionPage({ params }: { params: Promise<{ token: string }> }) {
 const { token } = await params
 const supabase = await createClient()

 const { data: col, error: colError } = await supabase
 .from('property_collections')
 .select(`id, title, created_at,
 items:collection_items(sort_order, agent_note,
 property:properties(id, title, address, deal_type, price, area, rooms, floor, total_floors, description, latitude, longitude))`)
 .eq('share_token', token)
 .eq('is_public', true)
 .single()

 if (colError && colError.code !== 'PGRST116') {
 throw new Error(`Не удалось загрузить подборку: ${colError.message}`)
 }
 if (!col) notFound()

 // Форма ответа задаётся select'ом выше; описываем ровно те поля, которые
 // страница читает. Раньше тут стоял каст к any, и опечатка в имени поля не
 // поймалась бы ни компилятором, ни глазами — публичная страница просто
 // показала бы пустоту.
 interface CollectionProperty {
   id: string
   title: string
   address: string | null
   deal_type: string
   price: number | null
   area: number | null
   rooms: number | null
   floor: number | null
   total_floors: number | null
   description: string | null
   latitude: number | null
   longitude: number | null
 }
 interface CollectionItem {
   sort_order: number | null
   agent_note: string | null
   property: CollectionProperty | null
 }
 interface CollectionRow {
   id: string
   title: string
   created_at: string | null
   items: CollectionItem[] | null
 }
 const collection = col as unknown as CollectionRow

 // Карта появляется, только если у объектов есть координаты: у старых записей
 // их нет, и пустая серая плашка вместо карты выглядела бы поломкой.
 const mapPoints: MapPoint[] = (collection.items ?? [])
 .map(item => item.property)
 .filter((p): p is CollectionProperty => Boolean(p?.latitude && p?.longitude))
 .map(p => ({
 id: p.id,
 latitude: Number(p.latitude),
 longitude: Number(p.longitude),
 title: p.title,
 subtitle: [p.address, p.price ? `${Number(p.price).toLocaleString('ru-RU')} ₽` : null]
 .filter(Boolean)
 .join(' · '),
 }))

 return (
 <div className="min-h-screen bg-[var(--hp-neutral-tint)]">
 {/* Header */}
 <header className="bg-[var(--hp-surface)] border-b border-[var(--hp-border-soft)] sticky top-0 z-10">
 <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
 <div className="flex items-center gap-2">
 <div className="w-8 h-8 bg-primary flex items-center justify-center">
 <Home className="w-4 h-4 text-white" />
 </div>
 <span className="font-bold text-foreground">HousePro</span>
 </div>
 <a
 href="tel:+79000000000"
 className="flex items-center gap-1.5 text-sm text-primary font-medium"
 >
 <Phone className="w-4 h-4" />
 Связаться
 </a>
 </div>
 </header>

 <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
 {/* Title */}
 <div className="text-center space-y-2">
 <h1 className="text-2xl font-bold text-foreground">{collection.title}</h1>
 <p className="text-muted-foreground text-sm">
 {collection.items?.length ?? 0} объектов{collection.created_at && ` · ${new Date(collection.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}`}
 </p>
 </div>

 {mapPoints.length > 0 && (
 <div className="hp-card p-4">
 <PropertyMap points={mapPoints} height={320} heading="Объекты на карте" />
 </div>
 )}

 {/* Properties grid */}
 {collection.items?.length === 0 ? (
 <div className="text-center py-16 text-muted-foreground">
 <Home className="w-12 h-12 mx-auto mb-4 opacity-20" />
 <p>Подборка пуста</p>
 </div>
 ) : (
 <div className="grid gap-5 sm:grid-cols-2">
 {collection.items?.map((item) => {
 const p = item.property
 if (!p) return null
 return (
 <div key={p.id} className="hp-card overflow-hidden">
 {/* Photo placeholder */}
 <div className="w-full h-48 bg-[var(--hp-neutral-tint)] flex items-center justify-center">
 <Home className="w-10 h-10 text-[var(--hp-tertiary)]" />
 </div>

 <div className="p-5 space-y-3">
 {p.deal_type && (
 <span className="text-xs px-2 py-0.5 rounded-[var(--hp-radius-badge)] bg-primary/10 text-primary font-medium">
 {DEAL_LABELS[p.deal_type] ?? p.deal_type}
 </span>
 )}
 <h2 className="font-semibold text-foreground">{p.title}</h2>

 {p.address && (
 <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
 <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
 {p.address}
 </div>
 )}

 <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
 {p.rooms && <span>{p.rooms} комн.</span>}
 {p.area && <span>{p.area} м²</span>}
 {p.floor && p.total_floors && <span>{p.floor}/{p.total_floors} эт.</span>}
 </div>

 {p.price && (
 <div className="text-xl font-bold text-foreground">
 {Number(p.price).toLocaleString('ru-RU')} ₽
 </div>
 )}

 {item.agent_note && (
 <div className="pt-2 border-t border-[var(--hp-border-soft)]">
 <p className="text-xs text-muted-foreground italic">{item.agent_note}</p>
 </div>
 )}
 </div>
 </div>
 )
 })}
 </div>
 )}

 <p className="text-center text-xs text-muted-foreground pb-4">
 Подборка подготовлена агентством недвижимости · HousePro CRM
 </p>
 </main>
 </div>
 )
}
