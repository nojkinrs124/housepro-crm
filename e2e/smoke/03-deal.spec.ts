import { test, expect } from '@playwright/test'
import { admin, login, smokeName, smokeOrgId, waitForRow } from './helpers'
import { cleanupSmokeRecords } from '../seed'

test.describe('создание сделки', () => {
  test.afterAll(async () => { await cleanupSmokeRecords() })

  test('форма создаёт сделку на первой стадии направления', async ({ page }) => {
    const notes = smokeName('сделка')
    await login(page)

    await page.goto('/deals/new')
    await page.getByTestId('deal-direction-sale').check()
    // Примечания — в свёрнутом блоке «Дополнительно» (правило ≤6 полей на виду)
    await page.getByTestId('form-extra').locator('summary').click()
    await page.getByTestId('deal-notes').fill(notes)
    await page.getByTestId('deal-submit').click()

    const deal = await waitForRow(() =>
      admin().from('deals').select('id, deal_type, status, organization_id, deal_number').eq('notes', notes).maybeSingle()
    )
    expect(deal.organization_id).toBe(await smokeOrgId())
    expect(deal.deal_type).toBe('sale')
    expect(deal.status).toBe('sourcing')
    expect(deal.deal_number).toBeGreaterThan(0)
  })
})
