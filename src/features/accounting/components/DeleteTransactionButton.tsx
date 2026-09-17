'use client'

import { useTransition } from 'react'
import { deleteTransactionAction } from '../actions/accounting.actions'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { confirmDialog } from '@/components/forms/ConfirmDialog'

interface Props {
 id: string
 redirectAfter?: string
}

export function DeleteTransactionButton({ id, redirectAfter }: Props) {
 const [isPending, startTransition] = useTransition()
 const router = useRouter()

 async function handleDelete() {
 if (!(await confirmDialog('Удалить операцию? Она пропадёт из отчёта и доходности объекта — отменить нельзя.'))) return
 startTransition(async () => {
 const res = await deleteTransactionAction(id)
 if (res && 'error' in res) {
 toast.error(res.error)
 } else {
 toast.success('Операция удалена')
 router.push(redirectAfter ?? '/accounting')
 }
 })
 }

 return (
 <button
 onClick={handleDelete}
 disabled={isPending}
 className="p-1.5 text-[var(--hp-tertiary)] hover:text-[var(--hp-danger)] hover:bg-[var(--hp-danger-tint)] transition-colors disabled:opacity-50"
 title="Удалить"
 >
 <Trash2 style={{ width: 14, height: 14 }} />
 </button>
 )
}
