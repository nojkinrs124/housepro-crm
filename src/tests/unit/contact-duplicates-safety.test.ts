import { describe, expect, it } from 'vitest'

function normalizeContactName(value: string | null): string {
  return (value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('ru-RU')
}

describe('phone duplicate merge safety (K6)', () => {
  it('does not allow phone-match merge when normalized names differ', () => {
    const names = ['Иванов Иван Иванович', 'Петров Пётр Петрович'].map(normalizeContactName)
    expect(names.every(name => name && name === names[0])).toBe(false)
  })

  it('allows exact names despite case and whitespace differences', () => {
    const names = ['Иванов Иван Иванович', ' иванов   иван иванович '].map(normalizeContactName)
    expect(names.every(name => name && name === names[0])).toBe(true)
  })

  it('treats missing names as unsafe to merge', () => {
    const names = ['Иванов Иван Иванович', null].map(normalizeContactName)
    expect(names.every(name => name && name === names[0])).toBe(false)
  })
})
