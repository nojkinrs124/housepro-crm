import { describe, it, expect } from 'vitest'
import { mapPodpislonStatus, normalizePhone, PODPISLON_STATUS } from '@/lib/podpislon/api'
import { renderTextPdf, sanitizeForPdf, mergePdfs } from '@/lib/pdf/text-pdf'
import { consentPagesBlocks, SIGNING_CONSENT_VERSION } from '@/lib/pdf/consents'
import { buildSignablePdf, isPdf } from '@/features/contracts/services/signable-pdf.service'

const consent = {
  operatorName: 'ИП Ножкин Руслан Сергеевич',
  operatorInn: '772345678901',
  operatorAddress: 'г. Москва, ул. Тверская, д. 1',
  operatorPhone: '+7 999 123-45-67',
  operatorEmail: 'crm@example.ru',
  signerName: 'Иванов Иван Иванович',
  signerPhone: '+79991234567',
  documentLabel: 'Договор аренды № 12 от 02.09.2026',
  date: '02.09.2026',
}

describe('нормализация телефона для Подпислона', () => {
  it('приводит российские форматы к +7XXXXXXXXXX', () => {
    expect(normalizePhone('8 (999) 123-45-67')).toBe('+79991234567')
    expect(normalizePhone('+7 999 123 45 67')).toBe('+79991234567')
    expect(normalizePhone('9991234567')).toBe('+79991234567')
  })

  it('отбрасывает то, что телефоном не является', () => {
    expect(normalizePhone('12345')).toBeNull()
    expect(normalizePhone('')).toBeNull()
  })
})

describe('статусы документа', () => {
  it('переводит коды сервиса в статусы записи о подписи', () => {
    expect(mapPodpislonStatus(PODPISLON_STATUS.created)).toBe('pending')
    expect(mapPodpislonStatus(PODPISLON_STATUS.sent)).toBe('pending')
    expect(mapPodpislonStatus(PODPISLON_STATUS.opened)).toBe('viewed')
    expect(mapPodpislonStatus(PODPISLON_STATUS.signed)).toBe('signed')
    expect(mapPodpislonStatus(PODPISLON_STATUS.revoked)).toBe('declined')
    expect(mapPodpislonStatus(undefined)).toBe('pending')
  })
})

describe('подготовка текста к PDF', () => {
  it('оставляет кириллицу и типографику, выбрасывает несовместимое', () => {
    expect(sanitizeForPdf('Договор № 12 — «аренда»')).toBe('Договор № 12 — «аренда»')
    expect(sanitizeForPdf('цена 1000 ₽')).toBe('цена 1000 ₽')
    expect(sanitizeForPdf('текст с неразрывными')).toBe('текст с неразрывными')
    expect(sanitizeForPdf('эмодзи 🙂 внутри')).toBe('эмодзи   внутри')
  })
})

describe('файл на подпись', () => {
  it('рендерит согласия в PDF с кириллицей', async () => {
    const pdf = await renderTextPdf(consentPagesBlocks(consent))
    expect(isPdf(pdf)).toBe(true)
    expect(pdf.length).toBeGreaterThan(2000)
  })

  it('подшивает согласия к готовому PDF, сохраняя его страницы', async () => {
    const contract = await renderTextPdf([{ text: 'Текст договора', style: 'body' }])
    const consents = await renderTextPdf(consentPagesBlocks(consent))
    const merged = await mergePdfs([contract, consents])

    expect(isPdf(merged)).toBe(true)
    expect(merged.length).toBeGreaterThan(consents.length)
  })

  it('из готового PDF собирает файл с согласиями', async () => {
    const source = await renderTextPdf([{ text: 'Договор аренды квартиры', style: 'title' }])
    const result = await buildSignablePdf({ source, title: 'ДОГОВОР', consent })

    expect(isPdf(result)).toBe(true)
    expect(result.length).toBeGreaterThan(source.length)
  })

  it('версия текста согласий задана и попадает в запись о подписании', () => {
    expect(SIGNING_CONSENT_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
