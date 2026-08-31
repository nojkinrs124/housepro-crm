'use client'

import { useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { updateTaskStatusAction } from '@/features/tasks/actions/tasks.actions'
import { toast } from 'sonner'

const STATUSES = [
 { value: 'todo', label: 'К выполнению', color: 'text-[var(--hp-info)]', bg: 'bg-[var(--hp-info-tint)]', border: 'border-[var(--hp-border)]', dot: 'bg-[var(--hp-info)]' },
 { value: 'in_progress', label: 'В работе', color: 'text-[var(--hp-warn)]', bg: 'bg-[var(--hp-warn-tint)]', border: 'border-[var(--hp-border)]', dot: 'bg-[var(--hp-warn)]' },
 { value: 'done', label: 'Выполнена', color: 'text-[var(--hp-good)]', bg: 'bg-[var(--hp-good-tint)]', border: 'border-[var(--hp-border)]', dot: 'bg-[var(--hp-accent)]' },
 { value: 'cancelled', label: 'Отменена', color: 'text-[var(--hp-sub)]', bg: 'bg-[var(--hp-neutral-tint)]', border: 'border-[var(--hp-border)]', dot: 'bg-[var(--hp-neutral-tint)]' },
]

interface Props {
 taskId: string
 currentStatus: string
}

export function TaskStatusSelect({ taskId, currentStatus }: Props) {
 const [isPending, startTransition] = useTransition()

 function handleChange(newStatus: string) {
 if (newStatus === currentStatus) return
 startTransition(async () => {
 const result = await updateTaskStatusAction(taskId, newStatus)
 if (result && 'error' in result) {
 toast.error(result.error)
 } else {
 toast.success('Статус обновлён')
 }
 })
 }

 return (
 <div className="flex flex-wrap gap-2">
 {STATUSES.map(s => (
 <button
 key={s.value}
 onClick={() => handleChange(s.value)}
 disabled={isPending}
 className={`
 flex items-center gap-2 px-4 py-2 text-sm font-medium border transition-all disabled:opacity-50
 ${currentStatus === s.value
 ? `${s.bg} ${s.border} ${s.color} ring-2 ring-offset-1 ring-current`
 : 'bg-[var(--hp-surface)] border-border text-muted-foreground hover:border-[#DFE4D6] hover:bg-background'
 }
 `}
 >
 {isPending && currentStatus !== s.value ? (
 <Loader2 className="w-3 h-3 animate-spin" />
 ) : (
 <span className={`w-2 h-2 rounded-full ${currentStatus === s.value ? s.dot : 'bg-[#DFE4D6]'}`} />
 )}
 {s.label}
 </button>
 ))}
 </div>
 )
}
