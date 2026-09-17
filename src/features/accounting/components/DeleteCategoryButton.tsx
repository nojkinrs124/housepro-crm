'use client'

import { useTransition } from 'react'
import { deleteCategoryAction } from '../actions/categories.actions'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { confirmDialog } from '@/components/forms/ConfirmDialog'

export function DeleteCategoryButton({ id }: { id: string }) {
 const [isPending, startTransition] = useTransition()

 async function handleDelete() {
 if (!(await confirmDialog('Удалить категорию? Операции без категории не потеряются.'))) return
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
 className="p-1.5 text-[var(--hp-tertiary)] hover:text-[var(--hp-danger)] hover:bg-[var(--hp-danger-tint)] transition-colors disabled:opacity-40"
 title="Удалить"
 >
 <Trash2 style={{ width: 13, height: 13 }} />
 </button>
 )
}
