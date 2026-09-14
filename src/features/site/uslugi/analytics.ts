/**
 * Имена событий аналитики раздела «Услуги».
 *
 * Счётчика Яндекс.Метрики на сайте нет (см. docs/uslugi/OPEN-QUESTIONS.md),
 * поэтому события пока только размечаются data-атрибутами. Когда счётчик
 * появится, цели навешиваются по `[data-hp-event="…"]` без правки компонентов.
 *
 * Использование в JSX: `<button {...analyticsAttrs('tariff_click', { tariff: 'premium' })}>`
 *
 * Файл без 'use client' — атрибуты нужны и серверным, и клиентским компонентам.
 */

export const ANALYTICS_EVENTS = {
  /** взаимодействие с калькулятором (смена района/комнат/ставки) */
  calcInteract: 'calc_interact',
  /** клик по кнопке тарифа — с data-hp-tariff */
  tariffClick: 'tariff_click',
  /** клик по кнопке калькулятора «Получить расчёт по моему адресу» */
  calcLeadClick: 'calc_lead_click',
  /** отправка формы заявки — с data-hp-source */
  leadSubmit: 'lead_submit',
  /** клик по телефону */
  phoneClick: 'phone_click',
  /** клик по Telegram */
  telegramClick: 'telegram_click',
  /** «Посмотреть образец» / «Запросить образец» — с data-hp-document */
  documentSample: 'document_sample',
  /** переход с хаба на страницу услуги — с data-hp-target */
  hubCardClick: 'hub_card_click',
} as const

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS]

export interface AnalyticsParams {
  tariff?: string
  source?: string
  document?: string
  target?: string
}

export interface AnalyticsAttrs {
  'data-hp-event': AnalyticsEvent
  'data-hp-tariff'?: string
  'data-hp-source'?: string
  'data-hp-document'?: string
  'data-hp-target'?: string
}

/** data-атрибуты для элемента, по которым потом навешивается цель счётчика */
export function analyticsAttrs(event: AnalyticsEvent, params: AnalyticsParams = {}): AnalyticsAttrs {
  const attrs: AnalyticsAttrs = { 'data-hp-event': event }
  if (params.tariff) attrs['data-hp-tariff'] = params.tariff
  if (params.source) attrs['data-hp-source'] = params.source
  if (params.document) attrs['data-hp-document'] = params.document
  if (params.target) attrs['data-hp-target'] = params.target
  return attrs
}
