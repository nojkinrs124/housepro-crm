/**
 * Общие утилиты для проверок из scripts/checks/*.
 * Используются и в `npm run check` (pre-push-check.mjs), и в hooks Claude Code
 * (.claude/hooks/*), поэтому здесь не должно быть ничего, что печатает в stdout.
 */

import { readdirSync, statSync, readFileSync } from 'node:fs'
import path from 'node:path'

export const ROOT = process.cwd()

/** Рекурсивный обход каталога с фильтром по расширениям. */
export function walk(dir, exts, exclude = ['node_modules', '.next', '.claude']) {
  const out = []
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const entry of entries) {
    if (exclude.includes(entry)) continue
    const full = path.join(dir, entry)
    let st
    try {
      st = statSync(full)
    } catch {
      continue
    }
    if (st.isDirectory()) out.push(...walk(full, exts, exclude))
    else if (exts.some(e => entry.endsWith(e))) out.push(full)
  }
  return out
}

/** Файл помечен 'use client' первой строкой? */
export function isClientFile(content) {
  const first = content.split('\n')[0].trim()
  return first === "'use client'" || first === '"use client"'
}

export function readSafe(file) {
  try {
    return readFileSync(file, 'utf8')
  } catch {
    return null
  }
}

export const rel = f => path.relative(ROOT, f)
