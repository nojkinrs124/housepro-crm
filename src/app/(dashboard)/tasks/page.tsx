import { createClient } from '@/lib/supabase/server'
import { Plus, CheckSquare, AlertCircle, Clock, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { TasksKanbanBoard } from '@/features/tasks/components/TasksKanban'
import { PageHeader } from '@/components/layout/PageHeader'
import { buttonVariants } from '@/components/ui/button'

export default async function TasksPage() {
 const supabase = await createClient()
 const { data: tasks } = await supabase
 .from('tasks')
 .select('*, assignee:users!tasks_assigned_to_fkey(full_name)')
 .order('created_at', { ascending: false })

 const total = tasks?.length ?? 0
 const active = (tasks ?? []).filter(t => !['done', 'cancelled'].includes(t.status)).length
 const done = (tasks ?? []).filter(t => t.status === 'done').length
 const overdue = (tasks ?? []).filter(t =>
 t.deadline && new Date(t.deadline) < new Date() && !['done', 'cancelled'].includes(t.status)
 ).length

 return (
 <div className="space-y-6">
 <PageHeader
 title="Задачи"
 subtitle={`${total} задач · ${active} активных`}
 actions={
 <Link href="/tasks/new" className={buttonVariants({ size: 'sm' })}>
 <Plus style={{ width: 16, height: 16 }} />
 Новая задача
 </Link>
 }
 />

 {/* Stats */}
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
 {[
 { label: 'Всего задач', value: total, Icon: CheckSquare, alert: false },
 { label: 'Активных', value: active, Icon: Clock, alert: false },
 { label: 'Выполнено', value: done, Icon: CheckCircle2, alert: false },
 // Просрочка — единственное, что здесь действительно тревожное.
 { label: 'Просрочено', value: overdue, Icon: AlertCircle, alert: overdue > 0 },
 ].map(stat => {
 const Icon = stat.Icon
 return (
 <div key={stat.label} className="hp-card p-5 flex items-center gap-3 sm:gap-4">
 <div className={`w-11 h-11 flex items-center justify-center shrink-0 border border-[var(--hp-border)] ${
 stat.alert ? 'bg-[var(--hp-danger-tint)]' : 'bg-[var(--hp-neutral-tint)]'
 }`}>
 <Icon style={{ width: 20, height: 20, color: stat.alert ? 'var(--hp-danger)' : 'var(--hp-sub)' }} />
 </div>
 <div className="min-w-0">
 <p className={`text-2xl font-bold ${stat.alert ? 'text-[var(--hp-danger)]' : 'text-[var(--hp-ink)]'}`}>{stat.value}</p>
 <p className="text-xs text-[var(--hp-sub)] font-medium mt-0.5 leading-tight break-words">{stat.label}</p>
 </div>
 </div>
 )
 })}
 </div>

 {total === 0 ? (
 <div className="hp-card hp-empty">
 <div className="w-16 h-16 rounded-[var(--hp-radius)] flex items-center justify-center mx-auto mb-4 bg-[var(--hp-neutral-tint)] border border-[var(--hp-border)]">
 <CheckSquare style={{ width: 26, height: 26, color: 'var(--hp-sub)' }} />
 </div>
 <p className="text-[var(--hp-ink)] font-bold text-lg">Нет задач</p>
 <p className="text-[var(--hp-sub)] text-sm mt-1">Создайте первую задачу для команды</p>
 <Link href="/tasks/new" className="hp-btn-primary mt-5">
 <Plus style={{ width: 16, height: 16 }} />
 Создать задачу
 </Link>
 </div>
 ) : (
 <TasksKanbanBoard tasks={tasks ?? []} />
 )}
 </div>
 )
}
