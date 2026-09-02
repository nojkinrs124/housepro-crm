/**
 * Ратчет по `any`.
 *
 * Правило «никакого any» стояло в CLAUDE.md как жёсткий запрет, а в коде на
 * 02.09.2026 было 209 вхождений `: any` / `as any` / подавлений линтера в 51
 * файле — следствие заглушки `export type Database = any`, из-за которой каждый
 * запрос к Supabase возвращал any.
 *
 * Правило, нарушенное сотню раз, обесценивает и все соседние правила. Поэтому
 * запрет здесь не абсолютный, а ратчетный, как у визуального стандарта:
 *   · новое вхождение any в файле  → блокировка;
 *   · существующие                 → зафиксированы в .claude/any-baseline.json;
 *   · убрали any из файла          → baseline автоматически опускается, назад
 *                                    дороги нет.
 *
 * Заглушки больше нет (задача #8 закрыта, типы генерируются в src/types/supabase.ts),
 * но 208 написанных ранее приведений сами не исчезли — снимаются попутно, задача #21.
 *
 * CLI: node scripts/checks/no-any.mjs            — проверить
 *      node scripts/checks/no-any.mjs --baseline — переснять baseline
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { ROOT, walk, readSafe, rel } from './lib.mjs'

const SRC = path.join(ROOT, 'src')
const BASELINE_PATH = path.join(ROOT, '.claude', 'any-baseline.json')

const RULES = [
  { re: /:\s*any\b/, msg: 'аннотация `: any`' },
  { re: /\bas\s+any\b/, msg: 'приведение `as any`' },
  { re: /\bany\[\]|\bArray<any>|<any>/, msg: '`any` в дженерике' },
  { re: /no-explicit-any/, msg: 'подавление линтера no-explicit-any' },
]

export function scanFile(file) {
  const content = readSafe(file)
  if (content === null) return { count: 0, hits: [] }

  const hits = []
  const lines = content.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i]
    if (text.trim().startsWith('*')) continue // блочные комментарии
    for (const { re, msg } of RULES) {
      if (re.test(text)) {
        hits.push({ line: i + 1, msg, text: text.trim().slice(0, 120) })
        break
      }
    }
  }
  return { count: hits.length, hits }
}

export function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) return {}
  try {
    return JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
  } catch {
    return {}
  }
}

export function saveBaseline(map) {
  mkdirSync(path.dirname(BASELINE_PATH), { recursive: true })
  writeFileSync(BASELINE_PATH, JSON.stringify(map, null, 2) + '\n')
}

export function checkFiles(files, { ratchet = true } = {}) {
  const baseline = loadBaseline()
  const violations = []
  let changed = false

  for (const file of files) {
    const key = rel(file)
    const { count, hits } = scanFile(file)
    const allowed = baseline[key] ?? 0

    if (count > allowed) {
      violations.push({ file: key, count, allowed, hits: hits.slice(allowed) })
    } else if (count < allowed && ratchet) {
      if (count === 0) delete baseline[key]
      else baseline[key] = count
      changed = true
    }
  }

  if (ratchet && changed) saveBaseline(baseline)
  return { violations }
}

export function allSourceFiles() {
  return walk(SRC, ['.ts', '.tsx'])
}

// ── CLI ──────────────────────────────────────────────────────────────────
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2)

  if (args.includes('--baseline')) {
    const map = {}
    for (const file of allSourceFiles()) {
      const { count } = scanFile(file)
      if (count > 0) map[rel(file)] = count
    }
    saveBaseline(map)
    const total = Object.values(map).reduce((s, n) => s + n, 0)
    console.log(`Baseline снят: ${Object.keys(map).length} файлов, ${total} вхождений any зафиксировано как легаси.`)
    console.log(`Файл: ${rel(BASELINE_PATH)}`)
    process.exit(0)
  }

  const { violations } = checkFiles(allSourceFiles())

  if (violations.length === 0) {
    console.log('✅ any: новых вхождений нет')
    process.exit(0)
  }

  console.error('❌ Новые вхождения `any`:\n')
  for (const v of violations) {
    console.error(`  ${v.file} (было ${v.allowed}, стало ${v.count})`)
    for (const h of v.hits) {
      console.error(`    ${v.file}:${h.line}  ${h.msg}`)
      console.error(`      ${h.text}`)
    }
    console.error('')
  }
  console.error(
    'Типы брать из src/types/database.ts. Если тип честно неизвестен — `unknown` с сужением,\n' +
      'а не any. Оставшиеся приведения — хвост задачи #8, снимаются попутно (задача #21).'
  )
  process.exit(1)
}
