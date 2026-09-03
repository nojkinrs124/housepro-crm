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
/**
 * Свежий несуществующий номер на каждый вызов.
 *
 * Запрос кода ограничен одним разом в минуту на номер, и повторные прогоны с
 * одними и теми же цифрами упирались в лимит — тест «пропускался», хотя
 * кабинет работал.
 */
function throwawayPhone(): string {
  const tail = String(Date.now()).slice(-7)
  return `+7900${tail}`
}

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
  test.skip(!(await codeFlowAvailable(page, throwawayPhone())), 'кабинет не настроен в этом окружении')
  // Именно форма с полем кода: на странице есть ещё форма выхода в шапке,
  // и locator('form') ловит обе.
  const unknownText = await page.locator('form:has(input[name="code"])').innerText()

  // Тот же путь для заведомо другого несуществующего номера — текст обязан
  // совпасть, иначе форма входа превращается в способ проверять номера.
  await page.goto('/cabinet/login', { waitUntil: 'domcontentloaded' })
  await codeFlowAvailable(page, throwawayPhone())
  const secondText = await page.locator('form:has(input[name="code"])').innerText()

  // Сравниваем текст без цифр: в нём есть замаскированный номер, и он у двух
  // запросов разный по определению. Проверяется формулировка, а не номер.
  const withoutDigits = (text: string) => text.replace(/\d/g, '')
  expect(withoutDigits(secondText)).toBe(withoutDigits(unknownText))
})

test('неверный код не пускает и не объясняет почему именно', async ({ page }) => {
  await page.goto('/cabinet/login', { waitUntil: 'domcontentloaded' })
  test.skip(!(await codeFlowAvailable(page, throwawayPhone())), 'кабинет не настроен в этом окружении')
  await page.locator('input[name="code"]').fill('000000')
  await page.getByRole('button', { name: /^Войти$/ }).click()

  // Проверяем существо: в кабинет не пустило. Именно это и есть требование —
  // текст ошибки показывает всплывающее уведомление, и цепляться за него в
  // сквозном тесте ненадёжно: оно живёт секунды и в длинном прогоне ловится
  // через раз. Формулировку отказа держит юнит-тест на действии входа.
  await page.waitForTimeout(2000)
  await expect(page).toHaveURL(/\/cabinet\/login/)
  // Остались на шаге ввода кода: внутрь кабинета не пустило.
  await expect(page.locator('input[name="code"]')).toBeVisible()
})
