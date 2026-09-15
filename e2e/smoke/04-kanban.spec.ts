import { test, expect } from '@playwright/test'
import { admin, login, smokeName, smokeOrgId, smokeUserId, waitForRow } from './helpers'
import { cleanupSmokeRecords } from '../seed'

test.describe('канбан сделок', () => {
  test.afterAll(async () => { await cleanupSmokeRecords() })

  test('перетаскивание карточки меняет стадию в базе', async ({ page }) => {
    const notes = smokeName('канбан')
    // Сделку заводим на второй стадии: движение назад по воронке разрешено
    // всегда, вперёд — только с закрытым чек-листом. Проверяем сам механизм DnD.
    const { data: created, error } = await admin()
      .from('deals')
      .insert({
        deal_type: 'sale',
        status: 'valuation',
        notes,
        organization_id: await smokeOrgId(),
        manager_id: await smokeUserId(),
      })
      .select('id')
      .single()
    if (error || !created) throw new Error(`не удалось завести сделку: ${error?.message}`)

    await login(page)
    await page.goto('/deals')

    const card = page.locator(`[data-testid="kanban-card"][data-deal-id="${created.id}"]`)
    await expect(card).toBeVisible({ timeout: 30_000 })
    const target = page.locator('[data-testid="kanban-column"][data-direction="sale"][data-stage="sourcing"]')
    await expect(target).toBeVisible()

    await card.dragTo(target)

    const deal = await waitForRow(() =>
      admin().from('deals').select('status').eq('id', created.id).eq('status', 'sourcing').maybeSingle()
    )
    expect(deal.status).toBe('sourcing')
  })
})
