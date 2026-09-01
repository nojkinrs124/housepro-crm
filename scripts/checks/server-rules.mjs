/**
 * Два правила серверного слоя, которые раньше были просьбой «не забыть»
 * в CLAUDE.md, а теперь проверяются машиной.
 *
 *   1. Дубль имени функции в *.actions.ts. Turbopack валит сборку с
 *      «the name X is defined multiple times», чаще всего на delete*Action.
 *      Правило звучало как «перед добавлением сделай grep» — ручной шаг,
 *      который пропускается, а расплата приходит на шаге build, самом
 *      долгом в `npm run check`.
 *
 *   2. GET-роут, отдающий данные организации, без
 *      `export const dynamic = 'force-dynamic'`. Next закэширует ответ на
 *      билде, и все арендаторы получат данные того, чей запрос попал в кэш
 *      первым. Это утечка между арендаторами, а не просто баг.
 *
 * На 02.09.2026 нарушений обоих правил в коде нет — поэтому проверки жёсткие,
 * без baseline. Правило про `process.env` намеренно НЕ проверяется: секреты
 * читаются напрямую в 30 файлах, и все обращения законны (см. src/app/api/CLAUDE.md).
 *
 * CLI: node scripts/checks/server-rules.mjs
 */

import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { ROOT, walk, readSafe, rel } from './lib.mjs'

const SRC = path.join(ROOT, 'src')

const EXPORTED_FN_RE = /^export\s+(?:async\s+)?function\s+([a-zA-Z_$][\w$]*)/gm
const ORG_DATA_RE = /organization_id|requireOrgId|getOrgId/
const FORCE_DYNAMIC_RE = /export\s+const\s+dynamic\s*=\s*['"]force-dynamic['"]/

/** Дубли имён экспортированных функций внутри одного *.actions.ts. */
export function checkActionDuplicates(files) {
  const problems = []
  for (const file of files) {
    if (!file.endsWith('.actions.ts')) continue
    const content = readSafe(file)
    if (content === null) continue

    const seen = new Map()
    for (const m of content.matchAll(EXPORTED_FN_RE)) {
      const name = m[1]
      const line = content.slice(0, m.index).split('\n').length
      if (seen.has(name)) {
        problems.push(
          `${rel(file)}:${line} — функция "${name}" объявлена второй раз (первая на строке ${seen.get(name)}). ` +
            `Turbopack упадёт с «the name ${name} is defined multiple times». Переименовать или дописать в существующую.`
        )
      } else {
        seen.set(name, line)
      }
    }
  }
  return problems
}

/** GET-роуты с данными организации обязаны быть force-dynamic. */
export function checkApiRoutes(files) {
  const problems = []
  for (const file of files) {
    if (path.basename(file) !== 'route.ts') continue
    if (!rel(file).startsWith(path.join('src', 'app', 'api'))) continue
    const content = readSafe(file)
    if (content === null) continue

    if (!/export\s+async\s+function\s+GET/.test(content)) continue
    if (!ORG_DATA_RE.test(content)) continue
    if (FORCE_DYNAMIC_RE.test(content)) continue

    problems.push(
      `${rel(file)} — GET отдаёт данные организации без \`export const dynamic = 'force-dynamic'\`. ` +
        `Next закэширует ответ на билде, и арендаторы получат чужие данные.`
    )
  }
  return problems
}

/** Обе проверки разом. Без аргумента — по всему src. */
export function checkAll(files) {
  const targets = files ?? walk(SRC, ['.ts'])
  return [...checkActionDuplicates(targets), ...checkApiRoutes(targets)]
}

// ── CLI ──────────────────────────────────────────────────────────────────
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const problems = checkAll()
  if (problems.length === 0) {
    console.log('✅ Правила серверного слоя соблюдены')
    process.exit(0)
  }
  console.error('❌ Нарушение правил серверного слоя:\n')
  for (const p of problems) console.error(`  - ${p}`)
  process.exit(1)
}
