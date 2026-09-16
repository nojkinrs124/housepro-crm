/**
 * Откуда появился контакт. Единый справочник для формы контакта и карточки —
 * раньше список жил двумя копиями (в `ContactForm` и `contacts/[id]/page.tsx`)
 * и в одной из них «Авито» было латиницей.
 *
 * Отличается от LEAD_SOURCES (канал первого обращения) и DEAL_SOURCES
 * (площадка, которую оценивает аналитика) — у контакта это просто «как узнали».
 *
 * Файл намеренно без 'use client'.
 */
export const CONTACT_SOURCES = [
  { value: 'avito',     label: 'Авито' },
  { value: 'cian',      label: 'ЦИАН' },
  { value: 'domclick',  label: 'Домклик' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'vk',        label: 'VK' },
  { value: 'telegram',  label: 'Telegram' },
  { value: 'whatsapp',  label: 'WhatsApp' },
  { value: 'phone',     label: 'Звонок' },
  { value: 'referral',  label: 'Рекомендация' },
  { value: 'other',     label: 'Другое' },
] as const

export const CONTACT_SOURCE_LABELS: Record<string, string> =
  Object.fromEntries(CONTACT_SOURCES.map(s => [s.value, s.label]))
