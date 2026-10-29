#!/usr/bin/env node
/**
 * Hermes pre_tool_call (terminal) — три запрета:
 *
 *   1. `git push` без зелёного `npm run check` на текущем коде (отпечаток в
 *      scripts/checks/.check-stamp.json).
 *   2. Пуш с правками кода без поднятой версии в package.json.
 *   3. Секреты в командной строке: PAT в URL, service role key, боевые ключи,
 *      пароли E2E; `npm install` без `--legacy-peer-deps` и запрещённые пакеты.
 *
 * Хук глобальный (config.yaml профиля). Вне репозитория CRM — no-op.
 */

import { findRepoRoot, git, block, noop, readPayload } from './lib-hook.mjs'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const SECRET_PATTERNS = [
  { re: /https:\/\/[^\s/@]+@github\.com/i, what: 'PAT в URL репозитория' },
  { re: /\bgh[pousr]_[A-Za-z0-9]{20,}/, what: 'GitHub token' },
  { re: /\bsk_live_[A-Za-z0-9]{10,}/, what: 'боевой ключ Stripe' },
  { re: /\bre_[A-Za-z0-9]{20,}/, what: 'ключ Resend' },
  { re: /\beyJ[A-Za-z0-9_-]{30,}\.[A-Za-z0-9_-]{20,}/, what: 'JWT (похоже на Supabase service role key)' },
  {
    re: /\b(SUPABASE_SERVICE_ROLE_KEY|E2E_TEST_PASSWORD|TELEGRAM_BOT_TOKEN|CRON_SECRET|OPENROUTER_API_KEY)\s*=\s*['"]?\S/,
    what: 'секрет присваивается прямо в команде',
  },
]

const BANNED_PACKAGES = [
  { re: '@hello-pangea/dnd', why: 'Kanban на нативном HTML5 drag-and-drop — библиотека перетаскивания не нужна.' },
  { re: 'react-beautiful-dnd', why: 'Заброшен и несовместим с React 19. Kanban на нативном HTML5 drag-and-drop.' },
  { re: 'axios', why: 'Везде используется нативный fetch — второй HTTP-клиент только разводит стили запросов.' },
  { re: '(@tanstack/)?react-query', why: 'Данные тянутся Server Components и Server Actions, клиентский кэш-слой не нужен.' },
]

/** Версия должна расти вместе с кодом — сравнение с origin/main. */
function versionBumpMissing(repo) {
  try {
    const changed = git(repo, ['diff', '--name-only', 'origin/main...HEAD']).split('\n').filter(Boolean)
    if (!changed.some(f => f.startsWith('src/') || f.startsWith('supabase/migrations/'))) return null
    const remote = JSON.parse(git(repo, ['show', 'origin/main:package.json']))
    const local = JSON.parse(readFileSync(path.join(repo, 'package.json'), 'utf8'))
    return remote.version === local.version ? local.version : null
  } catch {
    return null // нет origin/main, первый пуш, отвязанная ветка — не мешаем
  }
}

const payload = readPayload()
if (!payload) noop()

const command = payload?.tool_input?.command ?? ''
if (!command) noop()

const repo = findRepoRoot(payload)
if (!repo) noop() // команда не про CRM — хук молчит

// ── 1. Секреты ───────────────────────────────────────────────────────────
for (const { re, what } of SECRET_PATTERNS) {
  if (re.test(command)) {
    block(
      `ЗАБЛОКИРОВАНО: в команде ${what}.\n\n` +
        `Секреты не должны попадать в командную строку — они остаются в истории шелла, в логах ` +
        `и (для PAT в remote URL) в \`git remote -v\`.\n\n` +
        `Как надо:\n` +
        `  • push — по уже настроенному origin, без токена в URL;\n` +
        `  • переменные окружения — из .env.local / .env.e2e (playwright.config.ts читает .env.e2e сам);\n` +
        `  • прод-секреты — только в Vercel Dashboard и GitHub Secrets.`
    )
  }
}

// ── 2. Установка зависимостей ────────────────────────────────────────────
const isNpmInstall = /(^|[;&|]\s*)npm\s+(install|i|add)\b/.test(command)
if (isNpmInstall) {
  const forbidden = BANNED_PACKAGES.find(p => new RegExp(`(^|\\s)${p.re}(@[\\w.^~-]+)?(\\s|$)`).test(command))
  if (forbidden) {
    block(
      `ЗАБЛОКИРОВАНО: пакет ${forbidden.re} в этом проекте не используется.\n\n` +
        `${forbidden.why}\n\nЕсли пакет всё же нужен — сначала обсудить с Русланом, а не ставить по ходу задачи.`
    )
  }
  if (!/--legacy-peer-deps\b/.test(command)) {
    block(
      `ЗАБЛОКИРОВАНО: установка без \`--legacy-peer-deps\`.\n\n` +
        `На React 19 половина зависимостей объявляет несовместимые peer-диапазоны. Без флага npm ` +
        `перестраивает дерево молча, а ломается это позже — на шаге build.\n\n` +
        `Как надо:\n  npm install --legacy-peer-deps${/(install|i|add)\s+\S/.test(command) ? ' <пакет>' : ''}`
    )
  }
}

// ── 3. git push ──────────────────────────────────────────────────────────
const isPush = /(^|[;&|]\s*)git\s+(-\S+\s+)*push\b/.test(command)
if (isPush && !/--dry-run/.test(command)) {
  process.chdir(repo)
  const { verifyStamp } = await import('../checks/stamp.mjs')
  const { ok, reason } = verifyStamp()
  if (!ok) {
    const branch = git(repo, ['rev-parse', '--abbrev-ref', 'HEAD'])
    block(
      `ЗАБЛОКИРОВАНО: пуш без зелёного \`npm run check\` (${reason}).\n` +
        (branch ? `Ветка: ${branch}\n` : '') +
        `\nСначала:\n  npm run check\n\n` +
        `Он гоняет tsc → границы client/server → правила серверного слоя → визуальный стандарт → ` +
        `кроны → build → тесты и только при полном успехе разрешает пуш. Красных деплоев на Vercel ` +
        `быть не должно.\n\n` +
        `Если проверка уже была зелёной, а код после неё правился — прогнать заново, правки не проверены.`
    )
  }

  const stale = versionBumpMissing(repo)
  if (stale) {
    block(
      `ЗАБЛОКИРОВАНО: в пуше есть правки кода, а версия осталась ${stale}.\n\n` +
        `Поднять по semver и закоммитить package.json вместе с изменениями:\n` +
        `  npm run version:patch   # исправление поведения\n` +
        `  npm run version:minor   # новая возможность\n` +
        `  npm run version:major   # ломающее изменение\n\n` +
        `Версия видна в футере настроек — по ней понимают, что именно раскатано в проде.`
    )
  }
}

noop()
