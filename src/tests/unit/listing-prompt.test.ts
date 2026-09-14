import { describe, it, expect } from 'vitest'
import { buildUserPrompt, LISTING_SYSTEM_PROMPT } from '@/lib/ai/listing/prompt'
import { parseListingOutput, propertyListingFacts, type ListingPropertyInput } from '@/lib/ai/listing/facts'

// Генератор объявлений: в промпт уходят только заполненные поля объекта.
// Пустое поле в промпте = приглашение модели додумать «нет данных» как факт.

// Intl.NumberFormat('ru-RU') разделяет разряды неразрывным пробелом U+00A0
const NBSP = '\u00a0'

const empty: ListingPropertyInput = {
  title: 'Тестовый объект',
  property_type: 'apartment',
  deal_type: 'rent',
  address: 'Красноярск, Металлургов, 14В',
  district: null, metro: null,
  rooms: null, area: null, living_area: null, kitchen_area: null,
  floor: null, total_floors: null, ceiling_height: null,
  house_type: null, wall_material: null, year_built: null,
  has_elevator: null, has_parking: null, has_internet: null, has_tv: null,
  heating_type: null, water_supply_type: null,
  price: null, deposit: null, utilities_included: null,
  land_area: null, video_url: null, description: null,
}

describe('propertyListingFacts', () => {
  it('не включает пустые поля', () => {
    const labels = propertyListingFacts(empty).map(f => f.label)
    expect(labels).toEqual(['Тип объекта', 'Тип сделки', 'Название в CRM', 'Адрес'])
  })

  it('переводит коды в подписи и собирает составные значения', () => {
    const facts = propertyListingFacts({
      ...empty,
      rooms: 2, area: 54.3, floor: 5, total_floors: 9,
      house_type: 'brick', price: 35000, deposit: 35000,
      has_elevator: true, has_parking: false, video_url: 'https://youtu.be/x',
    })
    const byLabel = Object.fromEntries(facts.map(f => [f.label, f.value]))
    expect(byLabel['Этаж']).toBe('5 из 9')
    expect(byLabel['Тип дома']).toBe('кирпичный')
    expect(byLabel['Аренда']).toBe(`35${NBSP}000 ₽/мес.`)
    expect(byLabel['Залог']).toBe(`35${NBSP}000 ₽`)
    expect(byLabel['Лифт']).toBe('есть')
    expect(byLabel['Парковка']).toBeUndefined() // снятая галочка — не факт
    expect(byLabel['Видеообзор']).toBe('есть')
    expect(byLabel['Площадь общая']).toBe('54.3 м²')
  })

  it('для продажи пишет «Цена» без «/мес.» и не выводит залог', () => {
    const byLabel = Object.fromEntries(
      propertyListingFacts({ ...empty, deal_type: 'sale', price: 5200000, deposit: 100 }).map(f => [f.label, f.value]),
    )
    expect(byLabel['Цена']).toBe(`5${NBSP}200${NBSP}000 ₽`)
    expect(byLabel['Залог']).toBeUndefined()
  })
})

describe('buildUserPrompt', () => {
  it('пустые поля CRM не попадают в промпт', () => {
    const prompt = buildUserPrompt(empty, 'свежий ремонт')
    expect(prompt).toContain('Адрес: Красноярск, Металлургов, 14В')
    expect(prompt).not.toMatch(/Залог|Площадь|Этаж|Район|null|undefined/)
  })

  it('не обрезает rawInput', () => {
    const raw = 'абв '.repeat(1900).trim() // ~7600 символов, в лимите 8000
    const prompt = buildUserPrompt(empty, raw)
    expect(prompt).toContain(raw)
    expect(prompt.endsWith('Сгенерируй объявление по правилам.')).toBe(true)
  })

  it('допускает пустой rawInput', () => {
    const prompt = buildUserPrompt(empty, '   ')
    expect(prompt).toContain('СЫРЫЕ ВВОДНЫЕ ОТ АГЕНТА:')
    expect(prompt).toContain('вводных нет')
  })

  it('системный промпт требует формат «заголовок / --- / тело»', () => {
    expect(LISTING_SYSTEM_PROMPT).toContain('ровно три дефиса: ---')
    expect(LISTING_SYSTEM_PROMPT).toContain('до 50 символов')
  })
})

describe('parseListingOutput', () => {
  it('делит по первому разделителю ---', () => {
    const r = parseListingOutput('Сдаётся евро-2 на Металлургов\n---\n🏡 Текст\n---\nещё')
    expect(r).toEqual({ title: 'Сдаётся евро-2 на Металлургов', body: '🏡 Текст\n---\nещё', complete: true })
  })

  it('пока стрим не дошёл до разделителя — считает текст заголовком', () => {
    expect(parseListingOutput('Сдаётся ев')).toEqual({ title: 'Сдаётся ев', body: '', complete: false })
  })

  it('без разделителя — первая строка заголовок, остальное тело', () => {
    const r = parseListingOutput('Заголовок\nтело\nещё')
    expect(r.title).toBe('Заголовок')
    expect(r.body).toBe('тело\nещё')
    expect(r.complete).toBe(false)
  })
})
