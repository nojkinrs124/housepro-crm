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
  // Страницы раздела «Услуги» — свой источник у каждой, чтобы считать
  // конверсию по страницам. Значения — USLUGI_LEAD_SOURCES в
  // src/features/site/uslugi/config.ts.
  { value: 'site_uslugi',         label: 'Сайт · Услуги' },
  { value: 'site_sdat_kvartiru',  label: 'Сайт · Сдать квартиру' },
  { value: 'site_snyat',          label: 'Сайт · Снять квартиру' },
  { value: 'site_prodat',         label: 'Сайт · Продать или купить' },
  { value: 'site_o_kompanii',     label: 'Сайт · О компании' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'vk',       label: 'VK' },
  { value: 'call',     label: 'Звонок' },
  { value: 'referral', label: 'Рекомендация' },
  { value: 'other',    label: 'Другое' },
] as const

/**
 * Источники, которые сотрудник выбирает руками в форме лида. Страницы сайта
 * (`site_*`) сюда не входят — их проставляет сама форма на сайте.
 */
export const LEAD_SOURCES_MANUAL = LEAD_SOURCES.filter(s => !s.value.startsWith('site_'))

export const LEAD_SOURCE_LABELS: Record<string, string> =
  Object.fromEntries(LEAD_SOURCES.map(s => [s.value, s.label]))
