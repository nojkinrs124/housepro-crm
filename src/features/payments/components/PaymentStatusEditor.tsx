'use client'

import { useState } from 'react'
import { ChevronDown, Loader2 } from 'lucide-react'
import { updatePaymentStatusAction } from '@/features/payments/actions/payments.actions'
import type { PaymentStatus } from '@/types/database'

const STATUS_OPTIONS: { value: PaymentStatus; label: string; color: string }[] = [
  { value: 'pending',   label: 'Ожидает оплату',    color: 'text-yellow-600 bg-yellow-50' },
  { value: 'paid',      label: 'Оплачен',            color: 'text-green-600 bg-green-50' },
  { value: 'partial',   label: 'Частично оплачен',   color: 'text-blue-600 bg-blue-50' },
  { value: 'overdue',   label: 'Просрочен',          color: 'text-red-600 bg-red-50' },
  { value: 'cancelled', label: 'Отменен',            color: 'text-gray-600 bg-gray-50' },
]

export function PaymentStatusEditor({
  paymentId,
  currentStatus,
}: {
  paymentId: string
  currentStatus: PaymentStatus
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const currentOption = STATUS_OPTIONS.find(s => s.value === currentStatus)
  const label = currentOption?.label || currentStatus

  const handleStatusChange = async (newStatus: PaymentStatus) => {
    setLoading(true)
    try {
      const result = await updatePaymentStatusAction(paymentId, newStatus)
      if (result.success) {
        setOpen(false)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        disabled={loading}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium transition ${
          currentOption?.color || 'text-gray-600 bg-gray-50'
        } ${loading ? 'opacity-60 cursor-not-allowed' : 'hover:opacity-80'}`}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <>
            {label}
            <ChevronDown className="w-3.5 h-3.5" />
          </>
        )}
      </button>

      {open && !loading && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full right-0 mt-1 bg-card border border-border rounded-lg shadow-xl z-50 min-w-44 overflow-hidden">
            {STATUS_OPTIONS.map(option => (
              <button
                key={option.value}
                onClick={() => handleStatusChange(option.value)}
                className="w-full px-3 py-2.5 text-left text-sm hover:bg-muted transition first:rounded-t-lg last:rounded-b-lg"
              >
                {option.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
