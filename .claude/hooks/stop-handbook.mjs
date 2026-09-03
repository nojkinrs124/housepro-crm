#!/usr/bin/env node
/**
 * Stop hook — напоминание про главу справочника, когда поменялось поведение
 * раздела CRM, а инструкция к нему осталась прежней.
 *
 * Зачем. Инструкция, которая врёт, хуже отсутствующей: по ней сотрудник делает
 * не то и перестаёт верить всей базе знаний. А расходится она бесшумно — код
 * уезжает в прод, текст остаётся, и узнают об этом только когда кто-то
 * ошибётся.
 *
 * Почему напоминание, а не запрет. Хук, который требует править главу на
 * каждое касание кода, быстро научатся обходить пустой правкой — и тогда он
 * не ловит вообще ничего, но всех раздражает. Поэтому здесь узкий триггер и
 * мягкий выход: сказать вслух, какую главу стоит перечитать, и не мешать
 * работать, если правка на текст не влияет.
 *
 * Узкий триггер: только страницы и компоненты (то, что сотрудник видит на
 * экране). Правки в actions, сервисах, миграциях и тестах поведение раздела
 * для читателя инструкции обычно не меняют.
 */

import { execFileSync } from 'node:child_process'

/**
 * Раздел CRM → глава справочника. Ключ — каталог в `src/app/(dashboard)/`
 * или `src/features/`. Разделы без своей главы (служебные вроде `search`,
 * `dashboard`, `export`) сюда намеренно не попадают.
 */
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

let input = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', c => (input += c))
process.stdin.on('end', () => {
  let payload
  try {
    payload = JSON.parse(input)
  } catch {
    process.exit(0)
  }

  if (payload?.stop_hook_active) process.exit(0)

  if (payload?.cwd) {
    try {
      process.chdir(payload.cwd)
    } catch {}
  }

  let changed = ''
  try {
    changed = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' })
  } catch {
    process.exit(0)
  }

  const files = changed
    .split('\n')
    .filter(Boolean)
    .map(l => l.slice(3).trim())

  if (files.length === 0) process.exit(0)

  const touchedChapters = new Set(
    files.filter(f => f.startsWith('docs/handbook/')).map(f => f.replace('docs/handbook/', ''))
  )

  // Что сотрудник видит на экране: страницы раздела и его компоненты
  const due = new Map()
  for (const f of files) {
    const m =
      f.match(/^src\/app\/\(dashboard\)\/([^/]+)\/.*\.tsx$/) ??
      f.match(/^src\/app\/\(portal\)\/.*()\.tsx$/) ??
      f.match(/^src\/features\/([^/]+)\/components\/.*\.tsx$/)
    if (!m) continue

    const section = f.startsWith('src/app/(portal)/') ? 'portal' : m[1]
    const chapter = CHAPTERS[section]
    if (!chapter || touchedChapters.has(chapter)) continue

    if (!due.has(chapter)) due.set(chapter, new Set())
    due.get(chapter).add(section)
  }

  if (due.size === 0) process.exit(0)

  const lines = [...due.entries()].map(
    ([chapter, sections]) => `  • docs/handbook/${chapter} — менялись экраны: ${[...sections].join(', ')}`
  )

  console.error(
    `Поведение разделов изменилось, а справочник — нет:\n${lines.join('\n')}\n\n` +
      `Перечитать главу и поправить, если инструкция разошлась с экраном. Правка ` +
      `косметическая или на текст не влияет — так и скажи, и продолжай.\n\n` +
      `Главу в базе знаний CRM после правки пересеять: npm run seed:handbook`
  )
  process.exit(2)
})
