#!/usr/bin/env node
/**
 * Hermes pre_verify (один раз на ход) — то, что в Claude Code делал PostToolUse
 * на каждую правку, плюс напоминания про README и справочник.
 *
 * Разница принципиальная: post_tool_call в Hermes блокировать не может, а
 * pre_verify может вернуть модели сообщение и попросить продолжить работу
 * ({"action":"continue","message":"..."}), пока ход не закончен. Поэтому проверки
 * гоняются по `extra.changed_paths` всего хода, а не по одному файлу.
 *
 * Что проверяется, в зависимости от файла:
 *   src/**\/*.tsx|ts → визуальный стандарт (baseline-ратчет), границы
 *                      client/server, правила серверного слоя (дубль имени в
 *                      *.actions.ts, force-dynamic в GET-роутах), `any`, поля форм
 *   vercel.json      → крон не чаще суток
 *
 * Плюс напоминания: README при новом модуле, глава docs/handbook/ при правке
 * экранов раздела.
 *
 * Защита от зацикливания: extra.attempt >= 2 → молчим (модель уже получила
 * замечания дважды, дальше это превращается в бесконечный ход).
 */

import { findRepoRoot, relToRepo, continueWith, noop, readPayload } from './lib-hook.mjs'
import path from 'node:path'

const CHAPTERS = {
  leads: '01-лиды.md',
  deals: '02-сделки.md',
  directions: '02-сделки.md',
  contacts: '03-контакты.md',
  properties: '04-объекты.md',
  showings: '05-показы.md',
  collections: '06-подборки.md',
  contracts: '07-договоры.md',
  management: '08-управление.md',
  meters: '08-управление.md',
  plans: '08-управление.md',
  tasks: '09-задачи-и-календарь.md',
  calendar: '09-задачи-и-календарь.md',
  accounting: '10-бухгалтерия.md',
  payments: '10-бухгалтерия.md',
  analytics: '11-аналитика.md',
  employees: '12-сотрудники-и-права.md',
  users: '12-сотрудники-и-права.md',
  settings: '13-настройки.md',
  knowledge: '15-база-знаний.md',
  portal: '16-личные-кабинеты.md',
  requests: '16-личные-кабинеты.md',
}

const payload = readPayload()
if (!payload) noop()

const extra = payload?.extra ?? {}
const attempt = Number(extra.attempt ?? 0)
if (attempt >= 2) noop()

const repo = findRepoRoot(payload)
if (!repo) noop()

const changed = (Array.isArray(extra.changed_paths) ? extra.changed_paths : [])
  .map(p => relToRepo(repo, String(p)))
  .filter(Boolean)
  .filter(p => !p.startsWith('docs/archive/'))

if (changed.length === 0) noop()

process.chdir(repo)

const problems = []
const reminders = []

// ── vercel.json ──────────────────────────────────────────────────────────
if (changed.some(f => f === 'vercel.json')) {
  const { checkVercelCron } = await import('../checks/vercel-cron.mjs')
  problems.push(...checkVercelCron())
}

// ── исходники ────────────────────────────────────────────────────────────
const srcFiles = changed.filter(f => /^src[/\\].*\.(ts|tsx)$/.test(f)).map(f => path.join(repo, f))

if (srcFiles.length > 0) {
  try {
    const { checkFiles } = await import('../checks/design-tokens.mjs')
    for (const v of checkFiles(srcFiles).violations) {
      for (const h of v.hits) problems.push(`${v.file}:${h.line} — ${h.msg}\n      ${h.text}`)
    }
  } catch (e) {
    reminders.push(`визуальный стандарт не проверился: ${e.message}`)
  }

  try {
    const { checkAll } = await import('../checks/client-boundary.mjs')
    problems.push(...checkAll())
  } catch (e) {
    reminders.push(`границы client/server не проверились: ${e.message}`)
  }

  try {
    const { checkAll: checkServerRules } = await import('../checks/server-rules.mjs')
    problems.push(...checkServerRules(srcFiles))
  } catch (e) {
    reminders.push(`правила серверного слоя не проверились: ${e.message}`)
  }

  try {
    const { checkFiles: checkAny } = await import('../checks/no-any.mjs')
    for (const v of checkAny(srcFiles).violations) {
      for (const h of v.hits) {
        problems.push(`${v.file}:${h.line} — ${h.msg}. Взять тип из src/types/database.ts или unknown с сужением\n      ${h.text}`)
      }
    }
  } catch (e) {
    reminders.push(`проверка any не прошла: ${e.message}`)
  }

  try {
    // Поля форм проверяются целиком: поле в одном файле, обработчик — в другом.
    const { checkFormFields } = await import('../checks/form-fields.mjs')
    problems.push(...checkFormFields())
  } catch (e) {
    reminders.push(`проверка полей форм не прошла: ${e.message}`)
  }
}

