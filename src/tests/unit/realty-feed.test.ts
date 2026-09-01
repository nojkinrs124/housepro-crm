import { describe, it, expect } from 'vitest'
import { buildRealtyFeed, cityFromAddress, type FeedProperty } from '@/features/properties/services/realty-feed.service'

const options = {
  city: 'Красноярск',
  agentPhone: '+7 960 762-67-99',
  agentName: 'ХаусПро',
  siteUrl: 'https://housepro24.ru',
}

const base: FeedProperty = {
  id: 'aaaa-bbbb',
  title: 'Двушка у парка',
  description: 'Светлая квартира',
  address: 'г. Красноярск, ул. Ленина, д. 1',
  district: 'Центральный',
  property_type: 'apartment',
  deal_type: 'rent',
  price: 35000,
  deposit: 35000,
  area: 54,
  living_area: 32,
  kitchen_area: 9,
  rooms: 2,
  floor: 3,
  total_floors: 9,
  year_built: 2005,
  latitude: 56.01,
  longitude: 92.86,
  metro: null,
  photo_urls: ['https://cdn.example/1.jpg'],
  created_at: '2026-08-01T10:00:00.000Z',
  updated_at: '2026-08-20T10:00:00.000Z',
}

describe('buildRealtyFeed', () => {
  it('строит валидный каркас фида', () => {
    const xml = buildRealtyFeed([base], options)
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
    expect(xml).toContain('<realty-feed')
    expect(xml.trimEnd().endsWith('</realty-feed>')).toBe(true)
    expect(xml).toContain('<offer internal-id="aaaa-bbbb">')
  })

  it('аренда получает период, продажа — нет', () => {
    expect(buildRealtyFeed([base], options)).toContain('<period>месяц</period>')
    const sale = buildRealtyFeed([{ ...base, deal_type: 'sale' }], options)
    expect(sale).not.toContain('<period>')
    expect(sale).toContain('<type>продажа</type>')
  })

  it('переносит координаты и район', () => {
    const xml = buildRealtyFeed([base], options)
    expect(xml).toContain('<latitude>56.01</latitude>')
    expect(xml).toContain('<sub-locality-name>Центральный</sub-locality-name>')
  })

  it('коммерция помечается как коммерческая недвижимость', () => {
    const xml = buildRealtyFeed([{ ...base, property_type: 'office' }], options)
    expect(xml).toContain('<property-type>коммерческая</property-type>')
    expect(xml).toContain('<category>офис</category>')
  })

  it('пропускает объекты без цены и без адреса', () => {
    const xml = buildRealtyFeed(
      [
        { ...base, price: null },
        { ...base, id: 'no-address', address: '  ' },
      ],
      options
    )
    expect(xml).not.toContain('<offer')
  })

  it('экранирует спецсимволы в описании', () => {
    const xml = buildRealtyFeed([{ ...base, description: 'Кухня 9 м² & "вид" <окно>' }], options)
    expect(xml).toContain('&amp;')
    expect(xml).toContain('&quot;')
    expect(xml).toContain('&lt;окно&gt;')
  })

  it('пустой список даёт фид без объявлений, а не сломанный XML', () => {
    const xml = buildRealtyFeed([], options)
    expect(xml).toContain('<realty-feed')
    expect(xml).not.toContain('<offer')
  })

  it('не выводит больше 20 фотографий', () => {
    const photos = Array.from({ length: 30 }, (_, i) => `https://cdn.example/${i}.jpg`)
    const xml = buildRealtyFeed([{ ...base, photo_urls: photos }], options)
    expect(xml.match(/<image>/g)).toHaveLength(20)
  })
})

describe('cityFromAddress', () => {
  it('достаёт город из адреса', () => {
    expect(cityFromAddress('г. Красноярск, ул. Ленина, 1', 'Москва')).toBe('Красноярск')
  })

  it('подставляет запасной город, если в адресе его нет', () => {
    expect(cityFromAddress('ул. Ленина, 1', 'Красноярск')).toBe('Красноярск')
  })
})
