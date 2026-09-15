import { test, expect } from '@playwright/test'
import { admin, login, smokeName, smokeOrgId, smokeUserId, waitForRow } from './helpers'
import { cleanupSmokeRecords } from '../seed'

test.describe('платёж по договору', () => {
  test.afterAll(async () => { await cleanupSmokeRecords() })

  test('начисление по договору и отметка «оплачено»', async ({ page }) => {
    const notes = smokeName('платёж')
    // Платёж проводится только по договору, который тест создал сам.
    const { data: contract, error } = await admin()
      .from('contracts')
      .insert({
        contract_type: 'rent_apartment',
        status: 'draft',
        notes,
        organization_id: await smokeOrgId(),
        manager_id: await smokeUserId(),
      })
      .select('id')
      .single()
    if (error || !contract) throw new Error(`не удалось завести договор: ${error?.message}`)

    await login(page)
    await page.goto(`/contracts/${contract.id}`)

    await page.getByTestId('payment-add-open').click()
    await page.getByTestId('payment-amount').fill('12345')
    await page.getByTestId('payment-submit').click()

    const planned = await waitForRow(() =>
      admin()
        .from('accounting_transactions')
        .select('id, type, status, amount')
        .eq('contract_id', contract.id)
        .eq('status', 'planned')
        .maybeSingle()
    )
    expect(planned.type).toBe('income')
    expect(Number(planned.amount)).toBe(12345)

    const complete = page.locator(`[data-testid="payment-complete"][data-transaction-id="${planned.id}"]`)
    await expect(complete).toBeVisible({ timeout: 30_000 })
    await complete.click()

    const done = await waitForRow(() =>
      admin().from('accounting_transactions').select('status, paid_at').eq('id', planned.id).eq('status', 'completed').maybeSingle()
    )
    expect(done.status).toBe('completed')
  })
})
