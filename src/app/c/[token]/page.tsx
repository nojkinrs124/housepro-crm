import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Home, MapPin, Phone } from 'lucide-react'

export default async function PublicCollectionPage({ params }: { params: Promise<{ token: string }> }) {
 const { token } = await params
 const supabase = await createClient()

 const { data: col, error: colError } = await supabase
 .from('property_collections')
 .select(`id, title, created_at,
 items:collection_items(sort_order, agent_note,
 property:properties(id, title, address, deal_type, price, area, rooms, floor, total_floors, description))`)
 .eq('share_token', token)
 .eq('is_public', true)
 .single()

 if (colError && colError.code !== 'PGRST116') {
 throw new Error(`Не удалось загрузить подборку: ${colError.message}`)
 }
 if (!col) notFound()

 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 const collection = col as any

 const DEAL_LABELS: Record<string, string> = {
 sale: 'Продажа', rent: 'Аренда', management: 'Управление'
 }

 return (
 <div className="min-h-screen bg-slate-50">
 {/* Header */}
 <header className="bg-white border-b border-[var(--hp-border-soft)] sticky top-0 z-10">
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
 {collection.items?.length ?? 0} объектов · {new Date(collection.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
 </p>
 </div>

 {/* Properties grid */}
 {collection.items?.length === 0 ? (
 <div className="text-center py-16 text-muted-foreground">
 <Home className="w-12 h-12 mx-auto mb-4 opacity-20" />
 <p>Подборка пуста</p>
 </div>
 ) : (
 <div className="grid gap-5 sm:grid-cols-2">
 {collection.items?.map((item: {
 agent_note?: string
 property: {
 id: string; title: string; address?: string; deal_type?: string
 price?: number; area?: number; rooms?: number
 floor?: number; total_floors?: number; description?: string
 }
 }) => {
 const p = item.property
 if (!p) return null
 return (
 <div key={p.id} className="hp-card overflow-hidden">
 {/* Photo placeholder */}
 <div className="w-full h-48 bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
 <Home className="w-10 h-10 text-slate-300" />
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
