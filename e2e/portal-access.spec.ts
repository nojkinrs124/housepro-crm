import { test, expect } from '@playwright/test'

/**
 * Личный кабинет: контур доступа.
 *
 * Кабинет читает данные сервисным клиентом в обход RLS — право видеть их даёт
 * строка portal_access, а не политика в базе. Поэтому изоляцию проверяем
 * снаружи, а не только юнит-тестами: цена ошибки здесь — чужие платежи в чужом
 * кабинете.
 */

const RANDOM_UUID = '11111111-2222-3333-4444-555555555555'

/**
 * Шаги с кодом требуют настроенного кабинета: сервисного ключа Supabase и
 * секрета подписи. Локально их обычно нет (в .env.local лежат только публичные
 * ключи), и тогда вход честно отвечает «кабинет не настроен» — проверять на
 * этом изоляцию бессмысленно, поэтому такие тесты пропускаются.
 */
async function codeFlowAvailable(page: import('@playwright/test').Page, phone: string) {
  await page.locator('input[name="phone"]').fill(phone)
  await page.getByRole('button', { name: /Получить код/ }).click()
  const codeField = page.locator('input[name="code"]')
  try {
    await codeField.waitFor({ state: 'visible', timeout: 5000 })
    return true
  } catch {
    return false
  }
}

test('без сессии кабинет отправляет на вход', async ({ page }) => {
  await page.goto('/cabinet', { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/\/cabinet\/login/)
})

test('форма входа спрашивает телефон, а не пароль', async ({ page }) => {
  await page.goto('/cabinet/login', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('input[name="phone"]')).toBeVisible()
  await expect(page.locator('input[type="password"]')).toHaveCount(0)
})

test('чужой объект отдаёт 404, а не 403', async ({ page }) => {
  // 403 сообщал бы, что объект существует: перебором идентификаторов можно
  // было бы составить список объектов агентства.
  const owner = await page.goto(`/cabinet/owner/${RANDOM_UUID}`, { waitUntil: 'domcontentloaded' })
  expect(owner?.status()).toBe(404)

  const tenant = await page.goto(`/cabinet/tenant/${RANDOM_UUID}`, { waitUntil: 'domcontentloaded' })
  expect(tenant?.status()).toBe(404)
})

test('ответ на запрос кода не выдаёт, знаком ли номер', async ({ page }) => {
  await page.goto('/cabinet/login', { waitUntil: 'domcontentloaded' })
  test.skip(!(await codeFlowAvailable(page, '+7 900 000-00-01')), 'кабинет не настроен в этом окружении')
  const unknownText = await page.locator('form').innerText()

  // Тот же путь для заведомо другого несуществующего номера — текст обязан
  // совпасть, иначе форма входа превращается в способ проверять номера.
  await page.goto('/cabinet/login', { waitUntil: 'domcontentloaded' })
  await codeFlowAvailable(page, '+7 900 000-00-02')
  const secondText = await page.locator('form').innerText()

  expect(secondText.replace(/\+7[^\s]*/g, '')).toBe(unknownText.replace(/\+7[^\s]*/g, ''))
})

test('неверный код не пускает и не объясняет почему именно', async ({ page }) => {
  await page.goto('/cabinet/login', { waitUntil: 'domcontentloaded' })
  test.skip(!(await codeFlowAvailable(page, '+7 900 000-00-03')), 'кабинет не настроен в этом окружении')
  await page.locator('input[name="code"]').fill('000000')
  await page.getByRole('button', { name: /^Войти$/ }).click()

  await expect(page.getByText(/Неверный или истёкший код/)).toBeVisible()
  await expect(page).toHaveURL(/\/cabinet\/login/)
})
