import { describe, it, expect } from 'vitest'
import { buildBasicContractXml, type BasicDocVars } from '@/features/contracts/services/basic-docx'

const vars: BasicDocVars = {
  CONTRACT_NUMBER: 'АГ-2026-001', CONTRACT_DATE: '29 октября 2026 г.', CITY: 'г. Красноярск',
  PARTY2_NAME: 'Орлов Павел', PARTY2_PASSPORT: '0412 556501', PARTY2_PHONE: '+79990000000',
  OWNER_NAME: 'Орлов Павел', OWNER_PASSPORT: '0412 556501', OWNER_PHONE: '+79990000000',
  PROPERTY_TITLE: '2к Мира', PROPERTY_ADDRESS: 'ул. Мира, 10', PROPERTY_AREA: '54 кв.м.',
  START_DATE: '1 ноября 2026 г.', END_DATE: '30 сентября 2027 г.',
  PRICE: '8 750', PRICE_WORDS: 'восемь тысяч семьсот пятьдесят рублей', DEPOSIT: '0', DEPOSIT_WORDS: 'ноль рублей',
  ИСПОЛНИТЕЛЬ_НАЗВАНИЕ: 'ИП Тестов',
}
const text = (xml: string) => [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map(m => m[1]).join('\n')

describe('документ без шаблона (QA 28.10.2026: A-06, A-07, B-07)', () => {
  it('агентский договор — без «Сроки аренды», с вознаграждением и агентством', () => {
    const t = text(buildBasicContractXml(vars, 'agency_owner'))
    expect(t).not.toMatch(/Сроки аренды/)
    expect(t).toMatch(/Вознаграждение агентства: 8 750 руб/)
    expect(t).toMatch(/ИП Тестов/)
    expect(t).toMatch(/шаблон этого типа договора не загружен/i)
  })
  it('купля-продажа — одна дата сделки', () => {
    const t = text(buildBasicContractXml(vars, 'sale'))
    expect(t).toMatch(/Дата сделки/)
    expect(t).not.toMatch(/Окончание/)
  })
  it('у юрлица нет строки «Паспорт»', () => {
    const t = text(buildBasicContractXml({ ...vars, PARTY2_NAME: 'ООО Ромашка', PARTY2_IS_LEGAL: true }, 'agency_legal_entity'))
    const lines = t.split('\n')
    const i = lines.findIndex(l => l.includes('ООО Ромашка'))
    expect(lines[i + 1]).not.toMatch(/^Паспорт/)
  })
  it('заданы шрифт и поля страницы', () => {
    const xml = buildBasicContractXml(vars, 'rent_apartment')
    expect(xml).toMatch(/Times New Roman/)
    expect(xml).toMatch(/<w:pgMar /)
  })
})
