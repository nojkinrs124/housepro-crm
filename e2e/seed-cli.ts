/**
 * Сид изолированной базы из командной строки — без Playwright.
 *
 *   node e2e/seed-cli.ts            # создать/обновить фикстуру (идемпотентно)
 *   node e2e/seed-cli.ts cleanup    # удалить записи с префиксом __smoke__
 *
 * Читает .env.e2e.branch (локальный стек), проверяет, что это не прод, и
 * вызывает тот же seed(), что и global-setup смоука. Node ≥ 23.6 исполняет
 * .ts напрямую (type stripping), поэтому tsx не нужен.
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertIsolatedSupabase, cleanupSmokeRecords, seed } from './seed.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const envFile = path.join(root, '.env.e2e.branch')
if (!existsSync(envFile)) {
  console.error('Нет .env.e2e.branch — сначала node scripts/e2e/write-branch-env.mjs')
  process.exit(1)
}
for (const line of readFileSync(envFile, 'utf-8').split(/\r?\n/)) {
  const t = line.trim()
  if (!t || t.startsWith('#')) continue
  const i = t.indexOf('=')
  if (i > 0 && process.env[t.slice(0, i).trim()] === undefined) {
    process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim()
  }
}

assertIsolatedSupabase(process.env.NEXT_PUBLIC_SUPABASE_URL)

if (process.argv[2] === 'cleanup') {
  await cleanupSmokeRecords()
  console.log('[seed] записи __smoke__ удалены')
} else {
  const r = await seed()
  console.log(`[seed] ok: org=${r.orgId} user=${r.email}`)
}
