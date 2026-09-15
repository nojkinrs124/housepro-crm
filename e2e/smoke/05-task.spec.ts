import { test, expect } from '@playwright/test'
import { admin, login, smokeName, smokeOrgId, smokeUserId, waitForRow } from './helpers'
import { cleanupSmokeRecords } from '../seed'

test.describe('создание задачи', () => {
  test.afterAll(async () => { await cleanupSmokeRecords() })

  test('форма создаёт задачу на себя со статусом todo', async ({ page }) => {
    const title = smokeName('задача')
    await login(page)

    await page.goto('/tasks/new')
    await page.getByTestId('task-title').fill(title)
    await page.getByTestId('task-submit').click()

    const task = await waitForRow(() =>
      admin().from('tasks').select('id, status, assigned_to, organization_id').eq('title', title).maybeSingle()
    )
    expect(task.organization_id).toBe(await smokeOrgId())
    expect(task.status).toBe('todo')
    expect(task.assigned_to).toBe(await smokeUserId())
  })
})
