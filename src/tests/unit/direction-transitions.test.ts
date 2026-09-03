import { describe, it, expect } from 'vitest'
import { canMoveStage, type DealFacts } from '@/features/directions/services/transitions'

/**
 * Факты о работе, при которых выполнено всё: договоры подписаны, тариф выбран,
 * фотографии есть, объект опубликован. Тест переопределяет ровно то, что
 * проверяет, — так видно, какое именно условие вызвало отказ.
 */
function facts(over: Partial<DealFacts> = {}): DealFacts {
  return {
    id: 'deal-1',
    deal_type: 'rent_agent',
    status: 'sourcing',
    property_id: 'prop-1',
    plan_id: 'plan-1',
    stage_progress: {},
    signedContractTypes: new Set([
      'agency_owner', 'agency_client', 'agency_legal_entity',
      'property_management', 'rent_apartment', 'sale',
    ]),
    hasSettlementScheme: true,
    photoCount: 3,
    isPublished: true,
    hasIncome: true,
    advanceAmount: 300000,
    expectedCloseDate: '2026-10-15',
    ...over,
  }
}

/** Все обязательные пункты стадии закрыты. */
const doneAll = (stage: string, items: string[]) => ({ [stage]: items })

describe('canMoveStage — принадлежность стадии направлению', () => {
  it('пропускает стадию своего направления', () => {
    const v = canMoveStage(facts({ status: 'showings', stage_progress: doneAll('showings', ['published', 'shown']) }), 'tenant_check')
    expect(v.allowed).toBe(true)
  })

  it('отклоняет стадию чужого направления и называет направление', () => {
    const v = canMoveStage(facts({ status: 'sourcing' }), 'registration')
    expect(v.allowed).toBe(false)
    expect(v.reason).toContain('не применяется в направлении')
    expect(v.reason).toContain('Аренда')
  })

  it('отклоняет несуществующую стадию', () => {
    expect(canMoveStage(facts(), 'nonsense').allowed).toBe(false)
  })
})

describe('canMoveStage — порядок работы в подборе для арендатора', () => {
  const base = {
    deal_type: 'tenant_search',
    status: 'search_contract',
    stage_progress: doneAll('search_contract', ['contract_made', 'commission_fixed', 'contract_signed']),
  }

  it('без подписанного договора на подбор к поиску не пускает', () => {
    const v = canMoveStage(facts({ ...base, signedContractTypes: new Set<string>() }), 'searching')
    expect(v.allowed).toBe(false)
    expect(v.reason).toContain('Поиск вариантов начинается после договора')
  })

  it('с подписанным договором пускает', () => {
    const v = canMoveStage(facts({ ...base, signedContractTypes: new Set(['agency_client']) }), 'searching')
    expect(v.allowed).toBe(true)
  })
})

describe('canMoveStage — чек-лист держит стадию', () => {
  it('не отпускает, пока обязательные пункты не закрыты, и перечисляет их', () => {
    const v = canMoveStage(facts({ status: 'preparation', stage_progress: doneAll('preparation', ['photos']) }), 'showings')
    expect(v.allowed).toBe(false)
    expect(v.reason).toContain('не закрыты обязательные пункты')
    expect(v.reason).toContain('Фотографии загружены в объект')
  })

  it('необязательный пункт не мешает', () => {
    const v = canMoveStage(
      facts({ status: 'preparation', stage_progress: doneAll('preparation', ['photos', 'photos_up', 'description']) }),
      'showings',
    )
    expect(v.allowed).toBe(true)
  })
})

describe('canMoveStage — предусловия по данным', () => {
  it('без фотографий на показы не пускает', () => {
    const v = canMoveStage(
      facts({ status: 'preparation', photoCount: 0, stage_progress: doneAll('preparation', ['photos', 'photos_up', 'description']) }),
      'showings',
    )
    expect(v.allowed).toBe(false)
    expect(v.reason).toContain('фотографии')
  })

  it('без выбранного тарифа к подготовке не пускает', () => {
    const v = canMoveStage(
      facts({ status: 'agency_contract', plan_id: null, stage_progress: doneAll('agency_contract', ['contract_made', 'contract_signed']) }),
      'preparation',
    )
    expect(v.allowed).toBe(false)
    expect(v.reason).toContain('тариф')
  })

  it('в управлении без выбранной схемы расчёта договор не оформить', () => {
    const v = canMoveStage(
      facts({
        deal_type: 'management',
        status: 'meeting',
        hasSettlementScheme: false,
        stage_progress: doneAll('meeting', ['visited', 'services_told', 'plan_agreed', 'scheme_agreed']),
      }),
      'mgmt_contract',
    )
    expect(v.allowed).toBe(false)
    expect(v.reason).toContain('схему расчёта')
  })
})

describe('canMoveStage — предварительный договор в продаже', () => {
  const base = {
    deal_type: 'sale',
    status: 'preliminary',
    stage_progress: { preliminary: ['terms', 'advance', 'deadline', 'signed'] },
  }

  it('без аванса и срока к основному договору не пускает', () => {
    const v = canMoveStage(facts({ ...base, advanceAmount: null, expectedCloseDate: null }), 'main_contract')
    expect(v.allowed).toBe(false)
    expect(v.reason).toContain('аванса или задатка')
  })

  it('только аванса без срока недостаточно', () => {
    const v = canMoveStage(facts({ ...base, advanceAmount: 300000, expectedCloseDate: null }), 'main_contract')
    expect(v.allowed).toBe(false)
  })

  it('с обеими величинами пускает', () => {
    expect(canMoveStage(facts(base), 'main_contract').allowed).toBe(true)
  })
})

describe('canMoveStage — терминальные состояния и возвраты', () => {
  it('назад двигать можно свободно: это исправление ошибки', () => {
    expect(canMoveStage(facts({ status: 'showings' }), 'preparation').allowed).toBe(true)
  })

  it('из завершённой работы вперёд двигать некуда', () => {
    const v = canMoveStage(facts({ status: 'completed' }), 'showings')
    expect(v.allowed).toBe(false)
    expect(v.reason).toContain('дальше двигать некуда')
  })

  it('«В обслуживании» — терминал управления, а не промежуточная стадия', () => {
    const v = canMoveStage(facts({ deal_type: 'management', status: 'in_service' }), 'showings')
    expect(v.allowed).toBe(false)
  })

  it('отменить можно с любой стадии', () => {
    expect(canMoveStage(facts({ status: 'showings' }), 'cancelled').allowed).toBe(true)
    expect(canMoveStage(facts({ status: 'completed' }), 'cancelled').allowed).toBe(true)
  })

  it('вернуть из отмены в работу можно', () => {
    expect(canMoveStage(facts({ status: 'cancelled' }), 'sourcing').allowed).toBe(true)
  })

  it('работу с неизвестным направлением не двигает', () => {
    const v = canMoveStage(facts({ deal_type: 'subrent' }), 'sourcing')
    expect(v.allowed).toBe(false)
    expect(v.reason).toContain('неизвестное направление')
  })
})
