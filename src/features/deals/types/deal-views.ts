/**
 * Форма сделки, какой её видят реестр, доска и переключатель.
 *
 * Один файл на три вида намеренно: раньше `Party` был объявлен трижды — в
 * DealsKanban, DealsListView и DealsViewSwitcher — и копии разъехались по
 * пустоте (`?: string` против `string | null`). Ровно так же расходились
 * словари стадий, пока у них не появился единственный источник.
 *
 * Пустота именно `null`, а не `undefined`: связь PostgREST либо приходит
 * объектом, либо не приходит вовсе, а внутри объекта пустая колонка — это
 * `null` из базы.
 *
 * Файл без 'use client': его импортируют и серверные страницы.
 */

/** Сторона сделки — контакт-клиент или контакт-собственник. */
export interface Party {
  full_name?: string | null
  company_name?: string | null
}

/** Объект сделки в кратком виде. */
export interface PropertyRef {
  title?: string | null
  address?: string | null
}

/** Поля сделки, которые нужны реестру, доске и фильтрам. */
export interface DealListItem {
  id: string
  status: string
  deal_type: string
  deal_number: number | null
  amount: number | null
  expected_close_date: string | null
  owner_contact?: Party | null
  client_contact?: Party | null
  property?: PropertyRef | null
}
