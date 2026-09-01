import { describe, it, expect } from 'vitest'
import {
  contractNumberFromPurpose,
  matchDocument,
  parse1CStatement,
  type BankDocument,
  type PlannedTransaction,
} from '@/lib/import/bank-statement'

const STATEMENT = [
  '1CClientBankExchange',
  'ВерсияФормата=1.03',
  'Кодировка=Windows',
  'Отправитель=Банк',
  'ДатаНачала=01.09.2026',
  'ДатаКонца=30.09.2026',
  'РасчСчет=40802810100000012345',
  'СекцияДокумент=Платежное поручение',
  'Номер=115',
  'Дата=05.09.2026',
  'Сумма=45000.00',
  'ПлательщикСчет=40702810900000098765',
  'Плательщик=ООО "Ромашка"',
  'ПлательщикИНН=7707083893',
  'ПолучательСчет=40802810100000012345',
  'ПолучательИНН=246000000000',
  'НазначениеПлатежа=Оплата по договору № АР-12 от 01.09.2026, НДС не облагается',
  'КонецДокумента',
  'СекцияДокумент=Платежное поручение',
  'Номер=7',
  'Дата=06.09.2026',
  'Сумма=3 500,50',
  'ПлательщикСчет=40802810100000012345',
  'Плательщик=ИП Иванов',
  'ПолучательСчет=40702810000000011111',
  'НазначениеПлатежа=Оплата за услуги связи',
  'КонецДокумента',
  'КонецФайла',
].join('\r\n')

describe('parse1CStatement', () => {
  it('читает шапку выписки', () => {
    const statement = parse1CStatement(STATEMENT, ['40802810100000012345'])
    expect(statement.account).toBe('40802810100000012345')
    expect(statement.dateFrom).toBe('2026-09-01')
    expect(statement.dateTo).toBe('2026-09-30')
  })

  it('разбирает документы и приводит суммы с пробелами и запятой', () => {
    const { documents } = parse1CStatement(STATEMENT, ['40802810100000012345'])
    expect(documents).toHaveLength(2)
    expect(documents[0].amount).toBe(45000)
    expect(documents[1].amount).toBe(3500.5)
  })

  it('отличает входящий платёж от исходящего по счёту организации', () => {
    const { documents } = parse1CStatement(STATEMENT, ['40802810100000012345'])
    expect(documents[0].incoming).toBe(true)
    // Второй документ уходит с нашего счёта — это расход, а не поступление.
    expect(documents[1].incoming).toBe(false)
  })

  it('переводит даты в ISO', () => {
    const { documents } = parse1CStatement(STATEMENT, ['40802810100000012345'])
    expect(documents[0].date).toBe('2026-09-05')
  })

  it('сохраняет реквизиты плательщика и назначение', () => {
    const { documents } = parse1CStatement(STATEMENT, ['40802810100000012345'])
    expect(documents[0].payerInn).toBe('7707083893')
    expect(documents[0].purpose).toContain('АР-12')
  })
})

describe('contractNumberFromPurpose', () => {
  it('достаёт номер договора из назначения платежа', () => {
    expect(contractNumberFromPurpose('Оплата по договору № АР-12 от 01.09.2026')).toBe('АР-12')
    expect(contractNumberFromPurpose('оплата по договору 145 за сентябрь')).toBe('145')
  })

  it('возвращает null, когда договора в назначении нет', () => {
    expect(contractNumberFromPurpose('Возврат средств')).toBeNull()
    expect(contractNumberFromPurpose(null)).toBeNull()
  })
})

describe('matchDocument', () => {
  const doc: BankDocument = {
    number: '115',
    date: '2026-09-05',
    amount: 45000,
    payerName: 'ООО "Ромашка"',
    payerInn: '7707083893',
    payerAccount: null,
    recipientName: null,
    recipientInn: null,
    recipientAccount: null,
    purpose: 'Оплата по договору № АР-12 от 01.09.2026',
    incoming: true,
  }

  const planned: PlannedTransaction[] = [
    { id: 't1', amount: 45000, due_date: '2026-09-05', description: 'Аренда за сентябрь', contract_number: 'АР-12', client_inn: '7707083893' },
    { id: 't2', amount: 45000, due_date: '2026-10-05', description: 'Аренда за октябрь', contract_number: 'АР-99', client_inn: '5000000000' },
  ]

  it('выбирает начисление по номеру договора, а не первое подходящее по сумме', () => {
    const match = matchDocument(doc, planned)
    expect(match?.transactionId).toBe('t1')
    expect(match?.confidence).toBe('exact')
  })

  it('падает на ИНН плательщика, когда договор в назначении не указан', () => {
    const match = matchDocument({ ...doc, purpose: 'Оплата аренды' }, planned)
    expect(match?.transactionId).toBe('t1')
    expect(match?.confidence).toBe('exact')
  })

  it('не гадает, когда по сумме подходят несколько начислений', () => {
    const anonymous = { ...doc, purpose: 'Оплата', payerInn: null }
    expect(matchDocument(anonymous, planned)).toBeNull()
  })

  it('единственное совпадение по сумме помечает как требующее проверки', () => {
    const single: PlannedTransaction[] = [
      { id: 't3', amount: 45000, due_date: null, description: 'Аренда', contract_number: null, client_inn: null },
    ]
    const match = matchDocument({ ...doc, purpose: 'Оплата', payerInn: null }, single)
    expect(match?.confidence).toBe('amount')
  })

  it('допускает расхождение в пределах рубля (банковское округление)', () => {
    const single: PlannedTransaction[] = [
      { id: 't4', amount: 45000.4, due_date: null, description: 'Аренда', contract_number: null, client_inn: null },
    ]
    expect(matchDocument({ ...doc, purpose: 'Оплата', payerInn: null }, single)).not.toBeNull()
  })

  it('не сопоставляет платёж с другой суммой', () => {
    expect(matchDocument({ ...doc, amount: 12000 }, planned)).toBeNull()
  })
})
