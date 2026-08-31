'use client'

import { useTransition } from 'react'
import { deleteRecurringRuleAction } from '../actions/recurring.actions'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'

export function DeleteRecurringButton({ id }: { id: string }) {
 const [isPending, startTransition] = useTransition()

 function handleDelete() {
 if (!confirm('Удалить правило повторения? Уже созданные транзакции останутся.')) return
 startTransition(async () => {
 const res = await deleteRecurringRuleAction(id)
 if (res && 'error' in res) toast.error(res.error)
 else toast.success('Правило удалено')
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
