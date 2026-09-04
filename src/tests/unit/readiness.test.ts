import { describe, it, expect } from 'vitest'
import {
  checkProperty,
  checkContact,
  checkLead,
  checkContract,
  checkTransaction,
  summarize,
} from '@/lib/readiness'

const ids = (issues: { id: string }[]) => issues.map(i => i.id)

describe('checkProperty', () => {
  it('без собственника — критично: объект не попадёт в отчёт', () => {
    const issues = checkProperty({ id: 'p1' })
    expect(ids(issues)).toContain('property.owner')
    expect(issues.find(i => i.id === 'property.owner')?.level).toBe('blocker')
  })

  it('заполненный объект в аренде замечаний не даёт', () => {
    const issues = checkProperty(
      {
        id: 'p1',
        owner_id: 'c1',
        latitude: 55.7,
        longitude: 37.6,
        description: 'Светлая квартира',
        price: 50000,
        status: 'rented',
        deal_type: 'rent',
      },
      { hasActiveRentContract: true }
    )
    expect(issues).toHaveLength(0)
  })

  it('адрес без координат — на площадки не уйдёт', () => {
    const issues = checkProperty({ id: 'p1', owner_id: 'c1', description: 'x', price: 1, status: 'rented' })
    expect(ids(issues)).toContain('property.geo')
  })

  it('договор аренды при статусе «Доступно» — критичное расхождение', () => {
    const issues = checkProperty(
      { id: 'p1', owner_id: 'c1', latitude: 1, longitude: 1, description: 'x', price: 1, status: 'available' },
      { hasActiveRentContract: true }
    )
    const issue = issues.find(i => i.id === 'property.rented_but_available')
    expect(issue?.level).toBe('blocker')
  })

  it('статус «Сдано» без договора аренды — предупреждение', () => {
    const issues = checkProperty(
      { id: 'p1', owner_id: 'c1', latitude: 1, longitude: 1, description: 'x', price: 1, status: 'rented' },
      { hasActiveRentContract: false }
    )
    expect(ids(issues)).toContain('property.available_but_rented')
  })

  it('без контекста договора расхождение не выдумывается', () => {
    const issues = checkProperty({
      id: 'p1', owner_id: 'c1', latitude: 1, longitude: 1, description: 'x', price: 1, status: 'rented',
    })
    expect(ids(issues)).not.toContain('property.available_but_rented')
    expect(ids(issues)).not.toContain('property.rented_but_available')
  })

  it('объект в управлении без вознаграждения', () => {
    const issues = checkProperty({
      id: 'p1', owner_id: 'c1', latitude: 1, longitude: 1, description: 'x', price: 1,
      status: 'rented', deal_type: 'management',
    })
    expect(ids(issues)).toContain('property.management_fee')
  })
})

describe('checkContact', () => {
  it('физлицо без паспорта — в договоре будут пропуски', () => {
    const issues = checkContact({ id: 'c1', client_type: 'individual', phone: '+79001112233', email: 'a@b.ru' })
    expect(ids(issues)).toContain('contact.passport')
  })

  it('юрлицо проверяется по реквизитам, а не по паспорту', () => {
    const issues = checkContact({ id: 'c1', client_type: 'legal_entity', phone: '1', email: 'a@b.ru' })
    expect(ids(issues)).toContain('contact.legal_details')
    expect(ids(issues)).not.toContain('contact.passport')
  })

  it('без email — напоминания не уйдут', () => {
    const issues = checkContact({ id: 'c1', client_type: 'individual', phone: '1' })
    expect(ids(issues)).toContain('contact.email')
  })

  it('полностью заполненное физлицо — без замечаний', () => {
    const issues = checkContact({
      id: 'c1', client_type: 'individual', phone: '+79001112233', email: 'a@b.ru',
      passport_series: '1234', passport_number: '567890', passport_issued_by: 'ОВД',
    })
    expect(issues).toHaveLength(0)
  })

  it('пробелы вместо значения считаются пустотой', () => {
    const issues = checkContact({ id: 'c1', client_type: 'individual', phone: '  ', email: '  ' })
    expect(ids(issues)).toContain('contact.phone')
    expect(ids(issues)).toContain('contact.email')
  })
})

describe('checkLead', () => {
  it('без единого способа связи — критично', () => {
    const issues = checkLead({ id: 'l1', source: 'avito' })
    expect(issues.find(i => i.id === 'lead.contact')?.level).toBe('blocker')
  })

  it('мессенджера достаточно, чтобы связаться', () => {
    const issues = checkLead({ id: 'l1', telegram: '@user', source: 'avito' })
    expect(issues).toHaveLength(0)
  })

  it('без источника — аналитика по площадкам пустая', () => {
    const issues = checkLead({ id: 'l1', phone: '+79001112233' })
    expect(ids(issues)).toContain('lead.source')
  })
})

