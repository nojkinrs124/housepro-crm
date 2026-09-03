import { test, expect } from '@playwright/test'
import { login } from './helpers/auth'

/**
 * Срок годности инструкции: проверка на живых данных, БЕЗ записи в базу.
 *
 * Кнопку «Подтвердить актуальность» здесь намеренно не жмём: набор гоняется по
 * проду, и клик изменил бы дату проверки боевой статьи. Расчёт свежести
 * покрыт юнит-тестами (src/tests/unit/knowledge-freshness.test.ts); здесь —
 * то, что видно снаружи: страница действительно показывает срок и не падает.
 */

test.describe('База знаний — срок годности', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('в списке есть фильтр актуальности', async ({ page }) => {
    await page.goto('/knowledge', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('main')).toContainText('Актуальность')
  })

  test('статья показывает дату проверки и кнопку подтверждения', async ({ page }) => {
    await page.goto('/knowledge', { waitUntil: 'domcontentloaded' })

    const firstArticle = page.locator('main a[href^="/knowledge/"]:not([href="/knowledge/new"])').first()
    await expect(firstArticle).toBeVisible()
    await firstArticle.click()

    const main = page.locator('main')
    // Подзаголовок статьи: «Рубрика · Актуальна · проверена 04.09.2026»
    await expect(main).toContainText(/Актуальна|Проверить через|Просрочена|Не проверялась/)
    await expect(page.getByRole('button', { name: /актуальн/i })).toBeVisible()
  })
})
