/**
 * Подписи статусов и результатов показа — единый источник для бейджа,
 * реестра, карточек лида и сделки.
 *
 * Файл намеренно без 'use client'.
 */
export const SHOWING_STATUS_LABELS: Record<string, string> = {
  planned:   'Запланирован',
  completed: 'Проведён',
  cancelled: 'Отменён',
  no_show:   'Не пришли',
}

export const SHOWING_RESULT_LABELS: Record<string, string> = {
  interested:     'Заинтересован',
  thinking:       'Думает',
  not_interested: 'Не заинтересован',
}
