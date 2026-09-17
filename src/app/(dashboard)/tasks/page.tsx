import { createClient } from '@/lib/supabase/server'
import { Plus, CheckSquare, CalendarDays } from 'lucide-react'
import Link from 'next/link'
import { TasksView, type TaskRow } from '@/features/tasks/components/TasksView'
import { PageHeader } from '@/components/layout/PageHeader'
import { buttonVariants } from '@/components/ui/button'
import { StatStrip } from '@/components/layout/StatStrip'
import { EmptyState } from '@/components/layout/EmptyState'
import { plural } from '@/lib/utils'

export default async function TasksPage() {
 const supabase = await createClient()
 const { data: tasks } = await supabase
 .from('tasks')
 .select('*, assignee:users!tasks_assigned_to_fkey(full_name)')
 .order('created_at', { ascending: false })

 const rows: TaskRow[] = (tasks ?? []).map(t => ({
 id: t.id,
 title: t.title,
 status: t.status,
 priority: t.priority,
 deadline: t.deadline,
 description: t.description,
 assigneeName: (t.assignee as { full_name: string | null } | null)?.full_name ?? null,
 }))

 const total = tasks?.length ?? 0
 const active = (tasks ?? []).filter(t => !['done', 'cancelled'].includes(t.status)).length
 const done = (tasks ?? []).filter(t => t.status === 'done').length
 const overdue = (tasks ?? []).filter(t =>
 t.deadline && new Date(t.deadline) < new Date() && !['done', 'cancelled'].includes(t.status)
 ).length

 return (
 <div className="space-y-5">
 <PageHeader
 title="Задачи"
 subtitle={`${plural(total, ['задача', 'задачи', 'задач'])} · ${plural(active, ['активная', 'активные', 'активных'])}`}
 actions={
 <>
 {/* Календарь — тот же список задач и показов по дням, не отдельный раздел */}
 <Link href="/calendar" className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
 <CalendarDays style={{ width: 16, height: 16 }} />
 Календарь
 </Link>
 <Link href="/tasks/new" className={buttonVariants({ size: 'sm' })}>
 <Plus style={{ width: 16, height: 16 }} />
 Новая задача
 </Link>
 </>
 }
 />

 {total > 0 && (
 <StatStrip
 items={[
 { label: 'Всего задач', value: total },
 { label: 'В работе', value: active, hint: active > 0 ? 'открытые задачи' : 'всё закрыто' },
 { label: 'Выполнено', value: done },
 // Просрочка — единственное, что здесь действительно тревожное.
 { label: 'Просрочено', value: overdue, alert: overdue > 0, hint: overdue > 0 ? 'разобрать в первую очередь' : 'сроков не нарушено' },
 ]}
 />
 )}

 {total === 0 ? (
 <EmptyState
 icon={<CheckSquare className="w-5 h-5 text-[var(--hp-sub)]" />}
 title="Задач пока нет"
 description="Задача — это напоминание себе: позвонить, показать, подготовить документ. Поставьте первую, и она появится на доске и в календаре."
 actionHref="/tasks/new"
 actionLabel="Новая задача"
 />
 ) : (
 <TasksView tasks={rows} />
 )}
 </div>
 )
}
