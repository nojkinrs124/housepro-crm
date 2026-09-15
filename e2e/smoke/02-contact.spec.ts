import { test, expect } from '@playwright/test'
import { admin, login, smokeName, smokeOrgId, waitForRow } from './helpers'
import { cleanupSmokeRecords } from '../seed'

test.describe('создание контакта', () => {
  test.afterAll(async () => { await cleanupSmokeRecords() })

  test('форма создаёт запись в contacts', async ({ page }) => {
    const name = smokeName('контакт')
    const phone = `+7 999 ${String(Date.now()).slice(-7, -4)}-${String(Date.now()).slice(-4, -2)}-${String(Date.now()).slice(-2)}`
    await login(page)

    await page.goto('/contacts/new')
    await page.getByTestId('contact-full-name').fill(name)
    await page.getByTestId('contact-phone').fill(phone)
    await page.getByTestId('contact-submit').click()

    const row = await waitForRow(() =>
      admin().from('contacts').select('id, full_name, phone, role, organization_id').eq('full_name', name).maybeSingle()
    )
    expect(row.organization_id).toBe(await smokeOrgId())
    expect(row.role).toBe('client')
    expect(row.phone).toBeTruthy()
  })
})
