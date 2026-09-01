import { describe, it, expect, beforeAll } from 'vitest'
import {
  generateSignCode,
  generateSignToken,
  hashDocument,
  hashSignCode,
  maskEmail,
  maskPhone,
  verifySignCode,
} from '@/lib/signing'

beforeAll(() => {
  // Хэширование кода использует API_KEY_PEPPER — тот же секрет, что и API-ключи.
  process.env.API_KEY_PEPPER = 'test-pepper-value-for-unit-tests'
})

describe('generateSignToken', () => {
  it('выдаёт длинный непредсказуемый токен', () => {
    const a = generateSignToken()
    const b = generateSignToken()
    expect(a).toHaveLength(64)
    expect(a).not.toBe(b)
  })
})

describe('generateSignCode', () => {
  it('всегда шесть цифр, включая ведущие нули', () => {
    for (let i = 0; i < 50; i += 1) {
      expect(generateSignCode()).toMatch(/^\d{6}$/)
    }
  })
})

describe('hashSignCode / verifySignCode', () => {
  it('подтверждает верный код', () => {
    const token = generateSignToken()
    const hash = hashSignCode('123456', token)
    expect(verifySignCode('123456', token, hash)).toBe(true)
  })

  it('отклоняет неверный код', () => {
    const token = generateSignToken()
    const hash = hashSignCode('123456', token)
    expect(verifySignCode('654321', token, hash)).toBe(false)
  })

  it('один и тот же код в разных подписаниях даёт разные хэши', () => {
    expect(hashSignCode('123456', generateSignToken())).not.toBe(
      hashSignCode('123456', generateSignToken())
    )
  })

  it('код, выданный для другого токена, не подходит', () => {
    const hash = hashSignCode('123456', generateSignToken())
    expect(verifySignCode('123456', generateSignToken(), hash)).toBe(false)
  })

  it('отсутствие хэша — это не «подпись прошла»', () => {
    expect(verifySignCode('123456', generateSignToken(), null)).toBe(false)
  })
})

describe('hashDocument', () => {
  it('одинаковые файлы дают одинаковую контрольную сумму', () => {
    const a = hashDocument(Buffer.from('договор'))
    const b = hashDocument(Buffer.from('договор'))
    expect(a).toBe(b)
    expect(a).toHaveLength(64)
  })

  it('изменение файла меняет сумму — подмену видно', () => {
    expect(hashDocument(Buffer.from('договор'))).not.toBe(hashDocument(Buffer.from('договор ')))
  })
})

describe('маскирование контактов', () => {
  it('скрывает середину адреса', () => {
    expect(maskEmail('ivanov@mail.ru')).toBe('i****v@mail.ru')
  })

  it('не падает на пустых значениях', () => {
    expect(maskEmail(null)).toBeNull()
    expect(maskEmail('без-собаки')).toBeNull()
    expect(maskPhone(null)).toBeNull()
    expect(maskPhone('123')).toBeNull()
  })

  it('оставляет у телефона только последние цифры', () => {
    expect(maskPhone('+7 (999) 123-45-67')).toBe('+7 *** *** 45 67')
  })
})
