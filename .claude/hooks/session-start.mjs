#!/usr/bin/env node
/**
 * SessionStart hook — три строки состояния вместо требования
 * «в каждой сессии читать docs/IMPROVEMENTS.md» (19 KB).
 *
 * Печатает: ветку, незакоммиченное, статус последней проверки и верхние
 * открытые пункты бэклога. Всё остальное — по запросу.
 */

import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()

function git(args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8', cwd: ROOT }).trim()
  } catch {
    return ''
  }
}

const out = []

// ── Ветка и рабочее дерево ───────────────────────────────────────────────
const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'])
const dirty = git(['status', '--porcelain']).split('\n').filter(Boolean)
const lastCommit = git(['log', '--oneline', '-1'])

out.push(`Ветка: ${branch || '?'} · ${lastCommit || 'нет коммитов'}`)
out.push(
  dirty.length === 0
    ? 'Рабочее дерево чистое.'
    : `Незакоммичено: ${dirty.length} файл(ов) — ${dirty.slice(0, 5).map(l => l.slice(3)).join(', ')}${dirty.length > 5 ? ', …' : ''}`
)

// ── Статус последней проверки ────────────────────────────────────────────
try {
  const { verifyStamp } = await import('../../scripts/checks/stamp.mjs')
  const { ok, reason } = verifyStamp()
  out.push(ok ? '`npm run check`: зелёный на текущем коде — пуш разрешён.' : `Пуш заблокирован: ${reason}.`)
} catch {}

// ── Открытые пункты бэклога ──────────────────────────────────────────────
const improvements = path.join(ROOT, 'docs', 'IMPROVEMENTS.md')
if (existsSync(improvements)) {
  try {
    const rows = readFileSync(improvements, 'utf8')
      .split('\n')
      .filter(l => /^\|\s*\d+\s*\|/.test(l))
      .filter(l => !l.includes('~~') && !l.includes('✅'))
      .map(l => {
        const cells = l.split('|').map(c => c.trim())
        return `#${cells[1]} ${cells[2]} (${cells[3]})`
      })
    if (rows.length) {
      out.push(`Открыто в docs/IMPROVEMENTS.md (${rows.length}): ${rows.slice(0, 4).join('; ')}${rows.length > 4 ? '; …' : ''}`)
    }
  } catch {}
}

out.push('Правила: CLAUDE.md · процедуры: skills housepro-* · жёсткие запреты: .claude/hooks/')

console.log(out.join('\n'))
