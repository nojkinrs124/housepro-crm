import { createClient } from '@/lib/supabase/server'
import { CheckSquare, Plus, Clock, AlertCircle } from 'lucide-react'
import Link from 'next/link'

const priorityColors: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-red-100 text-red-700',
}

const priorityLabels: Record<string, string> = {
  low: 'Низкий',
  medium: 'Средний',
  high: 'Высокий',
}

const columns = [
  { status: 'todo', label: 'К выполнению', color: 'border-t-gray-300' },
  { status: 'in_progress', label: 'В работе', color: 'border-t-blue-400' },
  { status: 'done', label: 'Выполнено', color: 'border-t-green-400' },
]

export default async function TasksPage() {
  const supabase = await createClient()
  const { data: tasks } = await supabase
    .from('tasks')
    .select('*, assignee:users(full_name)')
    .order('created_at', { ascending: false })

  const tasksByStatus = (status: string) =>
    (tasks ?? []).filter((t) => t.status === status)

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Задачи</h1>
          <p className="text-muted-foreground mt-1">{tasks?.length ?? 0} задач</p>
        </div>
        <Link
          href="/tasks/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-all"
        >
          <Plus className="w-4 h-4" />
          Новая задача
        </Link>
      </div>

      {/* Kanban */}
      <div className="grid lg:grid-cols-3 gap-4">
        {columns.map((col) => {
          const colTasks = tasksByStatus(col.status)
          return (
            <div key={col.status} className={`bg-card border-t-2 ${col.color} border border-border rounded-2xl overflow-hidden`}>
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-muted-foreground" />
                  <span className="font-semibold text-foreground text-sm">{col.label}</span>
                </div>
                <span className="bg-muted text-muted-foreground text-xs px-2 py-0.5 rounded-full font-medium">
                  {colTasks.length}
                </span>
              </div>
              <div className="p-3 space-y-2 min-h-48">
                {colTasks.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    Нет задач
                  </div>
                ) : (
                  colTasks.map((task) => (
                    <div
                      key={task.id}
                      className="bg-background border border-border rounded-xl p-3 hover:shadow-sm transition-all cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-foreground">{task.title}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${priorityColors[task.priority]}`}>
                          {priorityLabels[task.priority]}
                        </span>
                      </div>
                      {task.description && (
                        <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">
                          {task.description}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-2.5">
                        {task.deadline && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            {new Date(task.deadline).toLocaleDateString('ru-RU')}
                          </div>
                        )}
                        {(task.assignee as { full_name?: string } | null)?.full_name && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
                            <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center">
                              <span className="text-primary text-xs">
                                {(task.assignee as { full_name: string }).full_name.charAt(0)}
                              </span>
                            </div>
                            {(task.assignee as { full_name: string }).full_name}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>

      {(!tasks || tasks.length === 0) && (
        <div className="bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 rounded-2xl p-8 text-center">
          <AlertCircle className="w-10 h-10 text-primary mx-auto mb-3 opacity-60" />
          <h3 className="font-semibold text-foreground">Нет задач</h3>
          <p className="text-muted-foreground text-sm mt-1">Создайте первую задачу для команды</p>
          <Link
            href="/tasks/new"
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-all"
          >
            <Plus className="w-4 h-4" />
            Создать задачу
          </Link>
        </div>
      )}
    </div>
  )
}
