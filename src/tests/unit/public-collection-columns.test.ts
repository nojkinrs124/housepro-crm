import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Публичная подборка читает properties анонимно. Колонки, которые она выбирает,
 * обязаны быть в гранте anon, иначе PostgREST отклоняет весь запрос и страница
 * падает с 500 (QA 28.10.2026, D-12). Тест сверяет select страницы с суммой
 * колоночных грантов из миграций.
 */
const root = process.cwd()

function anonGrantedColumns(): Set<string> {
  const dir = join(root, 'supabase/migrations')
  const cols = new Set<string>()
  for (const file of readdirSync(dir).sort()) {
    const sql = readFileSync(join(dir, file), 'utf8').replace(/--.*$/gm, '')
    const re = /grant\s+select\s*\(([^)]*)\)\s*on\s+public\.properties\s+to\s+anon/gi
    for (const m of sql.matchAll(re)) {
      for (const c of m[1].split(',')) cols.add(c.trim())
    }
  }
  return cols
}

function collectionPageColumns(): string[] {
  const src = readFileSync(join(root, 'src/app/c/[token]/page.tsx'), 'utf8')
  const m = src.match(/property:properties\(([^)]*)\)/)
  if (!m) throw new Error('select properties(...) не найден на странице подборки')
  return m[1].split(',').map(c => c.trim()).filter(Boolean)
}

describe('публичная подборка /c/[token]', () => {
  it('выбирает из properties только колонки, выданные anon', () => {
    const granted = anonGrantedColumns()
    const missing = collectionPageColumns().filter(c => !granted.has(c))
    expect(missing).toEqual([])
  })
})
