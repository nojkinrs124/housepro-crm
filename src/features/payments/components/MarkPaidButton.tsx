'use client'

import { useTransition } from 'react'
import { CheckCircle, Loader2 } from 'lucide-react'
import { markPaidAction } from '../actions/payments.actions'

interface Props {
  paymentId: string
  status: string
}

export function MarkPaidButton({ paymentId, status }: Props) {
  const [isPending, startTransition] = useTransition()

  if (status === 'paid') return null

  return (
    <button
      onClick={() => startTransition(async () => { await markPaidAction(paymentId) })}
      disabled={isPending}
      title="Отметить оплаченным"
      className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg transition-all disabled:opacity-50"
    >
      {isPending
        ? <Loader2 className="w-3 h-3 animate-spin" />
        : <CheckCircle className="w-3 h-3" />
      }
      Оплачено
    </button>
  )
}
