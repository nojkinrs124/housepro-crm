/**
 * Откуда пришёл лид.
 *
 * Единый справочник вместо копий: тот же список подписывает источник на доске
 * лидов и в уведомлении о новом лиде в Telegram. Копии успели разойтись —
 * в уведомлении не было `website`, и источник уезжал в сообщение латиницей.
 *
 * Отличается от `DEAL_SOURCES` намеренно: у лида это канал первого обращения
 * (мессенджер, звонок), у сделки — площадка, которую оценивает аналитика.
 *
 * Файл намеренно без 'use client'.
 */

export const LEAD_SOURCES = [
  { value: 'avito',    label: 'Авито' },
  { value: 'cian',     label: 'ЦИАН' },
  { value: 'domclick', label: 'Домклик' },
  { value: 'website',  label: 'Сайт' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'call',     label: 'Звонок' },
  { value: 'referral', label: 'Рекомендация' },
  { value: 'other',    label: 'Другое' },
] as const

export const LEAD_SOURCE_LABELS: Record<string, string> =
  Object.fromEntries(LEAD_SOURCES.map(s => [s.value, s.label]))
