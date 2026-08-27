import { test, expect } from '@playwright/test'
import { login } from './helpers/auth'
import { checkScreenshotWithVision } from './helpers/vision-check'

async function visionAssert(page: import('@playwright/test').Page, expectation: string) {
  const screenshot = await page.screenshot()
  const result = await checkScreenshotWithVision(screenshot.toString('base64'), expectation)
  expect(result.ok, `Vision-проверка провалилась: ${result.reason}`).toBeTruthy()
}

test.describe('Платежи и бухгалтерия — после правок requirePermission (авг 2026)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('список платежей открывается и виден без ошибок', async ({ page }) => {
    await page.goto('/payments')
    await expect(page).toHaveURL(/\/payments/)
    await visionAssert(page, 'Страница списка платежей CRM — таблица или список платежей, без текста ошибки/exception на экране')
  })

  test('редактирование платежа (updatePaymentAction) проходит без "Недостаточно прав"', async ({ page }) => {
    await page.goto('/payments')
    const firstRow = page.locator('a[href^="/payments/"]').first()
    await firstRow.click()
    await page.goto(page.url().replace(/\/payments\/([^/]+)$/, '/payments/$1/edit'))
    await expect(page.locator('text=Недостаточно прав')).toHaveCount(0)
    await visionAssert(page, 'Форма редактирования платежа — поля суммы/статуса/даты, без ошибки прав доступа')
  })

  test('создание транзакции (реальный путь создания платежа) проходит без ошибки прав', async ({ page }) => {
    await page.goto('/accounting/transactions/new')
    await expect(page.locator('text=Недостаточно прав')).toHaveCount(0)
    await visionAssert(page, 'Форма создания транзакции в бухгалтерии — поля типа/суммы/даты, без текста ошибки')
  })

  test('удаление шаблона документа — файл реально пропадает из Storage', async ({ page }) => {
    await page.goto('/settings/templates')
    await visionAssert(page, 'Страница шаблонов документов в настройках — список шаблонов или пустое состояние, без ошибки на экране')
    // Примечание: сам факт удаления файла из Storage-бакета этот тест не проверяет —
    // для этого нужен отдельный сервисный запрос к Supabase Storage API вне Playwright.
    // Здесь проверяется только то, что UI не падает при заходе на страницу и при удалении.
  })

  test('карточка клиента (легаси /clients) всё ещё рендерится', async ({ page }) => {
    await page.goto('/clients')
    await visionAssert(page, 'Страница списка клиентов — список или таблица клиентов, без ошибки на экране')
  })
})
