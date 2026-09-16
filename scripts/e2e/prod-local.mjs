#!/usr/bin/env node
/**
 * Production-сборка и запуск CRM против ЛОКАЛЬНОГО Supabase.
 *
 * Читает .env.e2e.branch (не .env.local!), собирает в свой distDir .next-smoke
 * и поднимает `next start` на порту из E2E_BASE_URL (по умолчанию 3100).
 * Нужен для ручного прохода по production-сборке: dev-режим скрывает часть
 * ошибок сборки и гидрации.
 *
 *   node scripts/e2e/prod-local.mjs build   — только собрать
 *   node scripts/e2e/prod-local.mjs start   — только запустить (после build)
 *   node scripts/e2e/prod-local.mjs         — собрать и запустить
 *
 * Секреты в командную строку не попадают — переменные читаются из файла.
 */
import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const envFile = path.join(root, '.env.e2e.branch')
if (!existsSync(envFile)) {
  console.error('Нет .env.e2e.branch — сначала node scripts/e2e/write-branch-env.mjs')
  process.exit(1)
}

const env = { ...process.env, NEXT_DIST_DIR: '.next-smoke' }
for (const line of readFileSync(envFile, 'utf-8').split(/\r?\n/)) {
  const t = line.trim()
  if (!t || t.startsWith('#')) continue
  const i = t.indexOf('=')
  if (i > 0) env[t.slice(0, i).trim()] = t.slice(i + 1).trim()
}

const url = env.NEXT_PUBLIC_SUPABASE_URL ?? ''
if (url.includes('zwclvcswvhjeqwxrkbte') || (/supabase\.co/.test(url) && !env.E2E_SUPABASE_BRANCH_REF)) {
  console.error(`ОСТАНОВ: NEXT_PUBLIC_SUPABASE_URL=${url} — это не изолированное окружение`)
  process.exit(1)
}

const port = new URL(env.E2E_BASE_URL || 'http://localhost:3100').port || '3100'
const mode = process.argv[2] ?? 'all'

function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['next', ...args], { cwd: root, env, stdio: 'inherit' })
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`next ${args[0]} завершился с кодом ${code}`))))
  })
}

try {
  if (mode === 'build' || mode === 'all') await run(['build'])
  if (mode === 'start' || mode === 'all') {
    console.log(`\n→ production-сервер: http://localhost:${port} (Supabase: ${url})\n`)
    await run(['start', '-p', port])
  }
} catch (e) {
  console.error(e.message)
  process.exit(1)
}
