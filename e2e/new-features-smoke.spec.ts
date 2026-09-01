import { test, expect, type Page } from '@playwright/test'
import { login } from './helpers/auth'

/**
 * Стресс-прогон по экранам, добавленным в этой волне работ.
 *
 * Проверяем не «пиксели», а то, что страница вообще собирается и рендерится
 * без ошибки: серверные компоненты Next падают в рантайме, и такие поломки
 * не ловятся ни tsc, ни сборкой (страницы с force-dynamic во время build
 * не выполняются — ровно та ловушка, из-за которой в проекте появился
 * scripts/pre-push-check.mjs).
 *
 * Запуск против локального сервера:
 *   E2E_BASE_URL=http://localhost:3000 npx playwright test new-features-smoke
 */

/** Текст, по которому видно, что вместо страницы отрисовался экран ошибки. */
const ERROR_MARKERS = [
  'Application error',
  'Unhandled Runtime Error',
  'Internal Server Error',
  'This page could not be found',
  'Что-то пошло не так',
]

async function expectNoErrorScreen(page: Page, label: string) {
  const body = (await page.locator('body').innerText()).slice(0, 4000)
  for (const marker of ERROR_MARKERS) {
    expect(body, `${label}: на странице виден экран ошибки («${marker}»)`).not.toContain(marker)
  }
}

test.describe('Публичные страницы', () => {
  test('политика обработки ПДн открывается без авторизации', async ({ page }) => {
    const response = await page.goto('/policy')
    expect(response?.status()).toBeLessThan(400)
    await expect(page.getByRole('heading', { name: /Политика обработки персональных данных/ })).toBeVisible()
    await expect(page.getByText('152-ФЗ')).toBeVisible()
    await expectNoErrorScreen(page, '/policy')
  })

  test('форма заявки требует согласия на обработку данных', async ({ page }) => {
    await page.goto('/kontakty')
    const consent = page.locator('input[name="consent"]')
    await expect(consent).toHaveCount(1)
    // Именно required: без явного согласия заявку принимать нельзя.
    await expect(consent).toHaveAttribute('required', '')
    await expect(page.getByRole('link', { name: /политикой обработки персональных данных/ })).toBeVisible()
  })

  test('фиды площадок отдают валидный XML', async ({ request }) => {
    for (const path of ['/api/export/yandex-realty', '/api/export/domclick']) {
      const response = await request.get(path)
      expect(response.status(), `${path} должен отвечать 200`).toBe(200)
      const xml = await response.text()
      expect(xml, `${path}: не XML`).toContain('<?xml version="1.0" encoding="UTF-8"?>')
      expect(xml, `${path}: нет корневого элемента фида`).toContain('<realty-feed')
    }
  })

  test('страница подписания по несуществующему токену не падает 500', async ({ page }) => {
    const response = await page.goto(`/sign/${'0'.repeat(64)}`)
    // Ожидаем 404, а не 500: неизвестный токен — это «не найдено», а не сбой.
    expect(response?.status()).toBe(404)
  })
})

