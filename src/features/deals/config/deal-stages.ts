/**
 * Этапы сделки — единый источник для степпера на карточке, Kanban-доски,
 * бейджей в реестре и селектора смены этапа.
 *
 * Файл намеренно без 'use client': его импортируют и серверные страницы,
 * и клиентские компоненты (см. проверку границы client/server в
 * scripts/pre-push-check.mjs).
 */

export const DEAL_STAGES = [
  { value: 'new',         label: 'Новая' },
  { value: 'showing',     label: 'Показ' },
  { value: 'negotiation', label: 'Переговоры' },
  { value: 'contract',    label: 'Договор' },
  { value: 'payment',     label: 'Оплата' },
  { value: 'completed',   label: 'Завершена' },
] as const

/** Отменённая сделка не занимает место в воронке — она вне последовательности. */
export const DEAL_STAGE_CANCELLED = { value: 'cancelled', label: 'Отменена' } as const

export const DEAL_STATUS_LABELS: Record<string, string> = {
  ...Object.fromEntries(DEAL_STAGES.map(s => [s.value, s.label])),
  cancelled: DEAL_STAGE_CANCELLED.label,
}

export const DEAL_TYPE_LABELS: Record<string, string> = {
  rent:       'Аренда',
  sale:       'Продажа',
  management: 'Управление',
  commercial: 'Коммерция',
  subrent:    'Субаренда',
}

/** Бейдж-класс `.hp-badge-*` для этапа. */
export function dealStageBadgeClass(status: string): string {
  if (status === 'completed') return 'hp-badge-good'
  if (status === 'cancelled') return 'hp-badge-neutral'
  if (status === 'new')       return 'hp-badge-info'
  return 'hp-badge-warn'
}

/** Индекс этапа в воронке; -1 для отменённой сделки. */
export function dealStageIndex(status: string): number {
  return DEAL_STAGES.findIndex(s => s.value === status)
}
