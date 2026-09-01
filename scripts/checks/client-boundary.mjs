/**
 * Границы client/server — самая дорогая ошибка проекта.
 *
 * Ловит два класса:
 *   1. Event handlers (onClick/onChange/…) в Server Component.
 *   2. Импорт обычной функции (не React-компонента) из файла с 'use client'
 *      в серверный файл — "Attempted to call X() from the server but X is on
 *      the client". tsc и `next build` это НЕ ловят: страницы с
 *      `export const dynamic = 'force-dynamic'` или с cookies() помечаются
 *      'ƒ Dynamic' и их тело во время сборки не выполняется — баг всплывает
 *      только в реальном запросе в проде.
 *
 * Логика перенесена один-в-один из scripts/pre-push-check.mjs, чтобы её можно
 * было вызывать ещё и из hook'а на каждое редактирование — тогда ошибка ловится
 * в момент правки, а не через пять минут на пуше.
 *
 * CLI: node scripts/checks/client-boundary.mjs
 */

import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { ROOT, walk, isClientFile, readSafe, rel } from './lib.mjs'

const SRC = path.join(ROOT, 'src')

const EVENT_HANDLER_RE =
  /\bon(Click|Change|Submit|Drag|Drop|MouseEnter|MouseLeave|KeyDown|KeyUp|Focus|Blur)\w*\s*=/

const EXPORT_PATTERNS = [
  /export\s+(?:async\s+)?function\s+([a-zA-Z_$][\w$]*)/g,
  /export\s+const\s+([a-zA-Z_$][\w$]*)\s*[:=]/g,
]

/** Event handlers в серверных компонентах под src/app. */
export function checkEventHandlers() {
  const problems = []
  for (const file of walk(path.join(SRC, 'app'), ['.tsx'])) {
    const content = readSafe(file)
    if (content === null) continue
    if (!isClientFile(content) && EVENT_HANDLER_RE.test(content)) problems.push(rel(file))
  }
  return problems
}

/** Импорты клиентских функций в серверные файлы. */
export function checkClientImports() {
  const allSourceFiles = walk(SRC, ['.ts', '.tsx'], ['node_modules', '.next', '.claude', 'tests'])

  // 1. Функциональные (lowercase-first, то есть не React-компоненты) экспорты 'use client' файлов
  const clientExports = new Map()
  for (const file of allSourceFiles) {
    const content = readSafe(file)
    if (content === null || !isClientFile(content)) continue

    const names = new Set()
    for (const re of EXPORT_PATTERNS) {
      re.lastIndex = 0
      let m
      while ((m = re.exec(content))) {
        if (/^[a-z_]/.test(m[1])) names.add(m[1])
      }
    }
    const namedExportRe = /export\s*\{([^}]+)\}/g
    let m
    while ((m = namedExportRe.exec(content))) {
      for (const part of m[1].split(',')) {
        const name = part.trim().split(/\s+as\s+/)[0].trim()
        if (name && /^[a-z_]/.test(name)) names.add(name)
      }
    }
    if (names.size > 0) clientExports.set(file, names)
  }

  // 2. Резолвер относительных и '@/' импортов
  function resolveImport(fromFile, specifier) {
    if (!specifier.startsWith('.') && !specifier.startsWith('@/')) return null
    const base = specifier.startsWith('@/')
      ? path.join(SRC, specifier.slice(2))
      : path.resolve(path.dirname(fromFile), specifier)
    const candidates = [
      base,
      `${base}.ts`,
      `${base}.tsx`,
      path.join(base, 'index.ts'),
      path.join(base, 'index.tsx'),
    ]
    return candidates.find(c => allSourceFiles.includes(c)) ?? null
  }

  // 3. Проверка серверных файлов
  const violations = []
  const importRe = /import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g

  for (const file of allSourceFiles) {
    const content = readSafe(file)
    if (content === null || isClientFile(content)) continue

    importRe.lastIndex = 0
    let m
    while ((m = importRe.exec(content))) {
      const resolved = resolveImport(file, m[2])
      if (!resolved || !clientExports.has(resolved)) continue
      const namesHere = clientExports.get(resolved)
      for (const part of m[1].split(',')) {
        if (part.trim().startsWith('type ')) continue
        const originalName = part.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim()
        if (namesHere.has(originalName)) {
          violations.push({ file: rel(file), name: originalName, source: rel(resolved) })
        }
      }
    }
  }

  return violations
}

/** Обе проверки разом — для hook'а. Возвращает массив строк-сообщений. */
export function checkAll() {
  const out = []
  for (const f of checkEventHandlers()) {
    out.push(`${f}: event handler в Server Component — вынести интерактив в отдельный файл с 'use client'`)
  }
  for (const v of checkClientImports()) {
    out.push(
      `${v.file}: импортирует "${v.name}" из ${v.source} (файл с 'use client') — вызов с сервера упадёт в рантайме. Вынести функцию в отдельный файл без 'use client' (образец: src/features/contracts/utils/rent-apartment-data.ts)`
    )
  }
  return out
}

// ── CLI ──────────────────────────────────────────────────────────────────
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const problems = checkAll()
  if (problems.length === 0) {
    console.log('✅ Границы client/server чистые')
    process.exit(0)
  }
  console.error('❌ Нарушение границы client/server:\n')
  for (const p of problems) console.error(`  - ${p}`)
  process.exit(1)
}
