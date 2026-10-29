/**
 * Общие утилиты для хуков Hermes (scripts/agent-hooks/*).
 *
 * Формат входа (stdin, JSON) — от Hermes shell-hooks:
 *   { hook_event_name, tool_name, tool_input, session_id, cwd, extra }
 *   tool_input.command — для terminal, tool_input.path — для write_file/patch,
 *   tool_input.query — для инструментов миграций;
 *   extra.changed_paths — для pre_verify.
 *
 * ВАЖНО: exit code Hermes игнорирует. Блокировка — только JSON в stdout:
 *   {"decision":"block","reason":"..."}   (pre_tool_call)
 *   {"action":"continue","message":"..."} (pre_verify)
 * Всё остальное = хук ничего не сделал.
 *
 * cwd в payload — каталог процесса Hermes, а не репозитория: корень ищем сами и
 * вне репозитория CRM хук обязан быть no-op (он подключён глобально в config.yaml).
 */

import { readFileSync, existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

export function readPayload() {
  try {
    const raw = readFileSync(0, 'utf8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/** Признак корня именно этого репозитория. */
function isRepoRoot(dir) {
  try {
    if (!statSync(path.join(dir, 'package.json')).isFile()) return false
    if (!statSync(path.join(dir, 'src')).isDirectory()) return false
    if (!statSync(path.join(dir, 'scripts', 'checks')).isDirectory()) return false
    const pkg = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8'))
    return typeof pkg.name === 'string'
  } catch {
    return false
  }
}

function upward(from) {
  let dir = path.resolve(from)
  for (let i = 0; i < 8; i++) {
    if (isRepoRoot(dir)) return dir
    const parent = path.dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
  return null
}

/** Путь, упомянутый в команде: `cd /x/y && ...` или первое абсолютное вхождение. */
function pathsFromCommand(command) {
  const out = []
  const cd = /(?:^|[;&|]\s*)cd\s+("([^"]+)"|'([^']+)'|([^\s;&|]+))/.exec(command)
  if (cd) out.push(cd[2] || cd[3] || cd[4])
  const abs = command.match(/(?:^|[\s='"])(\/[\w./@+-]+)/)
  if (abs) out.push(abs[1])
  return out.filter(Boolean)
}

/**
 * Корень репозитория HousePro или null.
 * @param {object} payload
 * @returns {string|null}
 */
export function findRepoRoot(payload) {
  const hints = []
  const ti = payload?.tool_input ?? {}
  if (typeof ti.path === 'string') hints.push(ti.path)
  if (typeof ti.command === 'string') hints.push(...pathsFromCommand(ti.command))
  if (typeof payload?.cwd === 'string' && payload.cwd) hints.push(payload.cwd)

  for (const hint of hints) {
    const found = upward(path.isAbsolute(hint) ? hint : path.join(payload?.cwd || process.cwd(), hint))
    if (found) return found
  }
  // Последняя попытка: сам процесс (полезно в pre_verify, где путей может не быть).
  return upward(process.cwd())
}

/** Текущая ветка репозитория. */
export function git(repo, args) {
  try {
    return execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim()
  } catch {
    return ''
  }
}

export function block(message) {
  process.stdout.write(JSON.stringify({ decision: 'block', reason: message }))
  process.exit(0)
}

export function continueWith(message) {
  process.stdout.write(JSON.stringify({ action: 'continue', message }))
  process.exit(0)
}

export function noop() {
  process.exit(0)
}

/** Относительный путь внутри репозитория или null, если файл вне его. */
export function relToRepo(repo, file) {
  const abs = path.isAbsolute(file) ? file : path.resolve(repo, file)
  const rel = path.relative(repo, abs)
  return rel.startsWith('..') ? null : rel
}

export { existsSync, path }
