'use client'

import { useTransition } from 'react'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

export function PaymentMarkPaidButton({ paymentId }: { paymentId: string }) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleMarkPaid() {
    startTransition(async () => {
      const supabase = createClient()

      // Idempotent: проверяем текущий статус перед обновлением
      const { data: current } = await supabase
        .from('payments')
        .select('payment_status')
        .eq('id', paymentId)
        .single()

      if (current?.payment_status === 'paid') {
        toast.info('Платёж уже отмечен как оплаченный')
        return
      }

      const { error } = await supabase
        .from('payments')
        .update({
          payment_status: 'paid',
          payment_date: new Date().toISOString(),
        })
        .eq('id', paymentId)
        .neq('payment_status', 'paid') // дополнительная защита от race condition

      if (error) {
        toast.error('Ошибка при обновлении статуса')
        return
      }

      toast.success('Платёж отмечен как оплаченный')
      router.refresh()
    })
  }

  return (
    <button
      onClick={handleMarkPaid}
      disabled={isPending}
      className="flex items-center justify-center gap-2 w-full px-4 py-2 text-sm font-semibold text-green-700 bg-green-50 border border-green-200 rounded-xl hover:bg-green-100 transition-all disabled:opacity-50"
    >
      {isPending
        ? <Loader2 className="w-4 h-4 animate-spin" />
        : <CheckCircle2 className="w-4 h-4" />
      }
      Отметить оплаченным
    </button>
  )
}