test.describe('Новые разделы CRM', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  const pages: { path: string; label: string; expect: RegExp }[] = [
    { path: '/settings/email', label: 'Почта', expect: /Почта/ },
    { path: '/settings/import', label: 'Импорт данных', expect: /Импорт данных/ },
    { path: '/settings/channels', label: 'Каналы связи', expect: /Каналы связи/ },
    { path: '/settings/payments', label: 'Приём платежей', expect: /Приём платежей/ },
    { path: '/contacts/duplicates', label: 'Дубли контактов', expect: /Дубли контактов/ },
    { path: '/showings/calendar', label: 'Календарь показов', expect: /Календарь показов/ },
    { path: '/accounting/bank-import', label: 'Сверка с банком', expect: /Сверка с банком/ },
  ]

  for (const item of pages) {
    test(`${item.label} открывается`, async ({ page }) => {
      const response = await page.goto(item.path)
      expect(response?.status(), `${item.path} вернул ошибку`).toBeLessThan(400)
      await expect(page.getByRole('heading', { name: item.expect }).first()).toBeVisible()
      await expectNoErrorScreen(page, item.path)
    })
  }

  test('в профиле есть подписка на календарь', async ({ page }) => {
    await page.goto('/settings/profile')
    await expect(page.getByText('Подписка на календарь')).toBeVisible()
    await expect(page.getByRole('button', { name: /Создать ссылку на календарь|Скопировать/ })).toBeVisible()
  })

  test('в безопасности есть двухфакторная аутентификация', async ({ page }) => {
    await page.goto('/settings/security')
    await expect(page.getByRole('heading', { name: 'Двухфакторная аутентификация' })).toBeVisible()
    // Старая заглушка «функция будет доступна в следующем обновлении» должна была уйти.
    await expect(page.getByText(/будет доступна в следующем обновлении/)).toHaveCount(0)
  })

  test('мастер импорта разбирает CSV и предлагает сопоставление колонок', async ({ page }) => {
    await page.goto('/settings/import')

    const csv = 'ФИО;Телефон;Email\nТестов Тест Тестович;+7 999 000-11-22;test@example.com\n'
    await page.locator('input[type="file"]').setInputFiles({
      name: 'contacts.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csv, 'utf-8'),
    })
    await page.getByRole('button', { name: /Загрузить и разобрать/ }).click()

    await expect(page.getByText('Сопоставление колонок')).toBeVisible({ timeout: 15_000 })
    // Колонки должны подхватиться автоматически — в этом весь смысл шага.
    await expect(page.locator('#map-full_name')).toHaveValue('0')
    await expect(page.locator('#map-phone')).toHaveValue('1')
    await expect(page.getByText('Предпросмотр первых строк')).toBeVisible()
  })

  test('сверка с банком отвергает файл не в формате 1С', async ({ page }) => {
    await page.goto('/accounting/bank-import')
    await page.locator('input[type="file"]').setInputFiles({
      name: 'not-a-statement.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('просто текст', 'utf-8'),
    })
    await page.getByRole('button', { name: /Загрузить выписку/ }).click()
    await expect(page.getByText(/Это не выписка в формате 1C/)).toBeVisible({ timeout: 15_000 })
  })

  test('лента общения есть на карточке контакта', async ({ page }) => {
    await page.goto('/contacts')
    // Только ссылки на карточки: href вида /contacts/<uuid>. Обычный
    // префиксный селектор ловил ещё и кнопки «Добавить контакт» и «Дубли».
    const href = await page
      .locator('a[href^="/contacts/"]')
      .evaluateAll((links) =>
        (links as HTMLAnchorElement[])
          .map((a) => a.getAttribute('href') ?? '')
          .find((h) => /^\/contacts\/[0-9a-f-]{36}$/.test(h)) ?? null
      )
    expect(href, 'в базе нет ни одного контакта для проверки').not.toBeNull()
    await page.goto(href as string)

    await expect(page.getByRole('heading', { name: 'История общения' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Записать общение/ })).toBeVisible()
    await expectNoErrorScreen(page, 'карточка контакта')
  })

  test('карточка объекта содержит счётчики', async ({ page }) => {
    await page.goto('/properties')
    const href = await page
      .locator('a[href^="/properties/"]')
      .evaluateAll((links) =>
        (links as HTMLAnchorElement[])
          .map((a) => a.getAttribute('href') ?? '')
          .find((h) => /^\/properties\/[0-9a-f-]{36}$/.test(h)) ?? null
      )
    expect(href, 'в базе нет ни одного объекта для проверки').not.toBeNull()
    await page.goto(href as string)

    await expect(page.getByRole('heading', { name: 'Счётчики' })).toBeVisible()
    await expectNoErrorScreen(page, 'карточка объекта')
  })

  test('карточка договора содержит график платежей', async ({ page }) => {
    await page.goto('/contracts')
    const href = await page
      .locator('a[href^="/contracts/"]')
      .evaluateAll((links) =>
        (links as HTMLAnchorElement[])
          .map((a) => a.getAttribute('href') ?? '')
          .find((h) => /^\/contracts\/[0-9a-f-]{36}$/.test(h)) ?? null
      )
    expect(href, 'в базе нет ни одного договора для проверки').not.toBeNull()
    await page.goto(href as string)

    await expect(page.getByRole('button', { name: /график платежей/i })).toBeVisible()
    await expectNoErrorScreen(page, 'карточка договора')
  })

  test('предпросмотр графика платежей считается на клиенте', async ({ page }) => {
    await page.goto('/contracts')
    const href = await page
      .locator('a[href^="/contracts/"]')
      .evaluateAll((links) =>
        (links as HTMLAnchorElement[])
          .map((a) => a.getAttribute('href') ?? '')
          .find((h) => /^\/contracts\/[0-9a-f-]{36}$/.test(h)) ?? null
      )
    expect(href, 'в базе нет ни одного договора для проверки').not.toBeNull()
    await page.goto(href as string)

    await page.getByRole('button', { name: /график платежей/i }).click()
    await page.locator('#sch-amount').fill('50000')
    await page.locator('#sch-start').fill('2026-09-01')
    await page.locator('#sch-end').fill('2027-08-31')

    // Депозит подставляется из залога по договору и добавляет 13-ю строку —
    // снимаем галочку, чтобы проверять именно арифметику аренды.
    const depositToggle = page.locator('input[name="include_deposit"]')
    if (await depositToggle.isChecked()) await depositToggle.uncheck()

    // 12 месячных платежей на 600 000 ₽ — та же арифметика, что в юнит-тестах.
    // \s в разряде обязателен: toLocaleString('ru-RU') ставит неразрывный пробел.
    await expect(page.getByText(/Предпросмотр — 12 начислений на 600\s000\s₽/)).toBeVisible()
    await expect(page.getByRole('button', { name: /Создать 12 начислений/ })).toBeVisible()

    // И с депозитом строк становится ровно на одну больше.
    await depositToggle.check()
    await expect(page.getByText(/Предпросмотр — 13 начислений/)).toBeVisible()
  })
})
