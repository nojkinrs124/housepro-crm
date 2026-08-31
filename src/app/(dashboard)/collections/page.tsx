import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, FolderOpen, Globe, Lock } from 'lucide-react'

export default async function CollectionsPage() {
 const supabase = await createClient()
 const { data: { user } } = await supabase.auth.getUser()
 if (!user) redirect('/login')

 const { data: collections } = await supabase
 .from('property_collections')
 .select(`id, title, is_public, share_token, created_at,
 lead:leads(id, full_name),
 items:collection_items(count)`)
 .order('created_at', { ascending: false })

 return (
 <div className="space-y-6">
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-2xl font-bold">Подборки объектов</h1>
 <p className="text-sm text-muted-foreground mt-0.5">
 Персональные подборки для клиентов с публичными ссылками
 </p>
 </div>
 <Link
 href="/collections/new"
 className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
 >
 <Plus className="w-4 h-4" />
 Новая подборка
 </Link>
 </div>

 {(!collections || collections.length === 0) ? (
 <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
 <FolderOpen className="w-12 h-12 mb-4 opacity-20" />
 <p className="font-medium">Подборок пока нет</p>
 <p className="text-sm mt-1">Создайте первую подборку объектов для клиента</p>
 </div>
 ) : (
 <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
 {(collections as unknown as Array<{
 id: string; title: string; is_public: boolean; share_token: string; created_at: string
 lead: { id: string; full_name: string } | null
 items: { count: number }[]
 }>).map(col => (
 <Link
 key={col.id}
 href={`/collections/${col.id}`}
 className="flex flex-col gap-3 p-5 hp-card transition-all"
 >
 <div className="flex items-start justify-between gap-2">
 <div className="w-9 h-9 bg-primary/10 flex items-center justify-center flex-shrink-0">
 <FolderOpen className="w-4 h-4 text-primary" />
 </div>
 <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
 col.is_public ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-[var(--hp-sub)]'
 }`}>
 {col.is_public ? <><Globe className="w-3 h-3" />Публичная</> : <><Lock className="w-3 h-3" />Приватная</>}
 </span>
 </div>
 <div>
 <div className="font-semibold text-foreground">{col.title}</div>
 {col.lead && (
 <div className="text-sm text-muted-foreground mt-0.5">Для: {col.lead.full_name}</div>
 )}
 </div>
 <div className="text-xs text-muted-foreground">
 {col.items?.[0]?.count ?? 0} объектов · {new Date(col.created_at).toLocaleDateString('ru-RU')}
 </div>
 </Link>
 ))}
 </div>
 )}
 </div>
 )
}
