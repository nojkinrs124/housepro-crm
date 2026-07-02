#!/usr/bin/env node
/**
 * Единая проверка перед git push.
 *
 * Запускать: node scripts/pre-push-check.mjs   (или npm run check)
 *
 * Останавливает пуш, если что-то из этого не проходит:
 *   1. TypeScript (tsc --noEmit)
 *   2. Event handlers (onClick/onChange/onSubmit/...) в Server Components
 *   3. Импорт обычных функций (не React-компонентов) из файлов с 'use client'
 *      в серверные файлы — та самая ошибка "Attempted to call X() from the
 *      server but X is on the client". tsc и `next build` её НЕ всегда ловят:
 *      на страницах с `export const dynamic = 'force-dynamic'` или с cookies()
 *      Next.js не выполняет тело компонента во время сборки (страница
 *      помечается 'ƒ Dynamic, server-rendered on demand'), поэтому баг
 *      всплывает только в реальном запросе в проде.
 *   4. npm run build
 *   5. npm test
 *
 * Любой шаг с ошибкой -> exit code 1, сборка/пуш не выполняются.
 */

import { execSync } from 'node:child_process'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const SRC = path.join(ROOT, 'src')

let hasErrors = false
const results = []

function section(title) {
  console.log(`\n${'─'.repeat(60)}\n${title}\n${'─'.repeat(60)}`)
}

function record(name, ok, details) {
  results.push({ name, ok })
  if (!ok) hasErrors = true
  console.log(ok ? `✅ ${name}` : `❌ ${name}`)
  if (details) console.log(details)
}

// ── Обход файлов ────────────────────────────────────────────────────────

function walk(dir, exts, exclude = []) {
  const out = []
  for (const entry of readdirSync(dir)) {
    if (exclude.includes(entry)) continue
    const full = path.join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      out.push(...walk(full, exts, exclude))
    } else if (exts.some(e => entry.endsWith(e))) {
      out.push(full)
    }
  }
  return out
}

const allSourceFiles = walk(SRC, ['.ts', '.tsx'], ['node_modules', '.next', 'tests'])

// ── Шаг 1: TypeScript ───────────────────────────────────────────────────

section('1/5 · TypeScript (tsc --noEmit)')
try {
  execSync('npx tsc --noEmit', { cwd: ROOT, stdio: 'pipe' })
  record('TypeScript: ошибок нет', true)
} catch (e) {
  record('TypeScript: есть ошибки', false, e.stdout?.toString() || e.message)
}

// ── Шаг 2: event handlers в Server Components ───────────────────────────

section('2/5 · Event handlers в Server Components')
{
  const eventHandlerRe = /\bon(Click|Change|Submit|Drag|Drop|MouseEnter|MouseLeave|KeyDown|KeyUp|Focus|Blur)\w*\s*=/
  const problems = []
  for (const file of walk(path.join(SRC, 'app'), ['.tsx'], ['node_modules', '.next'])) {
    const content = readFileSync(file, 'utf8')
    const firstLine = content.split('\n')[0].trim()
    const isClientFile = firstLine === "'use client'" || firstLine === '"use client"'
    if (!isClientFile && eventHandlerRe.test(content)) {
      problems.push(path.relative(ROOT, file))
    }
  }
  record(
    problems.length === 0 ? 'Event handlers только в Client Components' : `Найдены event handlers в ${problems.length} Server Component(s)`,
    problems.length === 0,
    problems.map(p => `  - ${p}`).join('\n')
  )
}

// ── Шаг 3: границы client/server (импорт функций из 'use client' файлов) ──

