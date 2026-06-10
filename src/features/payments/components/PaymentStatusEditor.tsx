'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Loader2 } from 'lucide-react'
import { updatePaymentStatusAction } from '@/features/payments/actions/payments.actions'
import type { PaymentStatus } from '@/types/database'

const STATUS_OPTIONS: { value: PaymentStatus; label: string; color: string }[] = [
  { value: 'pending',   label: 'Ожидает оплату',  color: 'text-yellow-700 bg-amber-50' },
  { value: 'paid',      label: 'Оплачен',          color: 'text-green-700 bg-green-50' },
  { value: 'partial',   label: 'Частично',         color: 'text-blue-700 bg-blue-50' },
  { value: 'overdue',   label: 'Просрочен',        color: 'text-red-700 bg-red-50' },
  { value: 'cancelled', label: 'Отменён',          color: 'text-slate-600 bg-slate-50' },
]

export function PaymentStatusEditor({
  paymentId,
  currentStatus,
}: {
  paymentId: string
  currentStatus: PaymentStatus
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<PaymentStatus>(currentStatus)
  const [isPending, startTransition] = useTransition()

  const current = STATUS_OPTIONS.find(s => s.value === status) ?? STATUS_OPTIONS[0]

  const handleSelect = (newStatus: PaymentStatus) => {
    setOpen(false)
    if (newStatus === status) return
    const prev = status
    setStatus(newStatus) // optimistic
    startTransition(async () => {
      const result = await updatePaymentStatusAction(paymentId, newStatus)
      if (result.success) {
        router.refresh()
      } else {
        setStatus(prev) // rollback
      }
    })
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen(o => !o)}
        disabled={isPending}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-semibold transition whitespace-nowrap ${current.color} ${isPending ? 'opacity-60 cursor-not-allowed' : 'hover:opacity-80 cursor-pointer'}`}
      >
        {isPending
          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
          : <>{current.label}<ChevronDown className="w-3 h-3" /></>
        }
      </button>

      {open && !isPending && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 min-w-44 overflow-hidden py-1">
            {STATUS_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => handleSelect(opt.value)}
                className={`w-full px-4 py-2.5 text-left text-sm transition hover:bg-slate-50 flex items-center gap-2.5 ${opt.value === status ? 'font-semibold' : 'font-medium text-slate-700'}`}
              >
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${opt.color.split(' ')[1]}`} />
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
