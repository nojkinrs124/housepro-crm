import type { Row } from '@/types/database'
import { PROPERTY_DEAL_LABELS, PROPERTY_TYPE_LABELS } from '@/features/properties/config/property-labels'

/**
 * Чистая логика генератора объявлений, общая для сервера и клиента:
 * какие факты объекта уходят в промпт и как разобрать ответ модели.
 * Файл без 'use client' и без серверных импортов — его можно тянуть с обеих сторон.
 */

/** Лимиты формата ответа — те же, что продиктованы модели в системном промпте. */
export const LISTING_TITLE_MAX = 50
export const LISTING_BODY_MAX = 3000

export interface ListingFact {
  label: string
  value: string
}

/** Поля объекта, которые участвуют в объявлении. Остальные колонки не нужны. */
export type ListingPropertyInput = Pick<
  Row<'properties'>,
  | 'title' | 'property_type' | 'deal_type' | 'address' | 'district' | 'metro'
  | 'rooms' | 'area' | 'living_area' | 'kitchen_area' | 'floor' | 'total_floors' | 'ceiling_height'
  | 'house_type' | 'wall_material' | 'year_built'
  | 'has_elevator' | 'has_parking' | 'has_internet' | 'has_tv'
  | 'heating_type' | 'water_supply_type'
  | 'price' | 'deposit' | 'utilities_included'
  | 'land_area' | 'video_url' | 'description'
>

const HOUSE_TYPE_LABELS: Record<string, string> = {
  panel: 'панельный', brick: 'кирпичный', monolith: 'монолитный',
  monolith_brick: 'монолит-кирпич', wood: 'деревянный',
}
const WALL_MATERIAL_LABELS: Record<string, string> = {
  brick: 'кирпич', panel: 'панель', concrete: 'бетон', wood: 'дерево', gas_block: 'газоблок',
}
const HEATING_LABELS: Record<string, string> = {
  central: 'центральное', gas: 'газовое', electric: 'электрическое', autonomous: 'автономное',
}
const WATER_LABELS: Record<string, string> = {
  central: 'центральное', well: 'скважина/колодец', none: 'нет',
}

const formatMoney = (n: number) => new Intl.NumberFormat('ru-RU').format(n)

/**
 * Собирает список «Ключ: значение» для промпта и для превью в модалке.
 * Пустые/null поля не попадают в список вообще — иначе модель начнёт додумывать
 * «нет данных» как факт. Флажки-чекбоксы включаются только когда стоят:
 * снятая галочка в форме означает «не отмечено», а не «отсутствует».
 */
export function propertyListingFacts(p: ListingPropertyInput): ListingFact[] {
  const facts: ListingFact[] = []
  const add = (label: string, value: string | number | null | undefined) => {
    if (value === null || value === undefined) return
    const text = String(value).trim()
    if (text) facts.push({ label, value: text })
  }

  const isSale = p.deal_type === 'sale'

  add('Тип объекта', PROPERTY_TYPE_LABELS[p.property_type] ?? p.property_type)
  add('Тип сделки', PROPERTY_DEAL_LABELS[p.deal_type] ?? p.deal_type)
  add('Название в CRM', p.title)
  add('Адрес', p.address)
  add('Район', p.district)
  add('Метро', p.metro)

  add('Комнат', p.rooms)
  if (p.area != null) add('Площадь общая', `${p.area} м²`)
  if (p.living_area != null) add('Площадь жилая', `${p.living_area} м²`)
  if (p.kitchen_area != null) add('Площадь кухни', `${p.kitchen_area} м²`)
  if (p.land_area != null) add('Участок', `${p.land_area} сот.`)
  if (p.floor != null && p.total_floors != null) add('Этаж', `${p.floor} из ${p.total_floors}`)
  else if (p.floor != null) add('Этаж', p.floor)
  else if (p.total_floors != null) add('Этажность дома', p.total_floors)
  if (p.ceiling_height != null) add('Высота потолков', `${p.ceiling_height} м`)

  add('Тип дома', p.house_type ? HOUSE_TYPE_LABELS[p.house_type] ?? p.house_type : null)
  add('Материал стен', p.wall_material ? WALL_MATERIAL_LABELS[p.wall_material] ?? p.wall_material : null)
  add('Год постройки', p.year_built)
  if (p.has_elevator) add('Лифт', 'есть')
  if (p.has_parking) add('Парковка', 'есть')
  if (p.has_internet) add('Интернет', 'есть')
  if (p.has_tv) add('Телевидение', 'есть')
  add('Отопление', p.heating_type ? HEATING_LABELS[p.heating_type] ?? p.heating_type : null)
  add('Водоснабжение', p.water_supply_type ? WATER_LABELS[p.water_supply_type] ?? p.water_supply_type : null)

  if (p.price != null) add(isSale ? 'Цена' : 'Аренда', `${formatMoney(Number(p.price))} ₽${isSale ? '' : '/мес.'}`)
  if (!isSale && p.deposit != null) add('Залог', `${formatMoney(Number(p.deposit))} ₽`)
  add('Коммунальные', p.utilities_included)

  if (p.video_url) add('Видеообзор', 'есть')
  add('Описание из CRM', p.description)

  return facts
}

/**
 * Ответ модели: первая строка — заголовок, затем строка `---`, затем тело.
 * Пока стрим не дошёл до разделителя, весь текст считаем заголовком-черновиком —
 * UI показывает его как есть. Если модель разделитель не выдала вовсе,
 * заголовком становится первая строка, телом — остальное.
 */
export function parseListingOutput(raw: string): { title: string; body: string; complete: boolean } {
  const text = raw.replace(/\r\n/g, '\n').trim()
  const sep = text.match(/^---\s*$/m)
  if (sep && sep.index !== undefined) {
    return {
      title: text.slice(0, sep.index).trim(),
      body: text.slice(sep.index + sep[0].length).trim(),
      complete: true,
    }
  }
  const nl = text.indexOf('\n')
  if (nl === -1) return { title: text, body: '', complete: false }
  return { title: text.slice(0, nl).trim(), body: text.slice(nl + 1).trim(), complete: false }
}
