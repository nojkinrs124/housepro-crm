import { describe, it, expect } from 'vitest'
import {
  renderIntakeCard,
  intakeBlockers,
  describeIntakePlan,
  renderCollectingStatus,
  stripBinaryFromHistory,
  directionFor,
  stageFor,
  plural,
  INTAKE_PROMPTS,
  INTAKE_TOOL,
  type IntakeExtraction,
} from '@/features/telegram/services/intake-format'

const tenant: IntakeExtraction = {
  contact: {
    full_name: 'Иванов Иван Иванович',
    phone: '+7 912 345-67-89',
    birth_date: '1990-01-01',
    passport_series: '45 12',
    passport_number: '123456',
    passport_issued_by: 'ОВД района Тестовый',
    passport_issued_date: '2015-03-12',
    passport_department_code: '770-001',
    city: 'Москва',
    street: 'ул. Ленина',
    house_number: '10',
    apartment: '5',
  },
  lead: { deal_type: 'rent', rooms: 2, budget_max: 40000, comment: 'срочно, с котом' },
  uncertain: ['код подразделения'],
}

describe('renderIntakeCard', () => {
  it('арендатор: показывает паспорт целиком, пожелания, план и сомнения', () => {
    const text = renderIntakeCard('tenant', tenant, { createDeal: true, fileCount: 2 })
    // До 17.09.2026 подтверждение показывало только имя и телефон — ошибку
    // распознавания паспорта было негде заметить.
    expect(text).toContain('Паспорт 45 12 № 123456')
    expect(text).toContain('выдан ОВД района Тестовый 12.03.2015')
    expect(text).toContain('код 770-001')
    expect(text).toContain('Родился(ась) 01.01.1990')
    expect(text).toContain('Регистрация: Москва, ул. Ленина, д. 10, кв. 5')
    expect(text).toContain('📞 +7 912 345-67-89')
    expect(text).toContain('Хочет: Снять, 2к, до 40 000 ₽ — срочно, с котом')
    expect(text).toContain('⚠️ Не уверен: код подразделения')
    expect(text).toContain('сделку «Подбор для арендатора», стадия «Обращение»')
    expect(text).toContain('приложу 2 файла')
  })

  it('без телефона просит его дописать', () => {
    const text = renderIntakeCard('tenant', { contact: { full_name: 'Петров П. П.' } }, { createDeal: true, fileCount: 1 })
    expect(text).toContain('телефон не указан')
  })

  it('собственник с выпиской: объект и связка', () => {
    const x: IntakeExtraction = {
      contact: { full_name: 'Сидорова Анна', phone: '89990000000' },
      property: { address: 'г. Москва, ул. Мира, 1, кв. 7', cadastral_number: '77:01:0001001:1234', area: 45.5, rooms: 2, floor: 3, total_floors: 9, encumbrances: 'ипотека' },
      deal: { direction: 'management' },
    }
    const text = renderIntakeCard('owner', x, { createDeal: true, fileCount: 3 })
    expect(text).toContain('кадастр. 77:01:0001001:1234 · 45.5 м² · 2-комн. · этаж 3/9')
    expect(text).toContain('⚠️ Обременения: ипотека')
    expect(text).toContain('объект, связав с собственником')
    expect(text).toContain('сделку «Управление», стадия «Поиск и контакт»')
  })

  it('договор: обе стороны и условия', () => {
    const x: IntakeExtraction = {
      contact: { full_name: 'Собственник С.', phone: '1' },
      tenant: { full_name: 'Арендатор А.', phone: '2' },
      property: { address: 'адрес', price: 35000, deposit: 35000 },
      deal: { amount: 35000, notes: '11 месяцев' },
    }
    const text = renderIntakeCard('contract', x, { createDeal: true, fileCount: 1 })
    expect(text).toContain('Собственник: Собственник С.')
    expect(text).toContain('Арендатор: Арендатор А.')
    expect(text).toContain('Условия: 35 000 ₽/мес · 11 месяцев')
    expect(text).toContain('стадия «Проверка и договор найма»')
  })

  it('в карточке нет символов, ломающих HTML Telegram', () => {
    const text = renderIntakeCard('property', { property: { address: 'адрес' } }, { createDeal: false, fileCount: 0 })
    expect(text.replace(/<\/?(b|i|code)>/g, '')).not.toMatch(/[<>]/)
  })
})

