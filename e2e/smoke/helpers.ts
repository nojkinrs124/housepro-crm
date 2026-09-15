/**
 * Общее для смоук-спеков: вход по data-testid, service-клиент для проверки
 * записей в базе, уникальные имена с префиксом __smoke__.
 *
 * Тесты проверяют факт операции в БД, а не вёрстку, поэтому цепляются только за
 * data-testid и не читают текст кнопок.
 */
import { expect, type Page } from '@playwright/test'
import { SMOKE_ORG_SLUG, SMOKE_PREFIX, serviceClient, type ServiceClient } from '../seed'

export { SMOKE_PREFIX }

export function smokeName(flow: string): string {
  return `${SMOKE_PREFIX} ${flow} ${Date.now()}`
}

export async function login(page: Page): Promise<void> {
  const email = process.env.E2E_TEST_EMAIL
  const password = process.env.E2E_TEST_PASSWORD
  if (!email || !password) throw new Error('E2E_TEST_EMAIL / E2E_TEST_PASSWORD не заданы')

  await page.goto('/login')
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 })
}

let cachedAdmin: ServiceClient | null = null
export function admin(): ServiceClient {
  cachedAdmin ??= serviceClient()
  return cachedAdmin
}

export async function smokeOrgId(): Promise<string> {
  const { data, error } = await admin().from('organizations').select('id').eq('slug', SMOKE_ORG_SLUG).single()
  if (error || !data) throw new Error(`организация смоука не найдена: ${error?.message}`)
  return data.id as string
}

export async function smokeUserId(): Promise<string> {
  const email = process.env.E2E_TEST_EMAIL!
  const { data, error } = await admin().from('users').select('id').eq('email', email).single()
  if (error || !data) throw new Error(`пользователь смоука не найден: ${error?.message}`)
  return data.id as string
}

/**
 * Ждёт, пока запрос к базе вернёт строку: server action делает redirect,
 * и запись появляется на доли секунды позже, чем страница.
 */
export async function waitForRow<R extends { data: unknown; error: { message: string } | null }>(
  query: () => PromiseLike<R>,
  timeoutMs = 15_000
): Promise<NonNullable<R['data']>> {
  const started = Date.now()
  let last: R | undefined
  while (Date.now() - started < timeoutMs) {
    last = await query()
    if (last.data) return last.data as NonNullable<R['data']>
    await new Promise((r) => setTimeout(r, 300))
  }
  throw new Error(`запись не появилась за ${timeoutMs} мс${last?.error ? `: ${last.error.message}` : ''}`)
}

export async function expectNoFormError(page: Page): Promise<void> {
  // Баннер ошибки ServerActionForm/ContactForm: красный блок с текстом.
  const banner = page.locator('[class*="hp-danger"]').filter({ hasText: /\S/ }).first()
  await expect(banner).toHaveCount(0, { timeout: 1_000 }).catch(async () => {
    throw new Error(`форма вернула ошибку: ${await banner.innerText()}`)
  })
}
