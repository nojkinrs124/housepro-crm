'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Circle, AlertCircle, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Task } from '@/types/database'

type RelationType = 'lead' | 'client' | 'owner' | 'deal' | 'property' | 'contract' | 'payment'

export function RelatedTasks({
  entityId,
  relationType,
}: {
  entityId: string
  relationType: RelationType
}) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadTasks = async () => {
      const supabase = createClient()
      const field = `${relationType}_id`

      const { data } = await supabase
        .from('tasks')
        .select('*')
        .eq(field, entityId)
        .order('created_at', { ascending: false })

      setTasks((data as Task[]) || [])
      setLoading(false)
    }

    loadTasks()
  }, [entityId, relationType])

  if (loading) return <div className="text-muted-foreground text-sm">Загрузка задач...</div>
  if (!tasks.length) return <div className="text-muted-foreground text-sm">Нет связанных задач</div>

  const statusIcon = (status: string) => {
    switch (status) {
      case 'done':
        return <CheckCircle2 className="w-4 h-4 text-green-600" />
      case 'in_progress':
        return <AlertCircle className="w-4 h-4 text-blue-600" />
      default:
        return <Circle className="w-4 h-4 text-gray-400" />
    }
  }

  return (
    <div className="space-y-2">
      {tasks.map(task => (
        <div
          key={task.id}
          className="flex items-start gap-3 p-3 bg-card border border-border rounded-lg hover:border-primary/30 transition"
        >
          {statusIcon(task.status)}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground break-words">{task.title}</p>
            {task.description && (
              <p className="text-xs text-muted-foreground mt-1">{task.description}</p>
            )}
            {task.deadline && (
              <p className="text-xs text-muted-foreground mt-1">
                ⏱️ {new Date(task.deadline).toLocaleDateString('ru-RU')}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-xs px-2 py-1 rounded-full bg-muted">
              {task.priority === 'high' ? '🔴' : task.priority === 'medium' ? '🟡' : '🟢'}{' '}
              {task.priority}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
