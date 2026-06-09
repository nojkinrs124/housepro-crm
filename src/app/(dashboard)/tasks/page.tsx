import { createClient } from '@/lib/supabase/server'
import { Plus, CheckSquare, AlertCircle, Clock, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { TasksKanbanBoard } from '@/features/tasks/components/TasksKanban'

export default async function TasksPage() {
  const supabase = await createClient()
  const { data: tasks } = await supabase
    .from('tasks')
    .select('*, assignee:users!tasks_assigned_to_fkey(full_name)')
    .order('created_at', { ascending: false })

  const total   = tasks?.length ?? 0
  const active  = (tasks ?? []).filter(t => !['done', 'cancelled'].includes(t.status)).length
  const done    = (tasks ?? []).filter(t => t.status === 'done').length
  const overdue = (tasks ?? []).filter(t =>
    t.deadline && new Date(t.deadline) < new Date() && !['done', 'cancelled'].includes(t.status)
  ).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-bold text-[#111827] tracking-tight leading-tight">Задачи</h1>
          <p className="text-[#64748B] mt-1 text-sm">{total} задач · {active} активных</p>
        </div>
        <Link href="/tasks/new"
          className="flex items-center gap-2 px-4 py-2.5 text-white rounded-xl text-sm font-semibold"
          style={{ background: 'linear-gradient(135deg, #16A34A, #22C55E)', boxShadow: '0 4px 16px rgba(22,163,74,0.35)' }}>
          <Plus style={{ width: 16, height: 16 }} />
          Новая задача
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Всего задач', value: total,   Icon: CheckSquare,  iconCls: 'bg-blue-50',   iconColor: 'text-blue-500' },
          { label: 'Активных',    value: active,  Icon: Clock,        iconCls: 'bg-amber-50',  iconColor: 'text-amber-500' },
          { label: 'Выполнено',   value: done,    Icon: CheckCircle2, iconCls: 'bg-green-50',  iconColor: 'text-green-600' },
          { label: 'Просрочено',  value: overdue, Icon: AlertCircle,  iconCls: 'bg-red-50',    iconColor: 'text-red-500' },
        ].map(stat => {
          const Icon = stat.Icon
          return (
            <div key={stat.label} className="bg-white rounded-[20px] border border-slate-200/60 shadow-sm p-5 flex items-center gap-4">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${stat.iconCls}`}>
                <Icon className={stat.iconColor} style={{ width: 20, height: 20 }} />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#111827]">{stat.value}</p>
                <p className="text-xs text-[#64748B] font-medium mt-0.5">{stat.label}</p>
              </div>
            </div>
          )
        })}
      </div>

      {total === 0 ? (
        <div className="p-16 text-center rounded-[20px] bg-gradient-to-br from-green-50 to-emerald-50 border border-green-100">
          <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center mx-auto mb-4 shadow-md">
            <CheckSquare style={{ width: 24, height: 24 }} className="text-green-600" />
          </div>
          <h3 className="font-bold text-[#111827] text-lg">Нет задач</h3>
          <p className="text-[#64748B] text-sm mt-1">Создайте первую задачу для команды</p>
          <Link href="/tasks/new"
            className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 text-white rounded-xl text-sm font-semibold"
            style={{ background: 'linear-gradient(135deg, #16A34A, #22C55E)', boxShadow: '0 4px 16px rgba(22,163,74,0.35)' }}>
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
