/** Единственный словарь статусов договоров, безопасный для server/client imports. */
export const CONTRACT_STATUS_LABELS: Record<string, string> = {
  draft: 'Черновик', generated: 'Создан', signed: 'Подписан',
  completed: 'Завершён', cancelled: 'Отменён',
}

export const CONTRACT_STATUS_BADGES: Record<string, string> = {
  draft: 'bg-[var(--hp-neutral-tint)] text-[var(--hp-sub)]',
  generated: 'bg-[var(--hp-info-tint)] text-[var(--hp-info)]',
  signed: 'bg-[var(--hp-neutral-tint)] text-[var(--hp-sub)]',
  completed: 'bg-[var(--hp-good-tint)] text-[var(--hp-good)]',
  cancelled: 'bg-[var(--hp-danger-tint)] text-[var(--hp-danger)]',
}

export const CONTRACT_STATUS_DETAIL: Record<string, { label: string; cls: string }> = {
  draft: { label: 'черновик', cls: 'text-[var(--hp-tertiary)]' },
  generated: { label: 'создан', cls: 'text-[var(--hp-sub)]' },
  signed: { label: 'подписан', cls: 'text-[var(--hp-good)]' },
  completed: { label: 'завершён', cls: 'text-[var(--hp-good)]' },
  cancelled: { label: 'отменён', cls: 'text-[var(--hp-danger)]' },
}
