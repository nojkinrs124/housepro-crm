'use client'

const STATUS_CONFIG = {
  planned:   { label: 'Запланирован', color: 'bg-[var(--hp-info-tint)] text-[var(--hp-info)]' },
  completed: { label: 'Проведён',     color: 'bg-[var(--hp-good-tint)] text-[var(--hp-good)]' },
  cancelled: { label: 'Отменён',      color: 'bg-[var(--hp-neutral-tint)] text-[var(--hp-sub)]' },
  no_show:   { label: 'Не явились',   color: 'bg-[var(--hp-danger-tint)] text-[var(--hp-danger)]' },
} as const

export function ShowingStatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]
    ?? { label: status, color: 'bg-[var(--hp-neutral-tint)] text-[var(--hp-sub)]' }
  return (
    <span className={`inline-flex items-center text-xs font-medium px-2.5 py-0.5 rounded-[var(--hp-radius-badge)] ${cfg.color}`}>
      {cfg.label}
    </span>
  )
}
