'use client'

import { useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { updateTaskStatusAction } from '@/features/tasks/actions/tasks.actions'
import { toast } from 'sonner'

const STATUSES = [
  { value: 'todo',        label: 'К выполнению', color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200',   dot: 'bg-blue-500' },
  { value: 'in_progress', label: 'В работе',     color: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200', dot: 'bg-yellow-500' },
  { value: 'done',        label: 'Выполнена',    color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200',  dot: 'bg-green-500' },
  { value: 'cancelled',   label: 'Отменена',     color: 'text-gray-600',   bg: 'bg-gray-50',   border: 'border-gray-200',   dot: 'bg-gray-400' },
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
      if (result?.error) {
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
            flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all disabled:opacity-50
            ${currentStatus === s.value
              ? `${s.bg} ${s.border} ${s.color} ring-2 ring-offset-1 ring-current`
              : 'bg-white border-[#E2E8F0] text-[#64748B] hover:border-[#CBD5E1] hover:bg-[#F8FAFC]'
            }
          `}
        >
          {isPending && currentStatus !== s.value ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <span className={`w-2 h-2 rounded-full ${currentStatus === s.value ? s.dot : 'bg-[#CBD5E1]'}`} />
          )}
          {s.label}
        </button>
      ))}
    </div>
  )
}