section('3/5 · Границы client/server (импорт функций из \'use client\' файлов)')
{
  // 3.1 Найти все 'use client' файлы и их "функциональные" (не-компонентные) экспорты.
  // Эвристика: имя с маленькой буквы = обычная функция/значение (не React-компонент,
  // т.к. компоненты по конвенции PascalCase и единственное, что можно "рендерить" из Server Component).
  const clientExports = new Map() // absolute file path -> Set<exportName>

  const exportPatterns = [
    /export\s+(?:async\s+)?function\s+([a-zA-Z_$][\w$]*)/g,
    /export\s+const\s+([a-zA-Z_$][\w$]*)\s*[:=]/g,
  ]

  for (const file of allSourceFiles) {
    const content = readFileSync(file, 'utf8')
    const firstLine = content.split('\n')[0].trim()
    const isClientFile = firstLine === "'use client'" || firstLine === '"use client"'
    if (!isClientFile) continue

    const names = new Set()
    for (const re of exportPatterns) {
      let m
      re.lastIndex = 0
      while ((m = re.exec(content))) {
        const name = m[1]
        if (/^[a-z_]/.test(name)) names.add(name) // только lowercase-first — не компоненты
      }
    }
    // export { a, b as c }
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

  // 3.2 Резолвер относительных / '@/' импортов в абсолютный путь файла.
  function resolveImport(fromFile, specifier) {
    if (!specifier.startsWith('.') && !specifier.startsWith('@/')) return null // внешний пакет
    let base = specifier.startsWith('@/')
      ? path.join(SRC, specifier.slice(2))
      : path.resolve(path.dirname(fromFile), specifier)

    const candidates = [
      base,
      `${base}.ts`, `${base}.tsx`,
      path.join(base, 'index.ts'), path.join(base, 'index.tsx'),
    ]
    for (const c of candidates) {
      if (allSourceFiles.includes(c)) return c
    }
    return null
  }

  // 3.3 Проверить все НЕ-client файлы на импорт таких функций.
  const violations = []
  const importRe = /import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g

  for (const file of allSourceFiles) {
    const content = readFileSync(file, 'utf8')
    const firstLine = content.split('\n')[0].trim()
    const isClientFile = firstLine === "'use client'" || firstLine === '"use client"'
    if (isClientFile) continue // клиентские файлы могут импортировать друг друга свободно

    let m
    importRe.lastIndex = 0
    while ((m = importRe.exec(content))) {
      const specifier = m[2]
      const resolved = resolveImport(file, specifier)
      if (!resolved || !clientExports.has(resolved)) continue

      const namesHere = clientExports.get(resolved)
      for (const part of m[1].split(',')) {
        const cleaned = part.trim().replace(/^type\s+/, '') // пропускаем `import type { X }`
        if (part.trim().startsWith('type ')) continue
        const originalName = cleaned.split(/\s+as\s+/)[0].trim()
        if (namesHere.has(originalName)) {
          violations.push({
            file: path.relative(ROOT, file),
            name: originalName,
            source: path.relative(ROOT, resolved),
          })
        }
      }
    }
  }

  record(
    violations.length === 0
      ? 'Нет импортов клиентских функций в серверные файлы'
      : `Найдено ${violations.length} нарушени${violations.length === 1 ? 'е' : 'й'} границы client/server`,
    violations.length === 0,
    violations.map(v => `  - ${v.file} импортирует "${v.name}" из ${v.source} (файл с 'use client') — вызов такой функции с сервера упадёт в рантайме`).join('\n')
  )
}

// ── Шаг 4: build ─────────────────────────────────────────────────────────

section('4/5 · npm run build')
if (!hasErrors) {
  try {
    execSync('npm run build', { cwd: ROOT, stdio: 'pipe' })
    record('Build прошёл успешно', true)
  } catch (e) {
    record('Build упал', false, (e.stdout?.toString() || '') + (e.stderr?.toString() || ''))
  }
} else {
  console.log('⏭  Пропущено (есть ошибки на предыдущих шагах)')
}

// ── Шаг 5: тесты ────────────────────────────────────────────────────────

section('5/5 · npm test')
if (!hasErrors) {
  try {
    const out = execSync('npm test', { cwd: ROOT, stdio: 'pipe' }).toString()
    record('Тесты прошли', true)
  } catch (e) {
    record('Тесты упали', false, (e.stdout?.toString() || '') + (e.stderr?.toString() || ''))
  }
} else {
  console.log('⏭  Пропущено (есть ошибки на предыдущих шагах)')
}

// ── Итог ─────────────────────────────────────────────────────────────────

section('Итог')
for (const r of results) console.log(r.ok ? `✅ ${r.name}` : `❌ ${r.name}`)

if (hasErrors) {
  console.log('\n🚫 Есть ошибки — пуш выполнять НЕЛЬЗЯ, пока всё не исправлено.')
  process.exit(1)
} else {
  console.log('\n✅ Всё чисто — можно пушить.')
  process.exit(0)
}
