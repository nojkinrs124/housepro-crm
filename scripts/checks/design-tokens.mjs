/**
 * Линтер визуального стандарта «Кабинет».
 *
 * Заменяет собой чек-лист из 14 пунктов, который раньше лежал текстом в CLAUDE.md
 * и проверялся глазами (то есть через раз). Полный гайд — skill `housepro-ui`,
 * здесь только машинно проверяемая часть.
 *
 * РАБОТАЕТ ПО BASELINE-РАТЧЕТУ:
 *   .claude/design-baseline.json хранит количество нарушений на файл на момент
 *   снятия baseline. Проверка падает, только если в файле нарушений стало БОЛЬШЕ.
 *   Легаси (10 файлов с font-mono для API-ключей, градиент поверх фото объекта
 *   и т.п.) не мешает работать, но и вырасти не даёт. Если нарушений стало
 *   меньше — baseline автоматически опускается (ратчет только вниз).
 *
 * CLI:
 *   node scripts/checks/design-tokens.mjs                 # проверить весь src/
 *   node scripts/checks/design-tokens.mjs --files a.tsx   # проверить указанные
 *   node scripts/checks/design-tokens.mjs --baseline      # переснять baseline
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { ROOT, walk, readSafe, rel } from './lib.mjs'

const SRC = path.join(ROOT, 'src')
const BASELINE_PATH = path.join(ROOT, '.claude', 'design-baseline.json')

const TW_COLORS =
  'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose'

export const RULES = [
  {
    id: 'shadow',
    re: /\b(?:drop-)?shadow-(?:sm|md|lg|xl|2xl|\[)|boxShadow/g,
    msg: 'теней в системе нет — форму задаёт border border-[var(--hp-border)]',
  },
  {
    id: 'hover-transform',
    re: /hover:-?translate-|hover:scale-/g,
    msg: 'hover — только смена цвета границы/фона, без подъёма и скейла',
  },
  {
    id: 'gradient',
    re: /bg-gradient-|linear-gradient\(/g,
    msg: 'градиентов нет — акцент плоский, var(--hp-accent)',
  },
  {
    id: 'radius',
    re: /\brounded-(?:sm|md|lg|xl|2xl|3xl|\[\d+px\])/g,
    msg: 'радиус только через var(--hp-radius) / --hp-radius-sm / --hp-radius-badge (rounded-full можно на точках-статусах, полосках и спиннерах)',
  },
  {
    id: 'tailwind-palette',
    re: new RegExp(`\\b(?:bg|text|border|ring|from|to|via|divide)-(?:${TW_COLORS})-\\d{2,3}\\b`, 'g'),
    msg: 'палитра Tailwind вычищена из проекта — только токены var(--hp-*)',
  },
  {
    id: 'hardcoded-hex',
    re: /#[0-9A-Fa-f]{6}\b/g,
    msg: 'хардкод цвета — использовать var(--hp-*) из globals.css',
  },
  {
    id: 'font-mono',
    re: /\bfont-mono\b/g,
    msg: 'моно-шрифта в системе нет — числа/телефоны/даты обычным интерфейсным (исключение — API-ключи и стектрейсы, они уже в baseline)',
  },
]

/** Считает нарушения в одном файле. Возвращает { count, hits: [{line, rule, text}] }. */
export function scanFile(file) {
  const content = readSafe(file)
  if (content === null) return { count: 0, hits: [] }
  const lines = content.split('\n')
  const hits = []
  lines.forEach((text, i) => {
    // строки-комментарии не считаем — там объясняют, а не красят
    const trimmed = text.trim()
    if (trimmed.startsWith('*') || trimmed.startsWith('//')) return
    for (const rule of RULES) {
      rule.re.lastIndex = 0
      if (rule.re.test(text)) hits.push({ line: i + 1, rule: rule.id, msg: rule.msg, text: trimmed.slice(0, 140) })
    }
  })
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

/**
 * Проверяет файлы против baseline.
 * @returns {{ violations: Array, ratcheted: string[] }}
 *   violations — файлы, где нарушений стало больше, чем в baseline
 *   ratcheted  — файлы, где стало меньше (baseline опущен)
 */
export function checkFiles(files, { ratchet = true } = {}) {
  const baseline = loadBaseline()
  const violations = []
  const ratcheted = []
  let changed = false

  for (const file of files) {
    const key = rel(file)
    const { count, hits } = scanFile(file)
    const allowed = baseline[key] ?? 0

    if (count > allowed) {
      violations.push({ file: key, count, allowed, hits: hits.slice(allowed) })
    } else if (count < allowed) {
      ratcheted.push(key)
      if (ratchet) {
        if (count === 0) delete baseline[key]
        else baseline[key] = count
        changed = true
      }
    }
  }

  if (ratchet && changed) saveBaseline(baseline)
  return { violations, ratcheted }
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
    console.log(`Baseline снят: ${Object.keys(map).length} файлов, ${total} нарушений зафиксировано как легаси.`)
    console.log(`Файл: ${rel(BASELINE_PATH)}`)
    process.exit(0)
  }

  const fileArgIdx = args.indexOf('--files')
  const files =
    fileArgIdx >= 0
      ? args.slice(fileArgIdx + 1).map(f => path.resolve(ROOT, f))
      : allSourceFiles()

  const { violations } = checkFiles(files)

  if (violations.length === 0) {
    console.log('✅ Визуальный стандарт: новых нарушений нет')
    process.exit(0)
  }

  console.error('❌ Визуальный стандарт «Кабинет» — новые нарушения:\n')
  for (const v of violations) {
    console.error(`  ${v.file} (было ${v.allowed}, стало ${v.count})`)
    for (const h of v.hits) {
      console.error(`    ${v.file}:${h.line}  [${h.rule}] ${h.msg}`)
      console.error(`      ${h.text}`)
    }
    console.error('')
  }
  process.exit(1)
}
