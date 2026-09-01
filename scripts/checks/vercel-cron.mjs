/**
 * Крон в vercel.json на тарифе Hobby — не чаще одного запуска в сутки.
 *
 * Почему это отдельная проверка: если выражение чаще, Vercel отвергает
 * конфигурацию при валидации и МОЛЧА отбрасывает весь деплой. В списке
 * деплоев не появляется ни успешного, ни упавшего, журнал активности пуст,
 * CI на GitHub при этом зелёный. 01.09.2026 на диагностику этого ушёл час:
 * три пуша подряд не создали ни одного деплоя.
 *
 * Всё, что нужно чаще суток, живёт в GitHub Actions — образец:
 * .github/workflows/channel-heartbeat.yml, .github/workflows/avito-messenger.yml
 *
 * CLI: node scripts/checks/vercel-cron.mjs
 */

import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { ROOT, readSafe, rel } from './lib.mjs'

const VERCEL_JSON = path.join(ROOT, 'vercel.json')

/**
 * Разрешено только «раз в сутки или реже»: минуты и часы — конкретные числа,
 * без шага, списков и диапазонов. День/месяц/день недели могут быть любыми.
 */
function isDailyOrRarer(schedule) {
  const parts = String(schedule).trim().split(/\s+/)
  if (parts.length !== 5) return false
  const [minute, hour] = parts
  const isFixed = f => /^\d+$/.test(f)
  return isFixed(minute) && isFixed(hour)
}

export function checkVercelCron() {
  const raw = readSafe(VERCEL_JSON)
  if (raw === null) return []

  let cfg
  try {
    cfg = JSON.parse(raw)
  } catch (e) {
    return [`${rel(VERCEL_JSON)}: невалидный JSON (${e.message}) — Vercel молча отбросит деплой`]
  }

  const problems = []
  for (const cron of cfg.crons ?? []) {
    if (!isDailyOrRarer(cron.schedule)) {
      problems.push(
        `${rel(VERCEL_JSON)}: крон "${cron.path}" — расписание "${cron.schedule}" чаще одного раза в сутки. ` +
          `На тарифе Hobby Vercel отвергнет конфигурацию и МОЛЧА отбросит весь деплой (ни успешного, ни упавшего в списке). ` +
          `Перенести в GitHub Actions по образцу .github/workflows/channel-heartbeat.yml`
      )
    }
  }
  return problems
}

// ── CLI ──────────────────────────────────────────────────────────────────
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const problems = checkVercelCron()
  if (problems.length === 0) {
    console.log('✅ vercel.json: кроны не чаще суток')
    process.exit(0)
  }
  console.error('❌ vercel.json:\n')
  for (const p of problems) console.error(`  - ${p}`)
  process.exit(1)
}
