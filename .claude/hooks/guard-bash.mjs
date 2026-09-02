#!/usr/bin/env node
/**
 * PreToolUse hook на Bash. Два запрета:
 *
 *   1. `git push` без зелёного `npm run check` на текущем коде.
 *      Раньше это было правилом капслоком в CLAUDE.md (в двух местах),
 *      в docs/WORKFLOW.md и в памяти — то есть соблюдалось по настроению.
 *
 *   2. Секреты в командной строке: PAT в URL репозитория, service role key,
 *      боевые ключи Stripe/Resend, пароли E2E. Токен из `git remote set-url
 *      https://TOKEN@github.com/...` оседает в `git remote -v`, в истории
 *      шелла и в логах.
 *
 * Exit code 2 = блокировка, stderr уходит обратно модели.
 * Escape hatch для человека: выполнить команду самому в своём терминале —
 * hook действует только на вызовы из Claude Code.
 */

import { execFileSync } from 'node:child_process'

const SECRET_PATTERNS = [
  { re: /https:\/\/[^\s/@]+@github\.com/i, what: 'PAT в URL репозитория' },
  { re: /\bgh[pousr]_[A-Za-z0-9]{20,}/, what: 'GitHub token' },
  { re: /\bsk_live_[A-Za-z0-9]{10,}/, what: 'боевой ключ Stripe' },
  { re: /\bre_[A-Za-z0-9]{20,}/, what: 'ключ Resend' },
  { re: /\beyJ[A-Za-z0-9_-]{30,}\.[A-Za-z0-9_-]{20,}/, what: 'JWT (похоже на Supabase service role key)' },
  { re: /\b(SUPABASE_SERVICE_ROLE_KEY|E2E_TEST_PASSWORD|TELEGRAM_BOT_TOKEN|CRON_SECRET|OPENROUTER_API_KEY)\s*=\s*['"]?\S/, what: 'секрет присваивается прямо в команде' },
]

const BANNED_PACKAGES = [
  { name: '@hello-pangea/dnd', re: '@hello-pangea/dnd', why: 'Kanban на нативном HTML5 drag-and-drop — библиотека перетаскивания не нужна.' },
  { name: 'react-beautiful-dnd', re: 'react-beautiful-dnd', why: 'Заброшен и несовместим с React 19. Kanban на нативном HTML5 drag-and-drop.' },
  { name: 'axios', re: 'axios', why: 'Везде используется нативный fetch — второй HTTP-клиент только разводит стили запросов.' },
  { name: 'react-query / @tanstack/react-query', re: '(@tanstack/)?react-query', why: 'Данные тянутся Server Components и Server Actions, клиентский кэш-слой не нужен.' },
]

function block(msg) {
  console.error(msg)
  process.exit(2)
}

let input = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', c => (input += c))
process.stdin.on('end', async () => {
  let payload
  try {
    payload = JSON.parse(input)
  } catch {
    process.exit(0)
  }

  // Проверки читают файлы относительно корня проекта
  if (payload?.cwd) {
    try {
      process.chdir(payload.cwd)
    } catch {}
  }

  const command = payload?.tool_input?.command ?? ''
  if (!command) process.exit(0)

  // ── 1. Секреты ─────────────────────────────────────────────────────────
  for (const { re, what } of SECRET_PATTERNS) {
    if (re.test(command)) {
      block(
        `ЗАБЛОКИРОВАНО: в команде ${what}.\n\n` +
          `Секреты не должны попадать в командную строку — они остаются в истории шелла, ` +
          `в логах и (для PAT в remote URL) в \`git remote -v\`.\n\n` +
          `Как надо:\n` +
          `  • push — по уже настроенному origin, без токена в URL;\n` +
          `  • переменные окружения — из .env.local / .env.e2e (playwright.config.ts читает .env.e2e сам);\n` +
          `  • прод-секреты — только в Vercel Dashboard и GitHub Secrets.`
      )
    }
  }

  // ── 2. Установка зависимостей ──────────────────────────────────────────
  const isNpmInstall = /(^|[;&|]\s*)npm\s+(install|i|add)\b/.test(command)
  if (isNpmInstall) {
    const forbidden = BANNED_PACKAGES.find(p => new RegExp(`(^|\\s)${p.re}(@[\\w.^~-]+)?(\\s|$)`).test(command))
    if (forbidden) {
      block(
        `ЗАБЛОКИРОВАНО: пакет ${forbidden.name} в этом проекте не используется.\n\n` +
          `${forbidden.why}\n\n` +
          `Если пакет всё же нужен — сначала обсудить с Русланом, а не ставить по ходу задачи.`
      )
    }
    if (!/--legacy-peer-deps\b/.test(command)) {
      block(
        `ЗАБЛОКИРОВАНО: установка без \`--legacy-peer-deps\`.\n\n` +
          `На React 19 половина зависимостей объявляет несовместимые peer-диапазоны. Без флага\n` +
          `npm перестраивает дерево молча, а ломается это позже — на шаге build.\n\n` +
          `Как надо:\n  npm install --legacy-peer-deps${/(install|i|add)\s+\S/.test(command) ? ' <пакет>' : ''}`
      )
    }
  }

  // ── 3. git push без зелёной проверки ───────────────────────────────────
  const isPush = /(^|[;&|]\s*)git\s+(-\S+\s+)*push\b/.test(command)
  if (isPush && !/--dry-run/.test(command)) {
    const { verifyStamp } = await import('../../scripts/checks/stamp.mjs')
    const { ok, reason } = verifyStamp()
    if (!ok) {
      let branch = ''
      try {
        branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' }).trim()
      } catch {}
      block(
        `ЗАБЛОКИРОВАНО: пуш без зелёного \`npm run check\` (${reason}).\n` +
          (branch ? `Ветка: ${branch}\n` : '') +
          `\nСначала:\n  npm run check\n\n` +
          `Он гоняет tsc → границы client/server → правила серверного слоя → визуальный стандарт → ` +
          `кроны → build → тесты и только при полном успехе разрешает пуш. ` +
          `Красных деплоев на Vercel быть не должно.\n\n` +
          `Если проверка уже была зелёной, а код после неё правился — прогнать заново, правки не проверены.`
      )
    }
  }

  process.exit(0)
})
