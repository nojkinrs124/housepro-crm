'use client'

import { useTransition } from 'react'
import { Trash2, Loader2 } from 'lucide-react'
import { deleteTaskAction } from '@/features/tasks/actions/tasks.actions'
import { toast } from 'sonner'

export function TaskDeleteButton({ taskId }: { taskId: string }) {
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    if (!confirm('Удалить задачу? Это действие необратимо.')) return
    startTransition(async () => {
      const result = await deleteTaskAction(taskId)
      if (result?.error) {
        toast.error(result.error)
      }
      // redirect happens inside action on success
    })
  }

  return (
    <button
      onClick={handleDelete}
      disabled={isPending}
      className="flex items-center justify-center gap-2 w-full px-4 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 transition-all disabled:opacity-50"
    >
      {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
      Удалить задачу
    </button>
  )
}
