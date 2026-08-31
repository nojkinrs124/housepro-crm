/**
 * Подписи объекта недвижимости — единый источник для карточек объекта,
 * реестра объектов и блока «Объект и условия» на карточке сделки.
 * Раньше эти три словаря были скопированы в 6 файлах.
 */

export const PROPERTY_TYPE_LABELS: Record<string, string> = {
  apartment: 'Квартира', house: 'Дом', commercial: 'Коммерция',
  office: 'Офис', warehouse: 'Склад', land: 'Участок',
}

export const PROPERTY_DEAL_LABELS: Record<string, string> = {
  rent: 'Аренда', sale: 'Продажа', management: 'Управление', subrent: 'Субаренда',
}

export const PROPERTY_STATUS_LABELS: Record<string, { label: string; badgeCls: string }> = {
  available: { label: 'Свободен',     badgeCls: 'hp-badge-good' },
  reserved:  { label: 'Забронирован', badgeCls: 'hp-badge-warn' },
  rented:    { label: 'Сдан',         badgeCls: 'hp-badge-info' },
  sold:      { label: 'Продан',       badgeCls: 'hp-badge-neutral' },
  inactive:  { label: 'Неактивен',    badgeCls: 'hp-badge-neutral' },
}
