'use client'

import { useTransition } from 'react'
import { Trash2, Loader2 } from 'lucide-react'
import { deletePaymentAction } from '../actions/payments.actions'

export function DeletePaymentButton({ paymentId }: { paymentId: string }) {
  const [isPending, startTransition] = useTransition()

  return (
    <button
      onClick={() => {
        if (!confirm('Удалить платёж?')) return
        startTransition(async () => { await deletePaymentAction(paymentId) })
      }}
      disabled={isPending}
      title="Удалить"
      className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all disabled:opacity-50"
    >
      {isPending
        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
        : <Trash2 className="w-3.5 h-3.5" />
      }
    </button>
  )
}
