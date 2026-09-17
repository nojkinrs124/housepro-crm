/**
 * Чего хочет лид. От этого зависит роль контакта при конвертации: «сдать» и
 * «продать» — собственник, остальное — клиент. До 17.09.2026 вариантов для
 * собственника не было вовсе, и каждый собственник из лида становился
 * «клиентом» (сквозной проход, L-1/L-9).
 *
 * Файл намеренно без 'use client'.
 */
export const LEAD_DEAL_TYPES = [
  { value: 'rent',    label: 'Снять',     role: 'client' },
  { value: 'sale',    label: 'Купить',    role: 'client' },
  { value: 'let',     label: 'Сдать',     role: 'owner' },
  { value: 'sell',    label: 'Продать',   role: 'owner' },
  { value: 'subrent', label: 'Субаренда', role: 'client' },
] as const

export const LEAD_DEAL_TYPE_LABELS: Record<string, string> =
  Object.fromEntries(LEAD_DEAL_TYPES.map(t => [t.value, t.label]))

/** Роль контакта, которую получает лид при конвертации. */
export function contactRoleForLead(dealType: string | null | undefined): 'owner' | 'client' {
  return LEAD_DEAL_TYPES.find(t => t.value === dealType)?.role ?? 'client'
}
