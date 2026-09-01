import { describe, it, expect } from 'vitest'

import { amountInWords } from '@/lib/invoice-words'

describe('amountInWords', () => {
  it('склоняет рубли и копейки', () => {
    expect(amountInWords(1)).toBe('Один рубль 00 копеек')
    expect(amountInWords(2)).toBe('Два рубля 00 копеек')
    expect(amountInWords(5)).toBe('Пять рублей 00 копеек')
  })

  it('обрабатывает тысячи в женском роде', () => {
    expect(amountInWords(1000)).toBe('Одна тысяча рублей 00 копеек')
    expect(amountInWords(2000)).toBe('Две тысячи рублей 00 копеек')
  })

  it('считает копейки', () => {
    expect(amountInWords(50000.5)).toContain('50 копеек')
    expect(amountInWords(1234.01)).toContain('01 копейка')
  })

  it('разбирает типовую аренду', () => {
    expect(amountInWords(45000)).toBe('Сорок пять тысяч рублей 00 копеек')
  })

  it('работает с миллионами', () => {
    expect(amountInWords(2_500_000)).toBe('Два миллиона пятьсот тысяч рублей 00 копеек')
  })

  it('ноль не ломает функцию', () => {
    expect(amountInWords(0)).toBe('Ноль рублей 00 копеек')
  })

  it('подростковые числа не путаются с десятками', () => {
    expect(amountInWords(15)).toBe('Пятнадцать рублей 00 копеек')
    expect(amountInWords(115)).toBe('Сто пятнадцать рублей 00 копеек')
  })
})
