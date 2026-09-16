import { test, expect } from '@playwright/test'
import { admin, login, smokeName, smokeOrgId, waitForRow } from './helpers'
import { cleanupSmokeRecords } from '../seed'

test.describe('договор', () => {
  test.afterAll(async () => { await cleanupSmokeRecords() })

  test('создание и генерация DOCX: файл, версия, статус generated', async ({ page }) => {
    const notes = smokeName('договор')
    await login(page)

    await page.goto('/contracts/new')
    await page.getByTestId('contract-type-rent_apartment').check()
    // Примечания — в свёрнутом «Дополнительно»
    await page.getByTestId('form-extra').locator('summary').click()
    await page.getByTestId('contract-notes').fill(notes)
    await page.getByTestId('contract-submit').click()
    await page.waitForURL(/\/contracts\/[0-9a-f-]{36}$/, { timeout: 30_000 })

    const contract = await waitForRow(() =>
      admin().from('contracts').select('id, status, organization_id').eq('notes', notes).maybeSingle()
    )
    expect(contract.organization_id).toBe(await smokeOrgId())
    expect(contract.status).toBe('draft')

    await page.goto(`/contracts/${contract.id}/generate`)
    await page.getByTestId('contract-generate').click()
    await expect(page.getByTestId('contract-generate-success')).toBeVisible({ timeout: 60_000 })

    const generated = await waitForRow(() =>
      admin().from('contracts').select('status, generated_docx_url').eq('id', contract.id).eq('status', 'generated').maybeSingle()
    )
    expect(generated.generated_docx_url).toBeTruthy()

    const version = await waitForRow(() =>
      admin().from('contract_versions').select('version, docx_url').eq('contract_id', contract.id).eq('version', 1).maybeSingle()
    )
    expect(version.docx_url).toBeTruthy()
  })
})
