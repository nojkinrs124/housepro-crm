/**
 * Словари и форматтеры публичного сайта.
 *
 * Отдельный файл без 'use client' — импортируется и серверными страницами,
 * и клиентскими компонентами (см. проверку границы client/server в
 * scripts/pre-push-check.mjs).
 */

export const PROPERTY_TYPE_LABELS: Record<string, string> = {
  apartment: 'Квартира',
  house: 'Дом',
  commercial: 'Коммерция',
  office: 'Офис',
  warehouse: 'Склад',
  land: 'Участок',
}

export const DEAL_TYPE_LABELS: Record<string, string> = {
  rent: 'Аренда',
  sale: 'Продажа',
  management: 'Доверительное управление',
  subrent: 'Субаренда',
}

/** Короткая форма для бейджа на карточке. */
export const DEAL_TYPE_SHORT: Record<string, string> = {
  rent: 'Аренда',
  sale: 'Продажа',
  management: 'Управление',
  subrent: 'Субаренда',
}

export const STATUS_LABELS: Record<string, string> = {
  available: 'Свободен',
  reserved: 'Забронирован',
  rented: 'Сдан',
  sold: 'Продан',
  inactive: 'Снят с продажи',
}

/** Классы .hp-badge-* — семантика статуса, не цвет модуля. */
export const STATUS_BADGE: Record<string, string> = {
  available: 'hp-badge-brand',
  reserved: 'hp-badge-neutral',
  rented: 'hp-badge-neutral',
  sold: 'hp-badge-neutral',
  inactive: 'hp-badge-neutral',
}

export const HOUSE_TYPE_LABELS: Record<string, string> = {
  panel: 'Панельный',
  brick: 'Кирпичный',
  monolith: 'Монолитный',
  monolith_brick: 'Монолит-кирпич',
  wood: 'Деревянный',
}

export const WALL_MATERIAL_LABELS: Record<string, string> = {
  brick: 'Кирпич',
  panel: 'Панель',
  concrete: 'Бетон',
  wood: 'Дерево',
  gas_block: 'Газоблок',
}

export const HEATING_LABELS: Record<string, string> = {
  central: 'Центральное',
  gas: 'Газовое',
  electric: 'Электрическое',
  autonomous: 'Автономное',
}

export const WATER_LABELS: Record<string, string> = {
  central: 'Центральное',
  well: 'Скважина или колодец',
  none: 'Нет',
}

export function label(dict: Record<string, string>, key: string | null | undefined): string | null {
  if (!key) return null
  return dict[key] ?? key
}

/** «36 000 ₽» — обычным интерфейсным шрифтом, без моно (см. AGENTS.md). */
export function formatPrice(value: number | string | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return null
  return `${n.toLocaleString('ru-RU')} ₽`
}

/** Суффикс к цене: аренда — за месяц, продажа — без суффикса. */
export function priceSuffix(dealType: string): string {
  return dealType === 'rent' || dealType === 'subrent' || dealType === 'management' ? ' / мес.' : ''
}

export function formatArea(value: number | string | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return null
  return `${n.toLocaleString('ru-RU')} м²`
}

export function formatRooms(rooms: number | null | undefined): string | null {
  if (!rooms || rooms <= 0) return null
  return rooms === 1 ? 'Студия или 1 комната' : `${rooms} комнаты`
}

/** Компактно для карточки: «2 комн.» */
export function roomsShort(rooms: number | null | undefined): string | null {
  if (!rooms || rooms <= 0) return null
  return `${rooms} комн.`
}

export function floorLine(
  floor: number | null | undefined,
  total: number | null | undefined
): string | null {
  if (!floor) return null
  return total ? `${floor} из ${total} эт.` : `${floor} эт.`
}

/**
 * Описание объекта для сайта. В CRM описание часто пишется «под Avito» —
 * с эмодзи-маркерами и хэштегами. На сайте это противоречит голосу бренда
 * (brand/BRANDBOOK.md, раздел 2) и у части посетителей рисуется квадратами,
 * поэтому на выводе убираем эмодзи и строки/хвосты из хэштегов. Исходный
 * текст в базе не меняется — для Avito он остаётся как есть.
 */
export function cleanListingDescription(text: string | null | undefined): string {
  if (!text) return ''
  return text
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{20E3}]/gu, '')
    .replace(/(^|\s)#[\p{L}\p{N}_]+/gu, '')
    .split('\n')
    .map(line => line.replace(/^[\s•·▪►✔✓–-]+(?=\S)/u, m => (/[–-]/.test(m.trim()) ? '— ' : '')).trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
