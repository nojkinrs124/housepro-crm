/**
 * Откуда пришла сделка — площадка объявлений, входящее обращение или канал
 * агентства.
 *
 * Единый справочник вместо копии в форме: тот же список нужен аналитике, чтобы
 * показать, какая площадка окупается. Раньше он жил массивом внутри
 * `DealFormBody.tsx`, и аналитика источников не показывала вовсе.
 *
 * Файл намеренно без 'use client'.
 */

export const DEAL_SOURCES = [
  { value: 'avito',    label: 'Avito' },
  { value: 'cian',     label: 'ЦИАН' },
  { value: 'domclick', label: 'Домклик' },
  { value: 'yandex',   label: 'Яндекс Недвижимость' },
  { value: 'site',     label: 'Сайт агентства' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'referral', label: 'Рекомендация' },
  { value: 'phone',    label: 'Звонок' },
  { value: 'repeat',   label: 'Повторное обращение' },
  { value: 'other',    label: 'Другое' },
] as const

export const DEAL_SOURCE_VALUES: string[] = DEAL_SOURCES.map(s => s.value)

export const DEAL_SOURCE_LABELS: Record<string, string> = {
  ...Object.fromEntries(DEAL_SOURCES.map(s => [s.value, s.label])),
  // Пустой источник — это не «Другое», а незаполненное поле: в аналитике их
  // нельзя смешивать, иначе непонятно, что чинить — работу или данные.
  unknown: 'Источник не указан',
}

/** Площадки объявлений — по ним считается окупаемость размещения. */
export const LISTING_PLATFORM_SOURCES: string[] = ['avito', 'cian', 'domclick', 'yandex']
