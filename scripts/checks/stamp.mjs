/**
 * Отпечаток состояния кода — чтобы hook на `git push` знал, что `npm run check`
 * гонялся именно на этом коде, а не «когда-то раньше».
 *
 * Отпечаток считается по СОДЕРЖИМОМУ файлов, а не по git HEAD: между проверкой
 * и пушем всегда есть `git commit`, который меняет HEAD, но не меняет файлы.
 * Поэтому digest переживает коммит и ломается ровно тогда, когда код правили
 * после проверки — то есть когда перепроверка действительно нужна.
 */

import { createHash } from 'node:crypto'
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { ROOT, walk, readSafe } from './lib.mjs'

const STAMP_PATH = path.join(ROOT, '.claude', '.check-stamp.json')

const ROOT_FILES = [
  'package.json',
  'package-lock.json',
  'middleware.ts',
  'next.config.ts',
  'tsconfig.json',
  'vercel.json',
]

export function computeDigest() {
  const files = [
    ...walk(path.join(ROOT, 'src'), ['.ts', '.tsx', '.css']),
    ...walk(path.join(ROOT, 'scripts'), ['.mjs', '.js']),
    ...ROOT_FILES.map(f => path.join(ROOT, f)).filter(existsSync),
  ].sort()

  const h = createHash('sha256')
  for (const f of files) {
    const content = readSafe(f)
    if (content === null) continue
    h.update(path.relative(ROOT, f))
    h.update('\0')
    h.update(content)
    h.update('\0')
  }
  return h.digest('hex')
}

export function writeStamp() {
  mkdirSync(path.dirname(STAMP_PATH), { recursive: true })
  const stamp = { digest: computeDigest(), at: new Date().toISOString() }
  writeFileSync(STAMP_PATH, JSON.stringify(stamp, null, 2) + '\n')
  return stamp
}

export function readStamp() {
  if (!existsSync(STAMP_PATH)) return null
  try {
    return JSON.parse(readFileSync(STAMP_PATH, 'utf8'))
  } catch {
    return null
  }
}

/** @returns {{ ok: boolean, reason?: string }} */
export function verifyStamp() {
  const stamp = readStamp()
  if (!stamp) return { ok: false, reason: '`npm run check` в этом чекауте ещё ни разу не проходил' }
  if (stamp.digest !== computeDigest()) {
    return { ok: false, reason: `код менялся после последней зелёной проверки (она была ${stamp.at})` }
  }
  return { ok: true }
}
