'use client'

import React, { useState, useRef } from 'react'
import { CheckSquare, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { STAGE_COLORS } from '@/lib/design/stageColors'

const columns = [
 { status: 'todo', label: 'К выполнению', ...STAGE_COLORS.gray },
 { status: 'in_progress', label: 'В работе', ...STAGE_COLORS.blue },
 { status: 'done', label: 'Выполнено', ...STAGE_COLORS.green },
 { status: 'cancelled', label: 'Отменено', ...STAGE_COLORS.red },
]

const priorityColors: Record<string, string> = {
 low: 'bg-gray-100 text-gray-600',
 medium: 'bg-yellow-100 text-yellow-700',
 high: 'bg-red-100 text-red-700',
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
 const [dragOverCol, setDragOverCol] = useState<string | null>(null)
 const isDragging = useRef(false)

 const byStatus = (status: string) => tasks.filter(t => t.status === status)

 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 const handleDragStart = (e: React.DragEvent, task: any) => {
 isDragging.current = true
 setDraggedTask(task)
 e.dataTransfer.effectAllowed = 'move'
 }

 const handleDragOver = (e: React.DragEvent, status: string) => {
 e.preventDefault()
 e.dataTransfer.dropEffect = 'move'
 setDragOverCol(status)
 }

 const handleDragLeave = (e: React.DragEvent) => {
 const rel = e.relatedTarget as Node | null
 if (!e.currentTarget.contains(rel)) setDragOverCol(null)
 }

 const handleDrop = async (e: React.DragEvent, newStatus: string) => {
 e.preventDefault()
 setDragOverCol(null)
 if (!draggedTask) return
 if (draggedTask.status === newStatus) { setDraggedTask(null); isDragging.current = false; return }

 const prevStatus = draggedTask.status
 setTasks(prev => prev.map(t => t.id === draggedTask.id ? { ...t, status: newStatus } : t))

 const supabase = createClient()
 const { error } = await supabase.from('tasks').update({ status: newStatus }).eq('id', draggedTask.id)
 if (error) setTasks(prev => prev.map(t => t.id === draggedTask.id ? { ...t, status: prevStatus } : t))

 setDraggedTask(null)
 isDragging.current = false
 }

 const handleDragEnd = () => {
 setDraggedTask(null)
 setDragOverCol(null)
 isDragging.current = false
 }

 return (
 <div className="overflow-x-auto pb-4 -mx-4 px-4 md:mx-0 md:px-0 lg:overflow-visible lg:pb-0"
 style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
 <div className="flex gap-4 min-w-max lg:grid lg:grid-cols-4 lg:min-w-0">
 {columns.map((col) => {
 const colTasks = byStatus(col.status)
 const isOver = dragOverCol === col.status
 return (
 <div
 key={col.status}
 className={`w-[82vw] sm:w-72 lg:w-auto border-t-2 ${col.color} border border-border flex flex-col transition-colors ${isOver ? 'bg-accent/60 border-primary/30' : 'bg-card'}`}
 style={{ scrollSnapAlign: 'start' }}
 onDragOver={(e) => handleDragOver(e, col.status)}
 onDragLeave={handleDragLeave}
 onDrop={(e) => handleDrop(e, col.status)}
 >
 <div className="p-4 border-b border-border flex items-center justify-between">
 <div className="flex items-center gap-2">
 <CheckSquare className="w-4 h-4 text-muted-foreground" />
 <span className="font-semibold text-foreground text-sm">{col.label}</span>
 </div>
 <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${col.badge}`}>
 {colTasks.length}
 </span>
 </div>

 <div className="p-3 space-y-2 min-h-48 flex-1">
 {colTasks.length === 0 ? (
 <div className={`text-center py-8 text-xs transition-colors ${isOver ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
 {isOver ? 'Перетащите сюда' : 'Нет задач'}
 </div>
 ) : (
 colTasks.map((task) => (
 <div
 key={task.id}
 draggable
 onDragStart={(e) => handleDragStart(e, task)}
 onDragEnd={handleDragEnd}
 className={`bg-background border border-border p-3 hover:shadow-sm transition-all cursor-move select-none ${
 draggedTask?.id === task.id ? 'opacity-40 scale-95' : ''
 }`}
 >
 <div className="flex items-start justify-between gap-2">
 <Link
 href={`/tasks/${task.id}`}
 className="text-sm font-medium text-foreground hover:text-primary transition-colors line-clamp-2 flex-1"
 onClick={e => { if (isDragging.current) e.preventDefault() }}
 >
 {task.title}
 </Link>
 {task.priority && (
 <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${priorityColors[task.priority]}`}>
 {priorityLabels[task.priority]}
 </span>
 )}
 </div>
 {task.description && (
 <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{task.description}</p>
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
