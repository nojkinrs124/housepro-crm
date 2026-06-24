'use client'

import { useTransition } from 'react'
import { deleteTransactionAction } from '../actions/accounting.actions'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface Props {
  id: string
  redirectAfter?: string
}

export function DeleteTransactionButton({ id, redirectAfter }: Props) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleDelete() {
    if (!confirm('Удалить транзакцию?')) return
    startTransition(async () => {
      const res = await deleteTransactionAction(id)
      if (res?.error) {
        toast.error(res.error)
      } else {
        toast.success('Транзакция удалена')
        router.push(redirectAfter ?? '/accounting')
      }
    })
  }

  return (
    <button
      onClick={handleDelete}
      disabled={isPending}
      className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
      title="Удалить"
    >
      <Trash2 style={{ width: 14, height: 14 }} />
    </button>
  )
}
