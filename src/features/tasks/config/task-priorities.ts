/**
 * Приоритет задачи — единый источник для реестра, доски и Telegram-бота.
 *
 * Копий было две, и они расходились регистром: в вебе «Низкий», в боте
 * «низкий». Мелочь, но ровно так начинались все прошлые расхождения словарей.
 *
 * Файл намеренно без 'use client'.
 */

export const TASK_PRIORITIES = [
  { value: 'low',    label: 'Низкий',  badge: 'hp-badge-neutral' },
  { value: 'medium', label: 'Средний', badge: 'hp-badge-warn' },
  { value: 'high',   label: 'Высокий', badge: 'hp-badge-danger' },
] as const

export const TASK_PRIORITY_LABELS: Record<string, string> =
  Object.fromEntries(TASK_PRIORITIES.map(p => [p.value, p.label]))

export const TASK_PRIORITY_BADGE: Record<string, string> =
  Object.fromEntries(TASK_PRIORITIES.map(p => [p.value, p.badge]))
