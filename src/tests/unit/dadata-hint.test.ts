import { describe, it, expect } from 'vitest'
import { formatHint } from '@/components/forms/DadataSuggestInput'

describe('formatHint — подпись под полем DaData', () => {
  it('подставляет обязательные ключи', () => {
    expect(
      formatHint('Координаты: {latitude}, {longitude}', { latitude: '55.75', longitude: '37.61' })
    ).toBe('Координаты: 55.75, 37.61')
  })

  it('без обязательного ключа подписи нет', () => {
    expect(formatHint('Координаты: {latitude}, {longitude}', { latitude: '55.75', longitude: null }))
      .toBeNull()
    expect(formatHint('Координаты: {latitude}, {longitude}', {})).toBeNull()
  })

  it('необязательный кусок в скобках выпадает целиком', () => {
    const template = 'Руководитель по ЕГРЮЛ: {managerName}[, {managerPost}]'
    expect(formatHint(template, { managerName: 'Иванов И.И.', managerPost: 'директор' }))
      .toBe('Руководитель по ЕГРЮЛ: Иванов И.И., директор')
    expect(formatHint(template, { managerName: 'Иванов И.И.', managerPost: '' }))
      .toBe('Руководитель по ЕГРЮЛ: Иванов И.И.')
    expect(formatHint(template, { managerPost: 'директор' })).toBeNull()
  })

  it('числа приводит к строке, пустой результат считает отсутствием подписи', () => {
    expect(formatHint('{latitude}', { latitude: 55.75 })).toBe('55.75')
    expect(formatHint('[{metro}]', { metro: null })).toBeNull()
  })
})
