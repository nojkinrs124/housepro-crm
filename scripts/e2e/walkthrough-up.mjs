#!/usr/bin/env node
/**
 * Подъём окружения для сквозного прохода (/walkthrough) одной командой:
 *
 *   1. локальный Supabase в Docker (npx supabase start — идемпотентно);
 *   2. .env.e2e.branch из `supabase status`;
 *   3. сид фикстуры (организация, админ smoke@housepro.local, профиль компании);
 *   4. production-сборка CRM в .next-walk и `next start` на порту WALK_PORT.
 *
 *   npm run walkthrough:up            # всё
 *   npm run walkthrough:up -- start   # только запустить уже собранное
 *   npm run walkthrough:down          # остановить Supabase (сервер — Ctrl+C)
 *
 * Порт по умолчанию 3100. Сервер остаётся в foreground — запускать в фоне
 * или в отдельной вкладке терминала. Секреты в командную строку не попадают.
 */
import { spawnSync, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const port = process.env.WALK_PORT || '3100'
const distDir = process.env.NEXT_DIST_DIR || '.next-walk'
const mode = process.argv[2] ?? 'all'

function step(title) { console.log(`\n━━ ${title}`) }
function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', ...opts })
  if (r.status !== 0) {
    console.error(`✖ ${cmd} ${args.join(' ')} завершился с кодом ${r.status}`)
    process.exit(r.status ?? 1)
  }
}

if (mode === 'down') {
  run('npx', ['supabase', 'stop'])
  process.exit(0)
}

if (mode === 'all') {
  step('Docker')
  if (spawnSync('docker', ['info'], { stdio: 'ignore' }).status !== 0) {
    console.error('Docker не запущен — откройте Docker Desktop и повторите.')
    process.exit(1)
  }

  step('Локальный Supabase')
  run('npx', ['supabase', 'start'])

  step('.env.e2e.branch')
  run('node', ['scripts/e2e/write-branch-env.mjs'])

  step('Сид фикстуры')
  run('node', ['e2e/seed-cli.ts'])

  step(`Production-сборка → ${distDir}`)
  run('node', ['scripts/e2e/prod-local.mjs', 'build'], {
    env: { ...process.env, NEXT_DIST_DIR: distDir },
  })
}

if (!existsSync(path.join(root, distDir))) {
  console.error(`Нет ${distDir} — сначала npm run walkthrough:up (без аргументов)`)
  process.exit(1)
}

step(`Сервер http://localhost:${port}`)
console.log('Вход: E2E_TEST_EMAIL / E2E_TEST_PASSWORD из .env.e2e.branch\n')
const child = spawn('node', ['scripts/e2e/prod-local.mjs', 'start'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, NEXT_DIST_DIR: distDir, PORT: port },
})
child.on('exit', code => process.exit(code ?? 0))
