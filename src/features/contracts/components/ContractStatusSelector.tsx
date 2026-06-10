'use client'

import { useState, useTransition } from 'react'
import { ChevronDown, Loader2 } from 'lucide-react'
import { updateContractStatusAction } from '@/features/contracts/actions/contracts.actions'

const statuses = [
  { value: 'draft',     label: 'Черновик',  color: 'bg-gray-100 text-gray-600' },
  { value: 'generated', label: 'Создан',    color: 'bg-blue-100 text-blue-700' },
  { value: 'signed',    label: 'Подписан',  color: 'bg-purple-100 text-purple-700' },
  { value: 'completed', label: 'Завершён',  color: 'bg-green-100 text-green-700' },
  { value: 'cancelled', label: 'Отменён',   color: 'bg-red-100 text-red-600' },
]

export function ContractStatusSelector({ contractId, currentStatus }: { contractId: string; currentStatus: string }) {
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
      const res = await updateContractStatusAction(contractId, value)
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
        {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        {current.label}
        <ChevronDown className="w-3.5 h-3.5" />
      </button>

      {open && !isPending && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-xl shadow-lg z-50 min-w-40 overflow-hidden">
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
