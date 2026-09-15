import { test, expect } from '@playwright/test'
import { login } from './helpers'

test.describe('вход и выход', () => {
  test('вход открывает дашборд, выход возвращает на /login', async ({ page }) => {
    await login(page)
    await expect(page).toHaveURL(/\/dashboard/)

    await page.getByTestId('logout-button').first().click()
    await page.waitForURL(/\/login/, { timeout: 30_000 })

    // Сессии нет: защищённая страница снова просит войти
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/)
  })
})
