/**
 * Словарь стадий и направлений в коде обязан совпадать с CHECK-констрейнтами в базе.
 *
 * Почему это отдельная проверка: 02.09.2026 такое уже разъехалось у статусов лидов.
 * В коде появились `interested` и `rejected`, в базе их не было, зато оставался
 * `meeting`, которого нет в коде. Смена статуса на «Заинтересован» падала PATCH 400
 * (leads_status_check), Server Action возвращал ошибку, а интерфейс её проглатывал:
 * статус мигал и возвращался после перезагрузки. Чинилось миграцией
 * supabase/migrations/20260902_sync_leads_status_check_with_code.sql.
 *
 * С четырьмя направлениями цена такой ошибки выше: у каждого своя воронка, и
 * добавление стадии в конфиг без миграции ломает переход именно на ней — то есть
 * ровно там, куда работа и должна двигаться.
 *
 * Сверяется код с миграциями, а не с живой базой: проверка обязана работать
 * offline, без доступа к Supabase и без токена.
 *
 * CLI: node scripts/checks/stage-dictionary.mjs
 */

import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { ROOT, readSafe, rel, walk } from './lib.mjs'

const DIRECTIONS_TS = path.join(ROOT, 'src/features/directions/config/directions.ts')
const MIGRATIONS_DIR = path.join(ROOT, 'supabase/migrations')

/** Значения из `array[ 'a'::text, 'b'::text ]` последнего вхождения констрейнта. */
function constraintValues(sql, constraintName) {
  const re = new RegExp(
    `add\\s+constraint\\s+${constraintName}\\b[\\s\\S]*?array\\s*\\[([\\s\\S]*?)\\]`,
    'gi',
  )
  let last = null
  let m
  while ((m = re.exec(sql)) !== null) last = m[1]
  if (last === null) return null
  return new Set([...last.matchAll(/'([^']+)'/g)].map(x => x[1]))
}

/**
 * Констрейнт мог переписываться несколько раз в разных миграциях — истина в
 * последней по алфавиту, потому что имена файлов начинаются с даты.
 */
function latestConstraint(constraintName) {
  const files = walk(MIGRATIONS_DIR, ['.sql']).sort()
  let found = null
  for (const file of files) {
    const sql = readSafe(file)
    if (sql === null) continue
    const values = constraintValues(sql, constraintName)
    if (values) found = { file, values }
  }
  return found
}

/** Значения из конфига: `value: 'sourcing',` внутри directions.ts. */
function codeValues(ts, pattern) {
  return new Set([...ts.matchAll(pattern)].map(m => m[1]))
}

function diff(a, b) {
  return [...a].filter(x => !b.has(x)).sort()
}

function compare(label, inCode, found, constraintName) {
  if (!found) {
    return [
      `${constraintName}: не найден ни в одной миграции в ${rel(MIGRATIONS_DIR)}. ` +
        `Без него база примет любое значение, и опечатка в коде дойдёт до боевых данных`,
    ]
  }
  const problems = []
  const onlyCode = diff(inCode, found.values)
  const onlyDb = diff(found.values, inCode)

  if (onlyCode.length > 0) {
    problems.push(
      `${label}: есть в коде, нет в ${constraintName} — ${onlyCode.join(', ')}. ` +
        `Запись с таким значением упадёт PATCH 400, а интерфейс это проглотит. ` +
        `Нужна миграция, переписывающая констрейнт (образец: ${rel(found.file)})`,
    )
  }
  if (onlyDb.length > 0) {
    problems.push(
      `${label}: есть в ${constraintName}, нет в коде — ${onlyDb.join(', ')}. ` +
        `Такие значения не показать и не выбрать: запись с ними станет невидимой в интерфейсе`,
    )
  }
  return problems
}

export function checkStageDictionary() {
  const ts = readSafe(DIRECTIONS_TS)
  if (ts === null) {
    return [`${rel(DIRECTIONS_TS)}: файл не найден — словарь направлений потерян`]
  }

  // Стадии записаны в одну строку: `{ value: 'sourcing', label: ... }`.
  // Пробел после `{` вместо \s принципиален: направления начинаются с `{` и
  // переносом строки, и без этого различения они попадали бы в список стадий.
  const stages = codeValues(ts, /\{ *value:\s*'([a-z_]+)'/g)
  // Отменённая стадия объявлена отдельной константой, а не внутри массива.
  // Привязка к `export const` обязательна: STAGE_CANCELLED упоминается в каждом
  // массиве стадий, и свободный поиск уезжал до следующего направления, принимая
  // его код за стадию.
  const cancelled = ts.match(/export const STAGE_CANCELLED[^=]*=\s*\{\s*value:\s*'([a-z_]+)'/)
  if (cancelled) stages.add(cancelled[1])
  // Направления — объекты верхнего уровня массива DIRECTIONS, `value:` с отступом 4.
  const directions = codeValues(ts, /^ {4}value:\s*'([a-z_]+)'/gm)

  if (stages.size === 0) {
    return [`${rel(DIRECTIONS_TS)}: не удалось прочитать ни одной стадии — проверка бессмысленна, почини разбор`]
  }

  return [
    ...compare('Стадии', stages, latestConstraint('deals_status_check'), 'deals_status_check'),
    ...compare('Направления', directions, latestConstraint('deals_deal_type_check'), 'deals_deal_type_check'),
  ]
}

// ── CLI ──────────────────────────────────────────────────────────────────
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const problems = checkStageDictionary()
  if (problems.length === 0) {
    console.log('✅ словарь стадий и направлений совпадает с CHECK в миграциях')
    process.exit(0)
  }
  console.error('❌ словарь стадий разъехался с базой:\n')
  for (const p of problems) console.error(`  - ${p}`)
  process.exit(1)
}
