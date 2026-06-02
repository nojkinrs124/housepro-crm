import { createClient } from '@/lib/supabase/server'
import { Plus, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { TasksKanbanBoard } from '@/features/tasks/components/TasksKanban'

export default async function TasksPage() {
  const supabase = await createClient()
  const { data: tasks } = await supabase
    .from('tasks')
    .select('*, assignee:users(full_name)')
    .order('created_at', { ascending: false })

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
      <TasksKanbanBoard tasks={tasks ?? []} />

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
