import { describe, it, expect } from 'vitest'
import { autoMapColumns, parseImportRow, looksLikeHeaderRow } from '@/lib/import/schema'
import { readCsv, excelSerialToISO } from '@/lib/import/xlsx-reader'

describe('autoMapColumns', () => {
  it('находит колонки по русским заголовкам', () => {
    const mapping = autoMapColumns(['ФИО', 'Телефон', 'Email', 'Роль'], 'contacts')
    expect(mapping.full_name).toBe(0)
    expect(mapping.phone).toBe(1)
    expect(mapping.email).toBe(2)
    expect(mapping.role).toBe(3)
  })

  it('не путает «Бюджет» и «Бюджет до» — точное совпадение в приоритете', () => {
    const mapping = autoMapColumns(['Имя', 'Бюджет от', 'Бюджет до'], 'leads')
    expect(mapping.budget_min).toBe(1)
    expect(mapping.budget_max).toBe(2)
  })

  it('не назначает одну колонку двум полям', () => {
    const mapping = autoMapColumns(['Телефон', 'Телефон'], 'contacts')
    const used = Object.values(mapping)
    expect(new Set(used).size).toBe(used.length)
  })
})

describe('parseImportRow', () => {
  const mapping = { full_name: 0, phone: 1, email: 2, role: 3 }

  it('нормализует телефон и приводит роль к системному значению', () => {
    const parsed = parseImportRow(['Иванов Иван', '8 (999) 123-45-67', 'A@B.RU', 'собственник'], mapping, 'contacts')
    expect(parsed.values.phone).toBe('+79991234567')
    expect(parsed.values.email).toBe('a@b.ru')
    expect(parsed.values.role).toBe('owner')
    expect(parsed.errors).toHaveLength(0)
  })

  it('ругается на пустое обязательное поле', () => {
    const parsed = parseImportRow(['', '+79991234567', '', ''], mapping, 'contacts')
    expect(parsed.errors[0]).toContain('ФИО')
  })

  it('битый email не роняет строку, а уходит в предупреждения', () => {
    const parsed = parseImportRow(['Иванов', '+79991234567', 'не-почта', ''], mapping, 'contacts')
    expect(parsed.errors).toHaveLength(0)
    expect(parsed.warnings.join(' ')).toContain('Email')
    expect(parsed.values.email).toBeUndefined()
  })

  it('подставляет значение по умолчанию для незаполненного enum', () => {
    const parsed = parseImportRow(['Иванов', '+79991234567', '', ''], mapping, 'contacts')
    expect(parsed.values.role).toBe('client')
  })

  it('разбирает суммы с пробелами и рублями', () => {
    const parsed = parseImportRow(['Квартира', 'ул. Ленина 1', '55 000 ₽'], { title: 0, address: 1, price: 2 }, 'properties')
    expect(parsed.values.price).toBe(55000)
  })
})

describe('readCsv', () => {
  it('понимает точку с запятой, кавычки и BOM', () => {
    const csv = '﻿Имя;Телефон\n"Иванов; Иван";+79991234567\n'
    const sheet = readCsv(csv)
    expect(sheet.rows[0]).toEqual(['Имя', 'Телефон'])
    expect(sheet.rows[1]).toEqual(['Иванов; Иван', '+79991234567'])
  })

  it('понимает запятую как разделитель', () => {
    const sheet = readCsv('name,phone\nIvan,+79991234567')
    expect(sheet.rows[1]).toEqual(['Ivan', '+79991234567'])
  })
})

describe('excelSerialToISO', () => {
  it('переводит серийный номер Excel в дату', () => {
    expect(excelSerialToISO(45000)).toBe('2023-03-15')
  })

  it('отбрасывает мусорные значения', () => {
    expect(excelSerialToISO(0)).toBeNull()
    expect(excelSerialToISO(999_999)).toBeNull()
  })
})

describe('looksLikeHeaderRow', () => {
  it('распознаёт строку заголовков', () => {
    expect(looksLikeHeaderRow(['ФИО', 'Телефон', 'Email'], 'contacts')).toBe(true)
  })

  it('не принимает строку данных за заголовок', () => {
    expect(looksLikeHeaderRow(['Иванов Иван', '+79991234567', 'a@b.ru'], 'contacts')).toBe(false)
  })
})
