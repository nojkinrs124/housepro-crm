/** Единый словарь статусов контактов, без client/server runtime dependencies. */
export const CONTACT_STATUS_LABELS: Record<string, string> = {
  new: 'Новый', active: 'Активный', vip: 'VIP', inactive: 'Неактивный',
}

export const CONTACT_STATUS_BADGES: Record<string, string> = {
  new: 'hp-badge-info', active: 'hp-badge-good', vip: 'hp-badge-warn', inactive: 'hp-badge-neutral',
}

/** Вариант бейджа старой панели «Недавно добавлены»; цвета сохранены. */
export const CONTACT_STATUS_DASHBOARD_COLORS: Record<string, string> = {
  new: 'bg-[var(--hp-neutral-tint)] text-[var(--hp-sub)]', active: 'bg-[var(--hp-info-tint)] text-[var(--hp-info)]',
  vip: 'bg-[var(--hp-warn-tint)] text-[var(--hp-warn)]', inactive: 'bg-[var(--hp-danger-tint)] text-[var(--hp-danger)]',
}
