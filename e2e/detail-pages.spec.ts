import { test, expect } from '@playwright/test'
import { login } from './helpers/auth'

/**
 * Детальные карточки на реальных записях.
 *
 * smoke-prod.spec.ts ходит только по статическим маршрутам — карточки договора и
 * сделки, где живут самые сложные запросы с встраиванием связей, в него не
 * попадают. Пробел вскрылся 02.09.2026 при удалении legacy-таблиц: три страницы
 * встраивали `clients` в select, и ни один тест этого не ловил.
 *
 * Здесь берётся первая запись из списка и проверяется, что страница рендерится:
 * сломанный PostgREST-embed даёт «could not find the relation» именно тут.
 */
const ERRORS = ['Application error', 'Internal Server Error', 'Что-то пошло не так', 'could not find the relation']

async function openAndCheck(page: import('@playwright/test').Page, url: string) {
  const res = await page.goto(url, { waitUntil: 'domcontentloaded' })
  expect(res?.status(), `${url} → HTTP`).toBeLessThan(500)
  const body = await page.locator('body').innerText()
  for (const marker of ERRORS) {
    expect(body, `${url} → на странице «${marker}»`).not.toContain(marker)
  }
}

test('карточки договора, генерации и сделки рендерятся на реальных данных', async ({ page }) => {
  test.setTimeout(120_000)
  await login(page)

  await page.goto('/contracts')
  const contractHref = await page.locator('a[href^="/contracts/"]').first().getAttribute('href')
  expect(contractHref, 'в списке нет ни одного договора').toBeTruthy()
  await openAndCheck(page, contractHref!)
  await openAndCheck(page, `${contractHref}/generate`)

  await page.goto('/deals')
  const dealHref = await page.locator('a[href^="/deals/"]').first().getAttribute('href')
  expect(dealHref, 'в списке нет ни одной сделки').toBeTruthy()
  await openAndCheck(page, dealHref!)
})
