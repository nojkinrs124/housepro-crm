import { defineConfig, devices } from '@playwright/test'
import { existsSync, readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

/**
 * Подхватывает .env.e2e (доступы тестового аккаунта, BASE_URL, ключ vision).
 * Файл под .gitignore и в репозиторий не уезжает.
 *
 * Уже заданные переменные окружения НЕ перезаписываются — так разовый прогон
 * против локального сервера делается через E2E_BASE_URL=... без правки файла.
 */
function loadE2eEnv(): void {
  // Проект собран как ESM ("type": "module"), __dirname здесь недоступен.
  const here = path.dirname(fileURLToPath(import.meta.url))
  const file = path.resolve(here, '.env.e2e')
  if (!existsSync(file)) return

  for (const line of readFileSync(file, 'utf-8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (trimmed === '' || trimmed.startsWith('#')) continue
    const separator = trimmed.indexOf('=')
    if (separator === -1) continue
    const key = trimmed.slice(0, separator).trim()
    const value = trimmed.slice(separator + 1).trim()
    if (key && process.env[key] === undefined) process.env[key] = value
  }
}

loadE2eEnv()

/**
 * E2E-тесты бьют по живому продакшену (или указанному BASE_URL) настоящим
 * тестовым аккаунтом. Никаких моков — это дополнение к vitest-юнит-тестам,
 * а не замена.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: 1,
  reporter: [['list'], ['html', { open: 'never' }], ['json', { outputFile: 'e2e-results.json' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'https://housepro24.vercel.app',
    screenshot: 'on',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
})
