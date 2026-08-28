'use client'

import { useTransition } from 'react'
import { Trash2, Loader2 } from 'lucide-react'
import { deleteTransactionAction } from '../actions/accounting.actions'
import { toast } from 'sonner'

export function DeleteContractTransactionButton({ transactionId }: { transactionId: string }) {
 const [isPending, startTransition] = useTransition()

 return (
 <button
 onClick={() => {
 if (!confirm('Удалить платёж?')) return
 startTransition(async () => {
 const res = await deleteTransactionAction(transactionId)
 if (res && 'error' in res) toast.error(res.error)
 })
 }}
 disabled={isPending}
 title="Удалить"
 className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all disabled:opacity-50"
 >
 {isPending
 ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
 : <Trash2 className="w-3.5 h-3.5" />
 }
 </button>
 )
}
