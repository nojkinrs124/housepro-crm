#!/usr/bin/env node
/**
 * Stop hook — напоминание про README.md, когда в диффе появился новый модуль
 * или интеграция, а README не тронут.
 *
 * Правило Руслана: при значимых изменениях (новый модуль, заметная фича)
 * README обновляется в том же коммите, а не «потом» — README первое, что
 * видит человек в репозитории. Мелкие багфиксы под это не подпадают, поэтому
 * триггер узкий: только появление НОВОГО каталога-модуля.
 *
 * Срабатывает один раз за остановку (stop_hook_active), зациклить не может.
 */

import { execFileSync } from 'node:child_process'

let input = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', c => (input += c))
process.stdin.on('end', () => {
  let payload
  try {
    payload = JSON.parse(input)
  } catch {
    process.exit(0)
  }

  // уже напоминали в этой остановке — не зацикливаться
  if (payload?.stop_hook_active) process.exit(0)

  if (payload?.cwd) {
    try {
      process.chdir(payload.cwd)
    } catch {}
  }

  let changed = ''
  try {
    changed = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' })
  } catch {
    process.exit(0)
  }

  const files = changed
    .split('\n')
    .filter(Boolean)
    .map(l => l.slice(3).trim())

  if (files.length === 0) process.exit(0)
  if (files.some(f => f === 'README.md')) process.exit(0)

  // новый модуль = новый каталог внутри (dashboard)/ или api/
  const newModules = new Set()
  for (const f of files) {
    const m =
      f.match(/^src\/app\/\(dashboard\)\/([^/]+)\//) ??
      f.match(/^src\/app\/api\/([^/]+)\//) ??
      f.match(/^src\/features\/([^/]+)\//)
    if (m) newModules.add(m[1])
  }

  if (newModules.size === 0) process.exit(0)

  console.error(
    `README.md не обновлён, а в правках затронуты модули: ${[...newModules].join(', ')}.\n\n` +
      `Если появился новый модуль/заметная фича — обновить таблицу «Возможности» и вступление ` +
      `в README.md тем же коммитом (для мелких багфиксов не нужно — тогда просто продолжай).`
  )
  process.exit(2)
})
