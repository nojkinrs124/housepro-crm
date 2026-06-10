'use client'

import { useState, useTransition } from 'react'
import { updateDealStatusAction } from '@/features/deals/actions/deals.actions'
import { ChevronDown, Loader2 } from 'lucide-react'

const statuses = [
  { value: 'new',         label: 'Новая',        color: 'bg-blue-100 text-blue-700' },
  { value: 'showing',     label: 'Показ',        color: 'bg-yellow-100 text-yellow-700' },
  { value: 'negotiation', label: 'Переговоры',   color: 'bg-orange-100 text-orange-700' },
  { value: 'contract',    label: 'Договор',      color: 'bg-purple-100 text-purple-700' },
  { value: 'payment',     label: 'Оплата',       color: 'bg-cyan-100 text-cyan-700' },
  { value: 'completed',   label: 'Завершена',    color: 'bg-green-100 text-green-700' },
  { value: 'cancelled',   label: 'Отменена',     color: 'bg-gray-100 text-gray-500' },
]

export function DealStatusSelector({ dealId, currentStatus }: { dealId: string; currentStatus: string }) {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState(currentStatus)
  const [isPending, startTransition] = useTransition()

  const current = statuses.find(s => s.value === status) ?? statuses[0]

  const handleSelect = (value: string) => {
    setOpen(false)
    if (value === status) return
    const prev = status
    setStatus(value)
    startTransition(async () => {
      const res = await updateDealStatusAction(dealId, value)
      if (res?.error) setStatus(prev)
    })
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        disabled={isPending}
        className={`inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-xl font-medium transition hover:opacity-80 ${current.color} ${isPending ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
        {current.label}
        <ChevronDown className="w-3.5 h-3.5" />
      </button>

      {open && !isPending && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-xl shadow-lg z-50 min-w-44 overflow-hidden">
            {statuses.map(s => (
              <button
                key={s.value}
                onClick={() => handleSelect(s.value)}
                className={`w-full px-4 py-2.5 text-left text-sm transition hover:bg-muted flex items-center gap-2 ${s.value === status ? 'font-semibold' : ''}`}
              >
                <span className={`w-2 h-2 rounded-full ${s.color.split(' ')[0]}`} />
                {s.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
