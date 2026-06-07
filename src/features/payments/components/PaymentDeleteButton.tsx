'use client'

import { useTransition } from 'react'
import { Trash2, Loader2 } from 'lucide-react'
import { deletePaymentAction } from '@/features/payments/actions/payments.actions'
import { toast } from 'sonner'

interface Props {
  paymentId: string
  contractId?: string
}

export function PaymentDeleteButton({ paymentId, contractId }: Props) {
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    if (!confirm('Удалить платёж? Это действие необратимо.')) return
    startTransition(async () => {
      const formData = new FormData()
      if (contractId) formData.append('contract_id', contractId)
      const result = await deletePaymentAction(paymentId)
      if (result?.error) {
        toast.error(result.error)
      }
      // redirect inside action on success
    })
  }

  return (
    <button
      onClick={handleDelete}
      disabled={isPending}
      className="flex items-center justify-center gap-2 w-full px-4 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 transition-all disabled:opacity-50"
    >
      {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
      Удалить платёж
    </button>
  )
}
