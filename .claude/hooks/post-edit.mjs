#!/usr/bin/env node
/**
 * PostToolUse hook на Write|Edit — ловит ошибку в момент правки, а не через
 * пять минут на `npm run check`.
 *
 * Что проверяет, в зависимости от файла:
 *   src/**\/*.tsx|ts   → визуальный стандарт «Кабинет» (baseline-ратчет)
 *                        + границы client/server (event handlers, импорт
 *                          клиентских функций в серверные файлы)
 *                        + правила серверного слоя (дубль имени в *.actions.ts,
 *                          force-dynamic в GET-роутах с данными организации)
 *                        + поля форм, которые обработчик не читает
 *   vercel.json        → крон не чаще суток (иначе Vercel молча отбрасывает деплой)
 *
 * Exit code 2 = сообщить модели, что надо исправить.
 */

import path from 'node:path'

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

  if (payload?.cwd) {
    try {
      process.chdir(payload.cwd)
    } catch {}
  }

  const filePath = payload?.tool_input?.file_path
  if (!filePath) process.exit(0)

  const root = process.cwd()
  const relPath = path.relative(root, filePath)
  const problems = []

  // ── vercel.json ────────────────────────────────────────────────────────
  if (path.basename(filePath) === 'vercel.json' && !relPath.startsWith('..')) {
    const { checkVercelCron } = await import('../../scripts/checks/vercel-cron.mjs')
    problems.push(...checkVercelCron())
  }

  // ── исходники ──────────────────────────────────────────────────────────
  const isSource = /\.(ts|tsx)$/.test(filePath) && relPath.startsWith(`src${path.sep}`)
  if (isSource) {
    const { checkFiles } = await import('../../scripts/checks/design-tokens.mjs')
    const { violations } = checkFiles([filePath])
    for (const v of violations) {
      for (const h of v.hits) {
        problems.push(`${v.file}:${h.line} — ${h.msg}\n      ${h.text}`)
      }
    }

    const { checkAll } = await import('../../scripts/checks/client-boundary.mjs')
    problems.push(...checkAll())

    const { checkAll: checkServerRules } = await import('../../scripts/checks/server-rules.mjs')
    problems.push(...checkServerRules([filePath]))

    // Поля форм проверяются целиком: поле живёт в одном файле, обработчик —
    // в другом, и правка любого из них может разорвать пару.
    const { checkFormFields } = await import('../../scripts/checks/form-fields.mjs')
    problems.push(...checkFormFields())

    const { checkFiles: checkAny } = await import('../../scripts/checks/no-any.mjs')
    for (const v of checkAny([filePath]).violations) {
      for (const h of v.hits) {
        problems.push(`${v.file}:${h.line} — ${h.msg}. Взять тип из src/types/database.ts или использовать unknown с сужением\n      ${h.text}`)
      }
    }
  }

  if (problems.length === 0) process.exit(0)

  console.error(
    `Правка нарушает правила проекта — исправить сейчас, до продолжения:\n\n` +
      problems.map(p => `  • ${p}`).join('\n') +
      `\n\nПодробности: визуальный стандарт — skill housepro-ui; ` +
      `границы client/server — вынести функцию в файл без 'use client' ` +
      `(образец: src/features/contracts/utils/rent-apartment-data.ts).`
  )
  process.exit(2)
})