describe('intakeBlockers', () => {
  it('арендатору нужно ФИО, объекту — адрес, договору — всё', () => {
    expect(intakeBlockers('tenant', {})).toEqual(['ФИО арендатора'])
    expect(intakeBlockers('owner', { contact: { full_name: ' ' } })).toEqual(['ФИО собственника'])
    expect(intakeBlockers('property', {})).toEqual(['адрес объекта'])
    expect(intakeBlockers('contract', {})).toEqual(['ФИО собственника', 'ФИО арендатора', 'адрес объекта'])
    expect(intakeBlockers('tenant', tenant)).toEqual([])
  })
})

describe('describeIntakePlan / directionFor / stageFor', () => {
  it('арендатор всегда идёт в подбор, собственник — по direction', () => {
    expect(directionFor('tenant', { deal: { direction: 'sale' } })).toBe('tenant_search')
    expect(directionFor('owner', {})).toBe('rent_agent')
    expect(directionFor('owner', { deal: { direction: 'sale' } })).toBe('sale')
    // «подбор» для собственника — бессмыслица, откатываемся к аренде
    expect(directionFor('owner', { deal: { direction: 'tenant_search' } })).toBe('rent_agent')
    expect(stageFor('tenant', 'tenant_search')).toBe('inquiry')
    expect(stageFor('contract', 'rent_agent')).toBe('tenant_check')
    expect(stageFor('owner', 'management')).toBe('sourcing')
  })

  it('без сделки план не обещает сделку', () => {
    const plan = describeIntakePlan('tenant', tenant, false, 0).join(' ')
    expect(plan).toContain('лид (источник Telegram)')
    expect(plan).not.toContain('сделку')
    expect(plan).toContain('не продублирую')
  })
})

describe('renderCollectingStatus', () => {
  it('без типа спрашивает, что это; с типом считает материалы', () => {
    expect(renderCollectingStatus('unknown', [], [])).toContain('Что это?')
    const files = [
      { path: 'a', mime: 'image/jpeg', name: 'a.jpg', source: 'photo' as const },
      { path: 'b', mime: 'image/jpeg', name: 'b.jpg', source: 'photo' as const },
      { path: 'c', mime: 'application/pdf', name: 'c.pdf', source: 'document' as const },
    ]
    const text = renderCollectingStatus('tenant', files, ['8912'])
    expect(text).toContain('2 фото, 1 документ, 1 заметка')
    expect(text).toContain('«Готово»')
  })
})

describe('plural', () => {
  it('склоняет по-русски', () => {
    expect(plural(1, 'файл', 'файла', 'файлов')).toBe('файл')
    expect(plural(3, 'файл', 'файла', 'файлов')).toBe('файла')
    expect(plural(11, 'файл', 'файла', 'файлов')).toBe('файлов')
    expect(plural(22, 'файл', 'файла', 'файлов')).toBe('файла')
  })
})

describe('stripBinaryFromHistory', () => {
  it('заменяет фото и PDF метками, режет длинные ответы инструментов', () => {
    const big = 'x'.repeat(10_000)
    const out = stripBinaryFromHistory([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'вот' },
          { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + big } },
          { type: 'file', file: { filename: 'egrn.pdf', file_data: 'data:application/pdf;base64,' + big } },
        ],
      },
      { role: 'tool', content: big },
      { role: 'assistant', content: 'ок' },
    ])
    const serialized = JSON.stringify(out)
    expect(serialized).not.toContain(big)
    expect(serialized).toContain('[фото — уже обработано')
    expect(serialized).toContain('[документ «egrn.pdf»')
    expect((out[1].content as string).length).toBeLessThan(6100)
    expect(out[2]).toEqual({ role: 'assistant', content: 'ок' })
  })
})

describe('промпты и схема извлечения', () => {
  it('у каждого типа свой промпт, схема — один инструмент', () => {
    expect(Object.keys(INTAKE_PROMPTS).sort()).toEqual(['contract', 'owner', 'property', 'tenant'])
    expect(INTAKE_PROMPTS.tenant).toContain('АРЕНДАТОРА')
    expect(INTAKE_PROMPTS.owner).toContain('«let»')
    expect(INTAKE_TOOL.function.name).toBe('submit_extraction')
    // Словарь лида совпадает с CRM-формой (rent/sale/let/sell/subrent).
    expect(INTAKE_TOOL.function.parameters.properties.lead.properties.deal_type.enum).toEqual(['rent', 'sale', 'let', 'sell', 'subrent'])
  })
})
