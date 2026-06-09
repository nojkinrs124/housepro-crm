'use client'

import React, { useState } from 'react'
import { CheckSquare, Clock, AlertCircle, ExternalLink } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

const columns = [
  { status: 'todo',        label: 'К выполнению', color: 'border-t-gray-300' },
  { status: 'in_progress', label: 'В работе',     color: 'border-t-blue-400' },
  { status: 'done',        label: 'Выполнено',    color: 'border-t-green-400' },
  { status: 'cancelled',   label: 'Отменено',     color: 'border-t-red-300' },
]

const priorityColors: Record<string, string> = {
  low:    'bg-gray-100 text-gray-600',
  medium: 'bg-yellow-100 text-yellow-700',
  high:   'bg-red-100 text-red-700',
}

const priorityLabels: Record<string, string> = {
  low: 'Низкий', medium: 'Средний', high: 'Высокий',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function TasksKanbanBoard({ tasks: initialTasks }: { tasks: any[] }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [tasks, setTasks] = useState<any[]>(initialTasks)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [draggedTask, setDraggedTask] = useState<any | null>(null)

  const byStatus = (status: string) => tasks.filter(t => t.status === status)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleDragStart = (e: React.DragEvent, task: any) => {
    setDraggedTask(task)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault()
    if (!draggedTask || draggedTask.status === newStatus) {
      setDraggedTask(null)
      return
    }

    // Optimistic update
    setTasks(prev => prev.map(t => t.id === draggedTask.id ? { ...t, status: newStatus } : t))

    const supabase = createClient()
    const { error } = await supabase
      .from('tasks')
      .update({ status: newStatus })
      .eq('id', draggedTask.id)

    if (error) {
      // Rollback
      setTasks(prev => prev.map(t => t.id === draggedTask.id ? { ...t, status: draggedTask.status } : t))
    }

    setDraggedTask(null)
  }

  return (
    <div className="overflow-x-auto pb-4 -mx-4 px-4 md:mx-0 md:px-0 lg:overflow-visible lg:pb-0"
      style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
      <div className="flex gap-4 min-w-max lg:grid lg:grid-cols-4 lg:min-w-0">
      {columns.map((col) => {
        const colTasks = byStatus(col.status)
        return (
          <div
            key={col.status}
            className={`w-[82vw] sm:w-72 lg:w-auto bg-card border-t-2 ${col.color} border border-border rounded-2xl overflow-hidden`}
            style={{ scrollSnapAlign: 'start' } as React.CSSProperties}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, col.status)}
          >
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
                    draggable
                    onDragStart={(e) => handleDragStart(e, task)}
                    onDragEnd={() => setDraggedTask(null)}
                    className={`bg-background border border-border rounded-xl p-3 hover:shadow-sm transition-all cursor-move ${
                      draggedTask?.id === task.id ? 'opacity-50' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/tasks/${task.id}`} className="text-sm font-medium text-foreground hover:text-primary transition-colors line-clamp-2 flex-1" onClick={e => e.stopPropagation()}>
                        {task.title}
                      </Link>
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
                      {task.assignee?.full_name && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
                          <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                            <span className="text-primary text-[9px] font-bold">
                              {task.assignee.full_name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <span className="truncate max-w-16">{task.assignee.full_name.split(' ')[0]}</span>
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
    </div>
  )
}
