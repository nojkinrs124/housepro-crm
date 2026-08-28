import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSupabaseMock } from '../helpers/supabase-mock'

const mockCreateClient = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}))

describe('updateDealStatusAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('принимает все валидные статусы сделки', async () => {
    const statuses = ['new', 'showing', 'negotiation', 'contract', 'payment', 'completed', 'cancelled']

    for (const status of statuses) {
      const { supabase } = createSupabaseMock({ data: {}, error: null })
      mockCreateClient.mockResolvedValue(supabase)
      vi.resetModules()

      const { updateDealStatusAction } = await import('@/features/deals/actions/deals.actions')
      const result = await updateDealStatusAction('deal-1', status) as { error?: string; success?: boolean }
      expect(result?.error).toBeUndefined()
      expect(result?.success).toBe(true)
    }
  })

  it('отклоняет невалидный статус', async () => {
    const { supabase } = createSupabaseMock({ data: {}, error: null })
    mockCreateClient.mockResolvedValue(supabase)

    const { updateDealStatusAction } = await import('@/features/deals/actions/deals.actions')
    const result = await updateDealStatusAction('deal-1', 'hacked_status') as { error?: string }
    expect(result?.error).toContain('Недопустимый статус')
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('возвращает error если не авторизован', async () => {
    const { supabase } = createSupabaseMock({ user: null })
    mockCreateClient.mockResolvedValue(supabase)

    const { updateDealStatusAction } = await import('@/features/deals/actions/deals.actions')
    const result = await updateDealStatusAction('deal-1', 'new') as { error?: string }
    expect(result?.error).toBe('Не авторизован')
  })

  it('возвращает error от Supabase', async () => {
    const { supabase } = createSupabaseMock({
      data: null,
      error: { message: 'Foreign key violation' },
    })
    mockCreateClient.mockResolvedValue(supabase)

    const { updateDealStatusAction } = await import('@/features/deals/actions/deals.actions')
    const result = await updateDealStatusAction('deal-1', 'completed') as { error?: string }
    expect(result?.error).toBe('Foreign key violation')
  })
})

describe('createDealAction — валидация', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('отклоняет неверный тип сделки', async () => {
    const { supabase } = createSupabaseMock({ data: null, error: null })
    mockCreateClient.mockResolvedValue(supabase)

    const { createDealAction } = await import('@/features/deals/actions/deals.actions')
    const formData = new FormData()
    formData.set('deal_type', 'invalid_type')

    const result = await createDealAction(formData)
    expect(result?.error).toBeDefined()
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('редиректит при успехе (выбрасывает NEXT_REDIRECT)', async () => {
    const { supabase } = createSupabaseMock({ data: {}, error: null })
    mockCreateClient.mockResolvedValue(supabase)

    const { createDealAction } = await import('@/features/deals/actions/deals.actions')
    const formData = new FormData()
    formData.set('deal_type', 'rent')

    await expect(createDealAction(formData)).rejects.toThrow('NEXT_REDIRECT:/deals')
  })
})
