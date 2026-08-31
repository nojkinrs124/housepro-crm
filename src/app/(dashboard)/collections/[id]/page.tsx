import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Globe, Lock, Plus, Trash2, ExternalLink } from 'lucide-react'
import {
 toggleCollectionPublicAction,
 addPropertyToCollectionAction,
 removePropertyFromCollectionAction,
 deleteCollectionAction,
} from '@/features/collections/actions/collections.actions'
import { DeleteCollectionButton } from '@/features/collections/components/DeleteCollectionButton'
import { ServerActionForm } from '@/components/forms/ServerActionForm'

export default async function CollectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
 const { id } = await params
 const supabase = await createClient()
 const { data: { user } } = await supabase.auth.getUser()
 if (!user) redirect('/login')

 const { data: raw, error: rawError } = await supabase
 .from('property_collections')
 .select(`*, lead:leads(id, full_name),
 items:collection_items(sort_order, agent_note, added_at,
 property:properties(id, title, address, deal_type, price, status))`)
 .eq('id', id)
 .single()

 if (rawError && rawError.code !== 'PGRST116') {
 throw new Error(`Не удалось загрузить подборку: ${rawError.message}`)
 }
 if (!raw) notFound()
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 const col = raw as any

 const { data: allProperties } = await supabase
 .from('properties')
 .select('id, title, address')
 .eq('status', 'available')
 .order('created_at', { ascending: false })
 .limit(200)

 const addedIds = new Set((col.items ?? []).map((i: { property: { id: string } }) => i.property?.id))
 const availableToAdd = (allProperties ?? []).filter(p => !addedIds.has(p.id))

 const shareUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/c/${col.share_token}`
 const togglePublic = toggleCollectionPublicAction.bind(null, id, !col.is_public)

 return (
 <div className="max-w-4xl mx-auto space-y-6">
 {/* Header */}
 <div className="flex items-start justify-between gap-4">
 <div className="flex items-center gap-3">
 <Link href="/collections" className="p-2 hover:bg-[var(--hp-neutral-tint)] transition-colors text-muted-foreground">
 <ArrowLeft className="w-4 h-4" />
 </Link>
 <div>
 <h1 className="text-xl font-bold">{col.title}</h1>
 {col.lead && (
 <p className="text-sm text-muted-foreground mt-0.5">
 Для: <Link href={`/leads/${col.lead.id}`} className="hover:underline">{col.lead.full_name}</Link>
 </p>
 )}
 </div>
 </div>

 <div className="flex items-center gap-2">
 <ServerActionForm action={togglePublic}>
 <button
 type="submit"
 className={`flex items-center gap-1.5 px-3 py-1.5 text-xs border transition-colors ${
 col.is_public
 ? 'border-[var(--hp-border)] bg-[var(--hp-good-tint)] text-[var(--hp-good)] hover:bg-[var(--hp-good-tint)]'
 : 'border-[var(--hp-border)] bg-[var(--hp-surface)] text-[var(--hp-sub)] hover:bg-[var(--hp-neutral-tint)]'
 }`}
 >
 {col.is_public ? <><Globe className="w-3.5 h-3.5" />Публичная</> : <><Lock className="w-3.5 h-3.5" />Приватная</>}
 </button>
 </ServerActionForm>
 <DeleteCollectionButton id={id} />
 </div>
 </div>

 {/* Share link */}
 {col.is_public && (
 <div className="flex items-center gap-3 px-4 py-3 bg-[var(--hp-good-tint)] border border-[var(--hp-border)]">
 <Globe className="w-4 h-4 text-[var(--hp-good)] flex-shrink-0" />
 <div className="flex-1 min-w-0">
 <p className="text-xs text-[var(--hp-good)] font-medium mb-0.5">Публичная ссылка для клиента</p>
 <a href={shareUrl} target="_blank" rel="noopener noreferrer"
 className="text-sm text-[var(--hp-good)] hover:underline truncate block">
 {shareUrl}
 </a>
 </div>
 <a href={shareUrl} target="_blank" rel="noopener noreferrer"
 className="flex-shrink-0 p-1.5 text-[var(--hp-good)] hover:bg-[var(--hp-good-tint)] transition-colors">
 <ExternalLink className="w-4 h-4" />
 </a>
 </div>
 )}

 <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
 {/* Items list */}
 <div className="lg:col-span-2 space-y-3">
 <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
 Объекты в подборке ({col.items?.length ?? 0})
 </h2>

 {(!col.items || col.items.length === 0) ? (
 <div className="py-12 text-center text-muted-foreground bg-[var(--hp-surface)] border border-dashed border-[var(--hp-border)]">
 <p className="text-sm">Подборка пуста</p>
 <p className="text-xs mt-1">Добавьте объекты из списка справа</p>
 </div>
 ) : (
 col.items.map((item: { property: { id: string; title: string; address?: string; price?: number; deal_type?: string; status?: string }; agent_note?: string }) => (
 <div key={item.property?.id} className="flex items-start justify-between gap-3 p-4 hp-card">
 <div className="min-w-0">
 <Link href={`/properties/${item.property?.id}`} className="font-medium text-foreground hover:underline truncate block">
 {item.property?.title}
 </Link>
 {item.property?.address && (
 <p className="text-xs text-muted-foreground mt-0.5">{item.property.address}</p>
 )}
 {item.property?.price && (
 <p className="text-sm font-semibold text-primary mt-1">
 {Number(item.property.price).toLocaleString('ru-RU')} ₽
 </p>
 )}
 {item.agent_note && (
 <p className="text-xs text-muted-foreground mt-1 italic">{item.agent_note}</p>
 )}
 </div>
 <ServerActionForm action={removePropertyFromCollectionAction.bind(null, id, item.property?.id)}>
 <button type="submit" className="p-1.5 text-muted-foreground hover:text-[var(--hp-danger)] hover:bg-[var(--hp-danger-tint)] transition-colors flex-shrink-0">
 <Trash2 className="w-3.5 h-3.5" />
 </button>
 </ServerActionForm>
 </div>
 ))
 )}
 </div>

 {/* Add properties */}
 <div>
 <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">
 Добавить объект
 </h2>
 <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
 {availableToAdd.length === 0 ? (
 <p className="text-sm text-muted-foreground text-center py-8">Нет доступных объектов</p>
 ) : (
 availableToAdd.map(p => (
 <ServerActionForm key={p.id} action={addPropertyToCollectionAction.bind(null, id, p.id)}>
 <button
 type="submit"
 className="w-full flex items-start justify-between gap-2 p-3 hp-card text-left hover:border-primary/40 transition-all group"
 >
 <div className="min-w-0">
 <div className="text-sm font-medium text-foreground truncate">{p.title}</div>
 {p.address && <div className="text-xs text-muted-foreground truncate">{p.address}</div>}
 </div>
 <Plus className="w-4 h-4 text-muted-foreground group-hover:text-primary flex-shrink-0 mt-0.5 transition-colors" />
 </button>
 </ServerActionForm>
 ))
 )}
 </div>
 </div>
 </div>
 </div>
 )
}
