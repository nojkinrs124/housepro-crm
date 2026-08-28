'use client'

import { useTransition } from 'react'
import { CheckCircle, Loader2 } from 'lucide-react'
import { completeTransactionAction } from '../actions/accounting.actions'

interface Props {
 transactionId: string
 status: string
}

export function CompleteTransactionButton({ transactionId, status }: Props) {
 const [isPending, startTransition] = useTransition()

 if (status === 'completed' || status === 'cancelled') return null

 return (
 <button
 onClick={() => startTransition(async () => { await completeTransactionAction(transactionId) })}
 disabled={isPending}
 title="Отметить оплаченным"
 className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 transition-all disabled:opacity-50"
 >
 {isPending
 ? <Loader2 className="w-3 h-3 animate-spin" />
 : <CheckCircle className="w-3 h-3" />
 }
 Оплачено
 </button>
 )
}