describe('checkContract', () => {
  it('без объекта и сторон — два блокера', () => {
    const issues = checkContract({ id: 'k1', contract_type: 'rent_apartment' })
    expect(ids(issues)).toContain('contract.property')
    expect(ids(issues)).toContain('contract.parties')
  })

  it('договору услуг агентства объект не нужен', () => {
    const issues = checkContract({ id: 'k1', contract_type: 'agency_client', client_contact_id: 'c1', owner_contact_id: 'c2' })
    expect(ids(issues)).not.toContain('contract.property')
  })

  it('заполненный договор аренды — без замечаний', () => {
    const issues = checkContract({
      id: 'k1', contract_type: 'rent_apartment', property_id: 'p1',
      owner_contact_id: 'c1', client_contact_id: 'c2',
      start_date: '2026-01-01', end_date: '2026-12-31', amount: 50000, contract_number: 'Д-1',
    })
    expect(issues).toHaveLength(0)
  })

  it('блокеры идут первыми', () => {
    const issues = checkContract({ id: 'k1', contract_type: 'rent_apartment' })
    expect(issues[0].level).toBe('blocker')
    expect(issues[issues.length - 1].level).toBe('warn')
  })
})

describe('checkTransaction', () => {
  it('запланированная операция без срока оплаты не попадёт в календарь', () => {
    const issues = checkTransaction({ id: 't1', type: 'income', category_id: 'c1', status: 'planned' })
    expect(ids(issues)).toContain('transaction.due_date')
  })

  it('без категории — пустая «Структура месяца»', () => {
    const issues = checkTransaction({ id: 't1', type: 'income', property_id: 'p1' })
    expect(ids(issues)).toContain('transaction.category')
  })

  it('расход без объекта и договора выпадает из доходности объекта', () => {
    const issues = checkTransaction({ id: 't1', type: 'expense', category_id: 'cat1' })
    expect(ids(issues)).toContain('transaction.property')
  })

  it('доход без объекта замечания не даёт — он приходит по договору', () => {
    const issues = checkTransaction({ id: 't1', type: 'income', category_id: 'cat1' })
    expect(issues).toHaveLength(0)
  })
})

describe('summarize', () => {
  it('считает блокеры и предупреждения раздельно', () => {
    const summary = summarize(checkContract({ id: 'k1', contract_type: 'rent_apartment' }))
    expect(summary.blockers).toBe(2)
    expect(summary.ok).toBe(false)
  })

  it('пустой список — всё в порядке', () => {
    expect(summarize([]).ok).toBe(true)
  })
})

describe('checkTransaction — просроченное «Запланировано»', () => {
  it('план с прошедшим сроком: деньги, вероятно, получены, а в прибыль не идут', () => {
    const issues = checkTransaction(
      { id: 't1', type: 'income', category_id: 'c1', status: 'planned', due_date: '2026-01-10' },
      '2026-09-03'
    )
    expect(issues.map(i => i.id)).toContain('transaction.stale_planned')
  })

  it('план с будущим сроком — это нормальный график начислений', () => {
    const issues = checkTransaction(
      { id: 't1', type: 'income', category_id: 'c1', status: 'planned', due_date: '2026-12-10' },
      '2026-09-03'
    )
    expect(issues).toHaveLength(0)
  })

  it('выполненная операция замечания не даёт', () => {
    const issues = checkTransaction(
      { id: 't1', type: 'income', category_id: 'c1', status: 'completed', due_date: '2026-01-10' },
      '2026-09-03'
    )
    expect(issues).toHaveLength(0)
  })
})

describe('объект с типом сделки «Управление»', () => {
  const base = { id: 'p1', owner_id: 'c1', latitude: 1, longitude: 2, description: 'есть', price: 1000 }

  it('без принятого обслуживания предупреждает и ведёт на приём', () => {
    // Жалоба 04.09.2026: поставил тип сделки «Управление», объект в разделе
    // не появился, и ничто об этом не сказало.
    const issues = checkProperty(
      { ...base, deal_type: 'management' },
      { hasActiveEngagement: false },
    )
    const issue = issues.find(i => i.id === 'property.engagement')
    expect(issue).toBeDefined()
    expect(issue?.href).toBe('/management/new?property_id=p1')
  })

  it('с принятым обслуживанием молчит', () => {
    const issues = checkProperty(
      { ...base, deal_type: 'management' },
      { hasActiveEngagement: true },
    )
    expect(issues.find(i => i.id === 'property.engagement')).toBeUndefined()
  })

  it('к объекту с другим типом сделки правило не применяется', () => {
    const issues = checkProperty(
      { ...base, deal_type: 'rent' },
      { hasActiveEngagement: false },
    )
    expect(issues.find(i => i.id === 'property.engagement')).toBeUndefined()
  })

  it('без сведения об обслуживании не гадает', () => {
    // контекст не передали — правило молчит, а не пугает зря
    const issues = checkProperty({ ...base, deal_type: 'management' })
    expect(issues.find(i => i.id === 'property.engagement')).toBeUndefined()
  })
})
