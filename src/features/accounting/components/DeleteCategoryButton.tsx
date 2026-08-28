'use client'

import { useTransition } from 'react'
import { deleteCategoryAction } from '../actions/categories.actions'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'

export function DeleteCategoryButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    if (!confirm('Удалить категорию? Транзакции без категории не потеряются.')) return
    startTransition(async () => {
      const res = await deleteCategoryAction(id)
      if (res && 'error' in res) toast.error(res.error)
      else toast.success('Категория удалена')
    })
  }

  return (
    <button
      onClick={handleDelete}
      disabled={isPending}
      className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
      title="Удалить"
    >
      <Trash2 style={{ width: 13, height: 13 }} />
    </button>
  )
}
