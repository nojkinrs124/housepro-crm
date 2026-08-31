import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, Eye, Calendar, User, Home } from 'lucide-react'
import { ShowingStatusBadge } from '@/features/showings/components/ShowingStatusBadge'

export default async function ShowingsPage() {
 const supabase = await createClient()
 const { data: { user } } = await supabase.auth.getUser()
 if (!user) redirect('/login')

 const { data: showings } = await supabase
 .from('showings')
 .select(`
 id, scheduled_at, status, result, duration_min,
 property:properties(id, title, address),
 lead:leads(id, full_name),
 agent:users!showings_agent_id_fkey(full_name)
 `)
 .order('scheduled_at', { ascending: false })
 .limit(100)

 const groups = {
 planned: showings?.filter(s => s.status === 'planned') ?? [],
 completed: showings?.filter(s => s.status === 'completed') ?? [],
 other: showings?.filter(s => !['planned','completed'].includes(s.status)) ?? [],
 }

 return (
 <div className="space-y-6">
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-2xl font-bold text-foreground">Показы</h1>
 <p className="text-sm text-muted-foreground mt-0.5">
 {showings?.length ?? 0} показов
 </p>
 </div>
 <Link
 href="/showings/new"
 className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
 >
 <Plus className="w-4 h-4" />
 Новый показ
 </Link>
 </div>

 {/* Upcoming */}
 {groups.planned.length > 0 && (
 <section>
 <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
 Предстоящие ({groups.planned.length})
 </h2>
 <div className="space-y-2">
 {groups.planned.map(s => <ShowingRow key={s.id} showing={s} />)}
 </div>
 </section>
 )}

 {/* Completed */}
 {groups.completed.length > 0 && (
 <section>
 <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
 Проведённые ({groups.completed.length})
 </h2>
 <div className="space-y-2">
 {groups.completed.map(s => <ShowingRow key={s.id} showing={s} />)}
 </div>
 </section>
 )}

 {/* Other */}
 {groups.other.length > 0 && (
 <section>
 <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
 Остальные ({groups.other.length})
 </h2>
 <div className="space-y-2">
 {groups.other.map(s => <ShowingRow key={s.id} showing={s} />)}
 </div>
 </section>
 )}

 {(!showings || showings.length === 0) && (
 <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
 <Eye className="w-12 h-12 mb-4 opacity-20" />
 <p className="font-medium">Показов пока нет</p>
 <p className="text-sm mt-1">Запланируйте первый показ объекта</p>
 </div>
 )}
 </div>
 )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ShowingRow({ showing }: { showing: any }) {
 return (
 <Link
 href={`/showings/${showing.id}`}
 className="flex items-center justify-between gap-4 px-5 py-3.5 hp-card transition-all group"
 >
 <div className="flex items-start gap-3 min-w-0">
 <div className="w-8 h-8 bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
 <Eye className="w-4 h-4 text-primary" />
 </div>
 <div className="min-w-0">
 <div className="font-medium text-foreground truncate">
 {showing.property?.title ?? 'Объект не указан'}
 </div>
 <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-xs text-muted-foreground">
 {showing.property?.address && (
 <span className="flex items-center gap-1">
 <Home className="w-3 h-3" />
 {showing.property.address}
 </span>
 )}
 {showing.lead?.full_name && (
 <span className="flex items-center gap-1">
 <User className="w-3 h-3" />
 {showing.lead.full_name}
 </span>
 )}
 {showing.agent?.full_name && (
 <span>Агент: {showing.agent.full_name}</span>
 )}
 </div>
 </div>
 </div>

 <div className="flex items-center gap-3 flex-shrink-0">
 <div className="text-right">
 <div className="text-sm font-medium text-foreground flex items-center gap-1">
 <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
 {new Date(showing.scheduled_at).toLocaleDateString('ru-RU', {
 day: '2-digit', month: '2-digit',
 })}
 </div>
 <div className="text-xs text-muted-foreground">
 {new Date(showing.scheduled_at).toLocaleTimeString('ru-RU', {
 hour: '2-digit', minute: '2-digit',
 })}
 {showing.duration_min && ` · ${showing.duration_min} мин`}
 </div>
 </div>
 <ShowingStatusBadge status={showing.status} />
 </div>
 </Link>
 )
}
