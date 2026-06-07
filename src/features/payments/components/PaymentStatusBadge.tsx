'use client'

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  paid:      { label: 'Оплачен',    className: 'bg-white/25 text-white border-white/30' },
  pending:   { label: 'Ожидает',    className: 'bg-white/25 text-white border-white/30' },
  overdue:   { label: 'Просрочен',  className: 'bg-white/25 text-white border-white/30' },
  partial:   { label: 'Частично',   className: 'bg-white/25 text-white border-white/30' },
  cancelled: { label: 'Отменён',    className: 'bg-white/25 text-white border-white/30' },
}

export function PaymentStatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? STATUS_MAP.pending
  return (
    <span className={`px-3 py-1.5 text-xs font-semibold border rounded-lg ${s.className}`}>
      {s.label}
    </span>
  )
}
