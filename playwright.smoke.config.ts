import { defineConfig, devices } from '@playwright/test'
import { existsSync, readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

/**
 * Смоук-тесты /simplify-ux — ТОЛЬКО против изолированного Supabase.
 *
 * Читает .env.e2e.branch (локальный стек в Docker или облачная dev-ветка),
 * а не .env.e2e с боевыми доступами. Сам поднимает Next.js на :3100 с этими
 * переменными — они перекрывают .env.local, потому что Next не трогает уже
 * заданные переменные процесса. Предохранитель от прода — в global-setup.
 *
 * Запуск: npm run test:smoke
 */
const here = path.dirname(fileURLToPath(import.meta.url))
const envFile = path.resolve(here, '.env.e2e.branch')

if (!existsSync(envFile)) {
  throw new Error(
    'Нет .env.e2e.branch — смоук не запускается без изолированного окружения. ' +
      'Подними стек (npx supabase start) и выполни node scripts/e2e/write-branch-env.mjs'
  )
}

const branchEnv: Record<string, string> = {}
for (const line of readFileSync(envFile, 'utf-8').split(/\r?\n/)) {
  const trimmed = line.trim()
  if (trimmed === '' || trimmed.startsWith('#')) continue
  const i = trimmed.indexOf('=')
  if (i === -1) continue
  branchEnv[trimmed.slice(0, i).trim()] = trimmed.slice(i + 1).trim()
}
// Переменные ветки главнее всего, что уже есть в окружении: никакой
// E2E_BASE_URL из шелла не переведёт прогон на прод.
Object.assign(process.env, branchEnv)

const baseURL = branchEnv.E2E_BASE_URL || 'http://localhost:3100'
const port = Number(new URL(baseURL).port || 3100)

export default defineConfig({
  testDir: './e2e/smoke',
  globalSetup: './e2e/smoke/global-setup.ts',
  timeout: 90_000,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-smoke' }]],
  outputDir: 'test-results-smoke',
  use: {
    baseURL,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npx next dev -p ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { ...process.env, ...branchEnv, NEXT_DIST_DIR: '.next-smoke' } as Record<string, string>,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