// ── напоминания ──────────────────────────────────────────────────────────
if (!changed.includes('README.md')) {
  const modules = new Set()
  for (const f of changed) {
    const m =
      /^src\/app\/\(dashboard\)\/([^/]+)\//.exec(f.endsWith('/page.tsx') ? f : '') ??
      /^src\/app\/api\/([^/]+)\//.exec(f) ??
      /^src\/features\/([^/]+)\//.exec(f)
    if (m && /^(src\/features|src\/app\/api|.*\/page\.tsx)$/.test(f) && !f.includes('/components/')) {
      modules.add(m[1])
    }
  }
  // README нужен только при появлении НОВОГО каталога-модуля — проверяем по факту
  // существования в HEAD; если каталога там не было, это новый модуль.
  const { git } = await import('./lib-hook.mjs')
  const fresh = [...modules].filter(mod => {
    const probe = git(repo, ['ls-tree', '-d', '--name-only', 'HEAD', `src/features/${mod}`, `src/app/api/${mod}`, `src/app/(dashboard)/${mod}`])
    return probe === ''
  })
  if (fresh.length > 0) {
    reminders.push(
      `README.md не тронут, а в правках новые модули: ${fresh.join(', ')}. Если появился новый модуль ` +
        `или заметная фича — обновить таблицу «Возможности» тем же коммитом (мелкий багфикс — можно продолжать).`
    )
  }
}

const touchedChapters = new Set(changed.filter(f => f.startsWith('docs/handbook/')).map(f => f.replace('docs/handbook/', '')))
const due = new Map()
for (const f of changed) {
  const m =
    /^src\/app\/\(dashboard\)\/([^/]+)\/.*\.tsx$/.exec(f) ??
    /^src\/app\/\(portal\)\/.*\.tsx$/.exec(f) ??
    /^src\/features\/([^/]+)\/components\/.*\.tsx$/.exec(f)
  if (!m) continue
  const section = f.startsWith('src/app/(portal)/') ? 'portal' : m[1]
  const chapter = CHAPTERS[section]
  if (!chapter || touchedChapters.has(chapter)) continue
  if (!due.has(chapter)) due.set(chapter, new Set())
  due.get(chapter).add(section)
}
if (due.size > 0) {
  const lines = [...due.entries()].map(([ch, sections]) => `docs/handbook/${ch} — экраны: ${[...sections].join(', ')}`)
  reminders.push(
    `Изменились экраны разделов, а справочник — нет:\n  • ${lines.join('\n  • ')}\n` +
      `Перечитать главу и поправить, если инструкция разошлась с экраном; после правки — \`npm run seed:handbook\`. ` +
      `Правка косметическая или на текст не влияет — так и скажи и продолжай.`
  )
}

// ── итог ─────────────────────────────────────────────────────────────────
if (problems.length === 0 && reminders.length === 0) noop()

const parts = []
if (problems.length > 0) {
  parts.push(
    `Правка нарушает правила проекта — исправить до конца хода:\n\n` +
      problems.map(p => `  • ${p}`).join('\n') +
      `\n\nПодробности: визуальный стандарт — skill housepro-ui; границы client/server — вынести функцию ` +
      `в файл без 'use client' (образец: src/features/contracts/utils/rent-apartment-data.ts).`
  )
}
if (reminders.length > 0) parts.push(reminders.join('\n\n'))

continueWith(parts.join('\n\n'))
