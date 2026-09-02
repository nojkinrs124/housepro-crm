import { test, expect } from '@playwright/test'
import { login } from './helpers/auth'

/**
 * Сквозной smoke по всем публичным и кабинетным маршрутам прода.
 * Не проверяет бизнес-логику — ловит падения рендера: 5xx, экран ошибки
 * Next.js, «Недостаточно прав» там, где их быть не должно, и ошибки в консоли.
 */

const PUBLIC_ROUTES = ['/', '/catalog', '/uslugi', '/o-kompanii', '/kontakty', '/login']

const DASHBOARD_ROUTES = [
  '/dashboard',
  '/leads', '/leads/new',
  '/contacts', '/contacts/new',
  '/deals', '/deals/new',
  '/properties', '/properties/new',
  '/contracts', '/contracts/new',
  '/accounting', '/accounting/categories', '/accounting/recurring',
  '/accounting/recurring/new', '/accounting/transactions/new',
  '/analytics',
  '/collections', '/collections/new',
  '/employees', '/employees/new',
  '/calendar',
  '/management',
  '/knowledge',
  '/payments/new',
  '/search',
  '/showings', '/showings/new',
  '/tasks', '/tasks/new',
  '/settings', '/settings/api', '/settings/audit', '/settings/avito',
  '/settings/billing', '/settings/company', '/settings/company/new',
  '/settings/general', '/settings/notifications', '/settings/profile',
  '/settings/security', '/settings/templates', '/settings/webhooks',
  '/settings/export',
]

const ERROR_MARKERS = [
  'Application error',
  'Internal Server Error',
  'This page could not be found',
  'Что-то пошло не так',
  'Недостаточно прав',
]

async function visitAll(page: import('@playwright/test').Page, routes: string[]) {
  const failures: string[] = []

  for (const route of routes) {
    const consoleErrors: string[] = []
    const onConsole = (msg: import('@playwright/test').ConsoleMessage) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    }
    page.on('console', onConsole)

    try {
      // Маршруты-редиректы (например /payments/new → /accounting/transactions/new)
      // оставляют навигацию доигрывать, и следующий goto прилетает ей в бок:
      // Chromium отвечает net::ERR_ABORTED. Это гонка обхода, а не поломка страницы,
      // поэтому одна повторная попытка — именно на ERR_ABORTED, остальные ошибки
      // пробрасываем как есть.
      let response
      try {
        response = await page.goto(route, { waitUntil: 'domcontentloaded' })
      } catch (e) {
        if (!/ERR_ABORTED/.test((e as Error).message)) throw e
        response = await page.goto(route, { waitUntil: 'domcontentloaded' })
      }
      const status = response?.status() ?? 0
      if (status >= 500) failures.push(`${route} → HTTP ${status}`)

      const body = await page.locator('body').innerText()
      for (const marker of ERROR_MARKERS) {
        if (body.includes(marker)) failures.push(`${route} → на странице «${marker}»`)
      }
      // Ошибки загрузки чанков/шрифтов ломают страницу, остальной шум консоли — нет
      const fatal = consoleErrors.filter((e) => /ChunkLoadError|Failed to load|Hydration/i.test(e))
      if (fatal.length) failures.push(`${route} → console: ${fatal[0]}`)
    } catch (e) {
      failures.push(`${route} → ${(e as Error).message.split('\n')[0]}`)
    } finally {
      page.off('console', onConsole)
    }
  }

  return failures
}

test('публичные страницы сайта открываются без ошибок', async ({ page }) => {
  test.setTimeout(300_000)
  const failures = await visitAll(page, PUBLIC_ROUTES)
  expect(failures, `Проблемные публичные маршруты:\n${failures.join('\n')}`).toEqual([])
})

test('все страницы кабинета открываются без ошибок', async ({ page }) => {
  test.setTimeout(900_000)
  await login(page)
  const failures = await visitAll(page, DASHBOARD_ROUTES)
  expect(failures, `Проблемные маршруты кабинета:\n${failures.join('\n')}`).toEqual([])
})

test('кабинет закрыт для неавторизованных — редирект на /login', async ({ page }) => {
  test.setTimeout(120_000)
  for (const route of ['/dashboard', '/contacts', '/accounting', '/settings']) {
    await page.goto(route, { waitUntil: 'domcontentloaded' })
    await expect(page, `${route} доступен без авторизации`).toHaveURL(/\/login/)
  }
})
