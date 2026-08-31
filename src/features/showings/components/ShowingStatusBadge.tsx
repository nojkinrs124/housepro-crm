'use client'

const STATUS_CONFIG = {
  planned:   { label: 'Запланирован', color: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Проведён',     color: 'bg-emerald-100 text-emerald-700' },
  cancelled: { label: 'Отменён',      color: 'bg-slate-100 text-[var(--hp-sub)]' },
  no_show:   { label: 'Не явились',   color: 'bg-red-100 text-red-600' },
} as const

export function ShowingStatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]
    ?? { label: status, color: 'bg-gray-100 text-gray-600' }
  return (
    <span className={`inline-flex items-center text-xs font-medium px-2.5 py-0.5 rounded-full ${cfg.color}`}>
      {cfg.label}
    </span>
  )
}
