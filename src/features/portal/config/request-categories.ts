/**
 * Категории бытовых заявок арендатора.
 *
 * Список короткий намеренно: длинный справочник заставляет жильца выбирать из
 * того, чего он не понимает, а разбирать всё равно менеджеру. «Другое» с
 * описанием закрывает остаток.
 *
 * Файл намеренно без 'use client'.
 */

export const REQUEST_CATEGORIES = [
  { value: 'cleaning',   label: 'Клининг' },
  { value: 'plumbing',   label: 'Сантехник' },
  { value: 'electrical', label: 'Электрик' },
  { value: 'appliance',  label: 'Техника' },
  { value: 'other',      label: 'Другое' },
] as const

export const REQUEST_CATEGORY_LABELS: Record<string, string> =
  Object.fromEntries(REQUEST_CATEGORIES.map(c => [c.value, c.label]))

export const REQUEST_STATUSES = [
  { value: 'new',         label: 'Новая',        badge: 'hp-badge-info' },
  { value: 'accepted',    label: 'Принята',      badge: 'hp-badge-warn' },
  { value: 'in_progress', label: 'В работе',     badge: 'hp-badge-warn' },
  { value: 'done',        label: 'Выполнена',    badge: 'hp-badge-good' },
  { value: 'rejected',    label: 'Отклонена',    badge: 'hp-badge-neutral' },
] as const

export const REQUEST_STATUS_LABELS: Record<string, string> =
  Object.fromEntries(REQUEST_STATUSES.map(s => [s.value, s.label]))

export const REQUEST_STATUS_BADGE: Record<string, string> =
  Object.fromEntries(REQUEST_STATUSES.map(s => [s.value, s.badge]))

/** Допустимые переходы. Из выполненной и отклонённой возврата нет. */
export const REQUEST_TRANSITIONS: Record<string, string[]> = {
  new:         ['accepted', 'rejected'],
  accepted:    ['in_progress', 'rejected'],
  in_progress: ['done'],
  done:        [],
  rejected:    [],
}

export function canTransition(from: string, to: string): boolean {
  return (REQUEST_TRANSITIONS[from] ?? []).includes(to)
}
