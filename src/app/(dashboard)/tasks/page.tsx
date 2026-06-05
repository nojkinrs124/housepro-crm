import { createClient } from '@/lib/supabase/server'
import { Plus, CheckSquare, AlertCircle, Clock, CheckCircle2, XCircle } from 'lucide-react'
import Link from 'next/link'
import { TasksKanbanBoard } from '@/features/tasks/components/TasksKanban'

const cardStyle = {
  background: '#ffffff',
  borderRadius: '20px',
  border: '1px solid rgba(214,219,235,0.6)',
  boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.05)',
}

export default async function TasksPage() {
  const supabase = await createClient()
  const { data: tasks } = await supabase
    .from('tasks')
    .select('*, assignee:users(full_name)')
    .order('created_at', { ascending: false })

  const total    = tasks?.length ?? 0
  const active   = (tasks ?? []).filter(t => !['done','cancelled'].includes(t.status)).length
  const done     = (tasks ?? []).filter(t => t.status === 'done').length
  const overdue  = (tasks ?? []).filter(t =>
    t.deadline && new Date(t.deadline) < new Date() && !['done','cancelled'].includes(t.status)
  ).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#111827] tracking-tight">Задачи</h1>
          <p className="text-[#64748B] mt-1 text-sm">{total} задач · {active} активных</p>
        </div>
        <Link href="/tasks/new"
          className="flex items-center gap-2 px-4 py-2.5 text-white rounded-[12px] text-sm font-semibold"
          style={{
            background: 'linear-gradient(135deg, #16A34A, #22C55E)',
            boxShadow: '0 2px 8px rgba(22,163,74,0.3)',
          }}>
          <Plus style={{ width: 16, height: 16 }} />
          Новая задача
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Всего задач',   value: total,   icon: CheckSquare,  iconBg: '#EFF6FF', iconColor: '#3B82F6' },
          { label: 'Активных',      value: active,  icon: Clock,        iconBg: '#FFFBEB', iconColor: '#D97706' },
          { label: 'Выполнено',     value: done,    icon: CheckCircle2, iconBg: '#F0FDF4', iconColor: '#16A34A' },
          { label: 'Просрочено',    value: overdue, icon: AlertCircle,  iconBg: '#FEF2F2', iconColor: '#DC2626' },
        ].map(stat => {
          const Icon = stat.icon
          return (
            <div key={stat.label} style={cardStyle} className="p-5 flex items-center gap-4">
              <div className="w-11 h-11 rounded-[12px] flex items-center justify-center shrink-0"
                style={{ background: stat.iconBg }}>
                <Icon style={{ width: 20, height: 20, color: stat.iconColor }} />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#111827]">{stat.value}</p>
                <p className="text-xs text-[#64748B] font-medium mt-0.5">{stat.label}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Kanban */}
      <TasksKanbanBoard tasks={tasks ?? []} />

      {(!tasks || tasks.length === 0) && (
        <div className="p-16 text-center rounded-[20px]"
          style={{
            background: 'linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 50%, #F0FDF4 100%)',
            border: '1px solid rgba(34,197,94,0.2)',
          }}>
          <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center mx-auto mb-4"
            style={{ boxShadow: '0 4px 12px rgba(34,197,94,0.2)' }}>
            <CheckSquare style={{ width: 24, height: 24, color: '#16A34A' }} />
          </div>
          <h3 className="font-bold text-[#111827] text-lg">Нет задач</h3>
          <p className="text-[#64748B] text-sm mt-1">Создайте первую задачу для команды</p>
          <Link href="/tasks/new"
            className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 text-white rounded-[12px] text-sm font-semibold"
            style={{ background: 'linear-gradient(135deg, #16A34A, #22C55E)', boxShadow: '0 2px 8px rgba(22,163,74,0.3)' }}>
            <Plus style={{ width: 16, height: 16 }} />
            Создать задачу
          </Link>
        </div>
      )}
    </div>
  )
}
