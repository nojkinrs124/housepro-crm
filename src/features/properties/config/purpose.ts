/**
 * Назначение объекта — `properties.deal_type` и `leads.deal_type`.
 *
 * Это НЕ направление работы агентства. Колонка называется так же, и до
 * 03.09.2026 оба смысла обслуживал один словарь `DEAL_TYPE_LABELS` из
 * `features/deals/config/deal-stages.ts`. После того как направления стали
 * четырьмя воронками, общий словарь начал бы показывать в каталоге сайта и в
 * реестре лидов названия воронок вместо «Аренда» и «Продажа».
 *
 * Значения этой колонки миграция не трогала: объект по-прежнему предназначен
 * для аренды, продажи, управления или субаренды.
 *
 * Файл намеренно без 'use client'.
 */

export const PROPERTY_PURPOSE_LABELS: Record<string, string> = {
  rent:       'Аренда',
  sale:       'Продажа',
  management: 'Управление',
  subrent:    'Субаренда',
}

export const PROPERTY_PURPOSE_VALUES: string[] = Object.keys(PROPERTY_PURPOSE_LABELS)

export function propertyPurposeLabel(value: string | null | undefined): string {
  return (value && PROPERTY_PURPOSE_LABELS[value]) || value || '—'
}
