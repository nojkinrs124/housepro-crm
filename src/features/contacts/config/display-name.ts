/**
 * Имя контакта для списков, заголовков и документов.
 *
 * У юрлица «лицо» — организация: в комбобоксах сделки и договора и в заголовке
 * карточки должно стоять «ООО Ромашка», а не ФИО представителя, который
 * записан в `full_name` (проход 17.09.2026, SL-2.4/C-2/CT-1 — два юрлица с
 * похожими директорами в списке было не различить).
 *
 * Файл намеренно без 'use client': нужен и серверным страницам, и селектам.
 */
export interface ContactNameSource {
  full_name?: string | null
  company_name?: string | null
  client_type?: string | null
}

export function contactDisplayName(c: ContactNameSource | null | undefined, fallback = 'Без имени'): string {
  if (!c) return fallback
  if (c.client_type === 'legal_entity' && c.company_name) return c.company_name
  return c.full_name || c.company_name || fallback
}

/** Имя с контактным лицом вторым планом: «ООО Ромашка (Иванов И. И.)». */
export function contactDisplayNameWithPerson(c: ContactNameSource | null | undefined, fallback = 'Без имени'): string {
  const name = contactDisplayName(c, fallback)
  if (c?.client_type === 'legal_entity' && c.company_name && c.full_name && c.full_name !== c.company_name) {
    return `${name} (${c.full_name})`
  }
  return name
}
