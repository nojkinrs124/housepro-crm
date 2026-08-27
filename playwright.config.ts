import { defineConfig, devices } from '@playwright/test'

/**
 * E2E-тесты бьют по живому продакшену (или указанному BASE_URL) настоящим
 * тестовым аккаунтом. Никаких моков — это дополнение к vitest-юнит-тестам,
 * а не замена.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: 1,
  reporter: [['list'], ['json', { outputFile: 'e2e-results.json' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'https://housepro-crm.vercel.app',
    screenshot: 'on',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
})
