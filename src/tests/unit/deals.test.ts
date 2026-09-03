import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSupabaseMock } from '../helpers/supabase-mock'

const mockCreateClient = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}))

/**
 * Работа на первой стадии направления, у которой закрыт весь обязательный
 * чек-лист и подписаны все нужные договоры: такую можно двигать куда угодно
 * вперёд, и тест проверяет именно переход, а не предусловия.
 */
function readyDeal(direction: string, status: string, progress: Record<string, string[]> = {}) {
  return {
    tables: {
      deals: { data: { id: 'deal-1', deal_type: direction, status, property_id: 'prop-1', plan_id: 'plan-1', stage_progress: progress } },
      contracts: { data: [
        { contract_type: 'agency_owner', status: 'signed', settlement_scheme: null },
        { contract_type: 'property_management', status: 'signed', settlement_scheme: 'percent' },
        { contract_type: 'agency_client', status: 'signed', settlement_scheme: null },
        { contract_type: 'rent_apartment', status: 'signed', settlement_scheme: null },
        { contract_type: 'sale', status: 'signed', settlement_scheme: null },
      ] },
      properties: { data: { photo_urls: ['a.jpg'], site_publish: true, avito_publish: false } },
      accounting_transactions: { data: [{ id: 'tx-1' }] },
    },
  }
}

describe('updateDealStatusAction — переходы по воронке направления', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('переводит работу на стадию её направления', async () => {
    const { supabase } = createSupabaseMock(readyDeal('rent_agent', 'preparation', {
      preparation: ['photos', 'photos_up', 'description'],
    }))
    mockCreateClient.mockResolvedValue(supabase)

    const { updateDealStatusAction } = await import('@/features/deals/actions/deals.actions')
    const result = await updateDealStatusAction('deal-1', 'showings')

    expect(result?.error).toBeUndefined()
    expect(result?.success).toBe(true)
  })

  it('отклоняет стадию из чужого направления и объясняет почему', async () => {
    const { supabase } = createSupabaseMock(readyDeal('rent_agent', 'sourcing'))
    mockCreateClient.mockResolvedValue(supabase)

    const { updateDealStatusAction } = await import('@/features/deals/actions/deals.actions')
    // «Регистрация перехода права» бывает только в продаже.
    const result = await updateDealStatusAction('deal-1', 'registration')

    expect(result?.error).toContain('не применяется в направлении')
  })

  it('отклоняет несуществующую стадию', async () => {
    const { supabase } = createSupabaseMock(readyDeal('rent_agent', 'sourcing'))
    mockCreateClient.mockResolvedValue(supabase)

    const { updateDealStatusAction } = await import('@/features/deals/actions/deals.actions')
    const result = await updateDealStatusAction('deal-1', 'hacked_status')

    expect(result?.error).toBeDefined()
  })

  it('не пускает к поиску вариантов без договора на подбор', async () => {
    const { supabase } = createSupabaseMock({
      tables: {
        deals: { data: { id: 'deal-1', deal_type: 'tenant_search', status: 'search_contract', property_id: null, plan_id: 'plan-1', stage_progress: { search_contract: ['contract_made', 'commission_fixed', 'contract_signed'] } } },
        contracts: { data: [] },
        accounting_transactions: { data: [] },
      },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const { updateDealStatusAction } = await import('@/features/deals/actions/deals.actions')
    const result = await updateDealStatusAction('deal-1', 'searching')

    expect(result?.error).toContain('договор на услуги подбора')
  })

  it('не пускает дальше, пока не закрыт обязательный чек-лист стадии', async () => {
    const { supabase } = createSupabaseMock(readyDeal('rent_agent', 'preparation', {
      preparation: ['photos'],
    }))
    mockCreateClient.mockResolvedValue(supabase)

    const { updateDealStatusAction } = await import('@/features/deals/actions/deals.actions')
    const result = await updateDealStatusAction('deal-1', 'showings')

    expect(result?.error).toContain('не закрыты обязательные пункты')
  })

  it('разрешает вернуть работу на шаг назад', async () => {
    const { supabase } = createSupabaseMock(readyDeal('rent_agent', 'showings'))
    mockCreateClient.mockResolvedValue(supabase)

    const { updateDealStatusAction } = await import('@/features/deals/actions/deals.actions')
    const result = await updateDealStatusAction('deal-1', 'preparation')

    expect(result?.error).toBeUndefined()
  })

  it('возвращает error если не авторизован', async () => {
    const { supabase } = createSupabaseMock({ user: null })
    mockCreateClient.mockResolvedValue(supabase)

    const { updateDealStatusAction } = await import('@/features/deals/actions/deals.actions')
    const result = await updateDealStatusAction('deal-1', 'sourcing')
    expect(result?.error).toBe('Не авторизован')
  })

  it('сообщает, если сделка не найдена', async () => {
    const { supabase } = createSupabaseMock({ tables: { deals: { data: null } } })
    mockCreateClient.mockResolvedValue(supabase)

    const { updateDealStatusAction } = await import('@/features/deals/actions/deals.actions')
    const result = await updateDealStatusAction('deal-1', 'sourcing')
    expect(result?.error).toBe('Сделка не найдена')
  })
})

describe('createDealAction — валидация', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('отклоняет неизвестное направление', async () => {
    const { supabase } = createSupabaseMock({ data: null, error: null })
    mockCreateClient.mockResolvedValue(supabase)

    const { createDealAction } = await import('@/features/deals/actions/deals.actions')
    const formData = new FormData()
    formData.set('deal_type', 'invalid_type')

    const result = await createDealAction(formData)
    expect(result?.error).toBeDefined()
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('отклоняет старый тип сделки, которого больше нет', async () => {
    const { supabase } = createSupabaseMock({ data: null, error: null })
    mockCreateClient.mockResolvedValue(supabase)

    const { createDealAction } = await import('@/features/deals/actions/deals.actions')
    const formData = new FormData()
    // «subrent» переехал в управление со схемой фиксированной выплаты.
    formData.set('deal_type', 'subrent')

    const result = await createDealAction(formData)
    expect(result?.error).toBeDefined()
  })

  it('редиректит при успехе (выбрасывает NEXT_REDIRECT)', async () => {
    const { supabase } = createSupabaseMock({ data: {}, error: null })
    mockCreateClient.mockResolvedValue(supabase)

    const { createDealAction } = await import('@/features/deals/actions/deals.actions')
    const formData = new FormData()
    formData.set('deal_type', 'rent_agent')

    await expect(createDealAction(formData)).rejects.toThrow('NEXT_REDIRECT:/deals')
  })
})
