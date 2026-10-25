'use client'

import React, { useState } from 'react'
import { CheckSquare, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { updateTaskStatusAction } from '../actions/tasks.actions'
import { KanbanBoard } from '@/components/kanban/KanbanBoard'
import Link from 'next/link'
import { STAGE_COLORS } from '@/lib/design/stageColors'
import type { TaskRow } from './TasksView'
import { formatDateCompact } from '@/lib/utils'

const columns = [
  { status: 'todo', label: 'К выполнению', ...STAGE_COLORS.gray },
  { status: 'in_progress', label: 'В работе', ...STAGE_COLORS.blue },
  { status: 'done', label: 'Выполнено', ...STAGE_COLORS.green },
  { status: 'cancelled', label: 'Отменено', ...STAGE_COLORS.red },
]
const priorityColors: Record<string, string> = { low: 'bg-[var(--hp-neutral-tint)] text-[var(--hp-sub)]', medium: 'bg-[var(--hp-warn-tint)] text-[var(--hp-warn)]', high: 'bg-[var(--hp-danger-tint)] text-[var(--hp-danger)]' }
const priorityLabels: Record<string, string> = { low: 'Низкий', medium: 'Средний', high: 'Высокий' }

/** Сколько карточек показывать в закрытых колонках, пока их не развернули. */
const CLOSED_PREVIEW = 5
const CLOSED = new Set(['done', 'cancelled'])

export function TasksKanbanBoard({ tasks: initialTasks }: { tasks: TaskRow[] }) {
  const [isDragging, setIsDragging] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  return <KanbanBoard<TaskRow> items={initialTasks} columns={columns} onDragStateChange={setIsDragging} onStatusChange={(id, status) => updateTaskStatusAction(id, status)} boardClassName="flex gap-4 min-w-max lg:grid lg:grid-cols-4 lg:min-w-0" canDrop={task => columns.some(column => column.status === task.status)} renderColumn={(column, tasks, isOver) => {
    const config = columns.find(item => item.status === column.status)
    return <div key={column.status} className={`w-[82vw] sm:w-72 lg:w-auto border-t-2 ${config?.color ?? ''} border border-border flex flex-col transition-colors ${isOver ? 'bg-accent/60 border-primary/30' : 'bg-card'}`}><div className="p-4 border-b border-border flex items-center justify-between"><div className="flex items-center gap-2"><CheckSquare className="w-4 h-4 text-muted-foreground" /><span className="font-semibold text-foreground text-sm">{column.label}</span></div><span className={`text-xs px-2 py-0.5 rounded-[var(--hp-radius-badge)] font-medium ${config?.badge ?? ''}`}>{tasks.length}</span></div><div className="p-3 space-y-2 min-h-48 flex-1">{tasks.length === 0 ? <div className={`text-center py-8 text-[12.5px] ${isOver ? 'text-primary font-medium' : 'text-[var(--hp-tertiary)]'}`}>{isOver ? 'Перетащите сюда' : column.status === 'todo' ? <Link href="/tasks/new" className="hover:text-[var(--hp-accent)]">+ Добавить задачу</Link> : 'Нет задач'}</div> : (CLOSED.has(column.status) && !expanded[column.status] ? tasks.slice(0, CLOSED_PREVIEW) : tasks).map(task => <div key={task.id} draggable onDragStart={event => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', task.id) }} className="bg-background border border-border p-3 transition-all cursor-move select-none"><div className="flex items-start justify-between gap-2"><Link href={`/tasks/${task.id}`} className="text-sm font-medium text-foreground hover:text-primary transition-colors line-clamp-2 flex-1" onClick={event => { if (isDragging) event.preventDefault() }}>{task.title}</Link>{task.priority && !CLOSED.has(task.status) && <span className={`text-xs px-2 py-0.5 rounded-[var(--hp-radius-badge)] font-medium shrink-0 ${priorityColors[task.priority]}`}>{priorityLabels[task.priority]}</span>}</div>{task.description && <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{task.description}</p>}<div className="flex items-center gap-3 mt-2.5">{task.deadline && <div className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="w-3 h-3" />{formatDateCompact(task.deadline)}</div>}{task.assigneeName && <div className="flex items-center gap-1 text-xs text-muted-foreground ml-auto"><div className="w-4 h-4 rounded-[var(--hp-radius)] bg-primary/20 flex items-center justify-center shrink-0"><span className="text-primary text-[9px] font-bold">{task.assigneeName.charAt(0).toUpperCase()}</span></div><span className="truncate max-w-16">{task.assigneeName.split(' ')[0]}</span></div>}</div></div>)}{CLOSED.has(column.status) && tasks.length > CLOSED_PREVIEW && <button type="button" onClick={() => setExpanded(state => ({ ...state, [column.status]: !state[column.status] }))} className="w-full py-2 text-[12.5px] font-semibold text-[var(--hp-sub)] border border-dashed border-[var(--hp-border)] hover:text-[var(--hp-ink)] hover:border-[var(--hp-sub)] transition-colors">{expanded[column.status] ? 'Свернуть' : `Показать все (${tasks.length})`}</button>}</div></div>
  }} />
}
