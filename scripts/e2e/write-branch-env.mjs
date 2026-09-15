#!/usr/bin/env node
/**
 * Собирает .env.e2e.branch — окружение для смоук-тестов против ЛОКАЛЬНОГО
 * Supabase (Docker). Ключи берутся из `supabase status`, в командную строку
 * не попадают. Боевые .env.local и .env.e2e не читает и не трогает.
 *
 * Запуск: node scripts/e2e/write-branch-env.mjs
 * Требует поднятого стека: npx supabase start
 */
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const target = path.join(root, '.env.e2e.branch')

let status
try {
  status = execFileSync('npx', ['supabase', 'status', '-o', 'env'], { cwd: root, encoding: 'utf-8' })
} catch {
  console.error('supabase status не ответил — стек не поднят? npx supabase start')
  process.exit(1)
}

const vars = Object.fromEntries(
  status
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]
    })
)

for (const k of ['API_URL', 'ANON_KEY', 'SERVICE_ROLE_KEY']) {
  if (!vars[k]) {
    console.error(`в выводе supabase status нет ${k}`)
    process.exit(1)
  }
}

if (/supabase\.co/.test(vars.API_URL)) {
  console.error(`API_URL указывает на облако (${vars.API_URL}) — это не локальный стек, файл не пишу`)
  process.exit(1)
}

const lines = [
  '# Изолированное окружение для смоук-тестов /simplify-ux — ЛОКАЛЬНЫЙ Supabase (Docker).',
  '# Сгенерирован scripts/e2e/write-branch-env.mjs, под .env* в .gitignore.',
  '# Боевые .env.local и .env.e2e не трогаем. Ключи локального стека одинаковы у всех',
  '# инсталляций Supabase CLI и секретами не являются.',
  `NEXT_PUBLIC_SUPABASE_URL=${vars.API_URL}`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY=${vars.ANON_KEY}`,
  `SUPABASE_SERVICE_ROLE_KEY=${vars.SERVICE_ROLE_KEY}`,
  'NEXT_PUBLIC_SITE_URL=http://localhost:3100',
  'E2E_BASE_URL=http://localhost:3100',
  '# Пользователь, которого заводит e2e/seed.ts — существует только в локальной базе',
  'E2E_TEST_EMAIL=smoke@housepro.local',
  'E2E_TEST_PASSWORD=smoke-Pass-2026',
  '# Файлы — в Supabase Storage локального стека, не в Яндекс',
  'STORAGE_DRIVER=supabase',
  '',
]

writeFileSync(target, lines.join('\n'))
console.log(`записан ${path.relative(root, target)} → ${vars.API_URL}`)
