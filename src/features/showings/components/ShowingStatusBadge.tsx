'use client'

import { SHOWING_STATUS_LABELS } from '@/features/showings/config/showing-labels'

const STATUS_CONFIG = {
  planned:   { label: SHOWING_STATUS_LABELS.planned,   color: 'bg-[var(--hp-info-tint)] text-[var(--hp-info)]' },
  completed: { label: SHOWING_STATUS_LABELS.completed, color: 'bg-[var(--hp-good-tint)] text-[var(--hp-good)]' },
  cancelled: { label: SHOWING_STATUS_LABELS.cancelled, color: 'bg-[var(--hp-neutral-tint)] text-[var(--hp-sub)]' },
  no_show:   { label: SHOWING_STATUS_LABELS.no_show,   color: 'bg-[var(--hp-danger-tint)] text-[var(--hp-danger)]' },
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
