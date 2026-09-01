// Фид объектов в формате «Яндекс.Недвижимость» (YRL).
//
// Тот же формат принимает Домклик, поэтому один генератор обслуживает оба
// роута экспорта — дублировать почти одинаковую XML-вёрстку смысла нет.
//
// Формат чувствителен к словам: type/category/property-type — это именно
// русские значения из справочника Яндекса, а не коды. Ошибка в них приводит
// к молчаливому отбраковыванию объявления при разборе фида.

export interface FeedProperty {
  id: string
  title: string | null
  description: string | null
  address: string
  district: string | null
  property_type: string
  deal_type: string
  price: number | null
  deposit: number | null
  area: number | null
  living_area: number | null
  kitchen_area: number | null
  rooms: number | null
  floor: number | null
  total_floors: number | null
  year_built: number | null
  latitude: number | null
  longitude: number | null
  metro: string | null
  photo_urls: string[] | null
  created_at: string | null
  updated_at: string | null
}

export interface FeedOptions {
  /** Город по умолчанию, если из адреса его вытащить не удалось. */
  city: string
  /** Телефон агентства — обязателен, объявление без контакта отклоняется. */
  agentPhone: string
  agentName?: string | null
  agentEmail?: string | null
  /** Базовый адрес сайта: из него собираются ссылки на карточки объектов. */
  siteUrl: string
}

const RENT_DEAL_TYPES = new Set(['rent', 'subrent', 'management'])

/** Категория объекта в терминах справочника Яндекса. */
const CATEGORY: Record<string, string> = {
  apartment: 'квартира',
  house: 'дом',
  commercial: 'помещение свободного назначения',
  office: 'офис',
  warehouse: 'склад',
  land: 'участок',
}

/** Жилая или коммерческая недвижимость — отдельное обязательное поле фида. */
const PROPERTY_KIND: Record<string, string> = {
  apartment: 'жилая',
  house: 'жилая',
  commercial: 'коммерческая',
  office: 'коммерческая',
  warehouse: 'коммерческая',
  land: 'участок',
}

// Управляющие символы ломают разбор XML у площадок. Табуляция, перевод строки
// и возврат каретки в XML допустимы, поэтому из диапазона исключены.
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(CONTROL_CHARS, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function tag(name: string, value: unknown, indent = '    '): string | null {
  if (value === null || value === undefined || value === '') return null
  return `${indent}<${name}>${esc(value)}</${name}>`
}

/** Дата в формате фида: ISO 8601 со смещением часового пояса. */
function feedDate(value: string | null | undefined): string {
  const d = value ? new Date(value) : new Date()
  return (Number.isNaN(d.getTime()) ? new Date() : d).toISOString().replace(/\.\d{3}Z$/, '+00:00')
}

/** Город из адреса вида «г. Красноярск, ул. Ленина, 1». */
export function cityFromAddress(address: string, fallback: string): string {
  const match = address.match(/(?:^|,)\s*(?:г\.|г\s|город\s)\s*([А-ЯЁ][а-яё-]+)/i)
  return match ? match[1] : fallback
}

function offerXml(property: FeedProperty, options: FeedOptions): string {
  const isRent = RENT_DEAL_TYPES.has(property.deal_type)
  const category = CATEGORY[property.property_type] ?? 'квартира'
  const kind = PROPERTY_KIND[property.property_type] ?? 'жилая'
  const city = cityFromAddress(property.address, options.city)

  const lines: (string | null)[] = [
    `  <offer internal-id="${esc(property.id)}">`,
    tag('type', isRent ? 'аренда' : 'продажа'),
    tag('property-type', kind),
    tag('category', category),
    tag('url', `${options.siteUrl}/catalog/${property.id}`),
    tag('creation-date', feedDate(property.created_at)),
    tag('last-update-date', feedDate(property.updated_at ?? property.created_at)),

    '    <location>',
    tag('country', 'Россия', '      '),
    tag('locality-name', city, '      '),
    tag('address', property.address, '      '),
    tag('sub-locality-name', property.district, '      '),
    tag('metro-name', property.metro, '      '),
    tag('latitude', property.latitude, '      '),
    tag('longitude', property.longitude, '      '),
    '    </location>',

    '    <sales-agent>',
    tag('phone', options.agentPhone, '      '),
    tag('name', options.agentName, '      '),
    tag('email', options.agentEmail, '      '),
    tag('category', 'агентство', '      '),
    '    </sales-agent>',

    '    <price>',
    tag('value', property.price ?? 0, '      '),
    tag('currency', 'RUR', '      '),
    // Период обязателен только для аренды; у продажи его быть не должно.
    isRent ? tag('period', 'месяц', '      ') : null,
    '    </price>',

    property.deposit ? `    <deposit>${property.deposit}</deposit>` : null,

    property.area
      ? ['    <area>', tag('value', property.area, '      '), tag('unit', 'кв. м', '      '), '    </area>'].join('\n')
      : null,
    property.living_area
      ? [
          '    <living-space>',
          tag('value', property.living_area, '      '),
          tag('unit', 'кв. м', '      '),
          '    </living-space>',
        ].join('\n')
      : null,
    property.kitchen_area
      ? [
          '    <kitchen-space>',
          tag('value', property.kitchen_area, '      '),
          tag('unit', 'кв. м', '      '),
          '    </kitchen-space>',
        ].join('\n')
      : null,

    tag('rooms', property.rooms),
    tag('floor', property.floor),
    tag('floors-total', property.total_floors),
    tag('built-year', property.year_built),
    tag('description', property.description ?? property.title),

    ...(property.photo_urls ?? []).slice(0, 20).map((url) => tag('image', url)),

    '  </offer>',
  ]

  return lines.filter((line): line is string => line !== null).join('\n')
}

/**
 * Собирает фид. Объекты без адреса или без цены пропускаются: площадки всё
 * равно отклонят такое объявление, а в отчёте о загрузке это выглядит как
 * ошибка интеграции, которую потом долго ищут.
 */
export function buildRealtyFeed(properties: FeedProperty[], options: FeedOptions): string {
  const offers = properties
    .filter((p) => p.address?.trim() && p.price && p.price > 0)
    .map((p) => offerXml(p, options))
    .join('\n')

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<realty-feed xmlns="http://webmaster.yandex.ru/schemas/feed/realty/2010-06">',
    `  <generation-date>${feedDate(null)}</generation-date>`,
    ...(offers ? [offers] : []),
    '</realty-feed>',
    '',
  ].join('\n')
}
