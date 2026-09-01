#!/usr/bin/env node
/**
 * PreToolUse hook на Supabase MCP `execute_sql`.
 *
 * Правило проекта: любое изменение схемы — только через `apply_migration`,
 * никогда через `execute_sql`. Иначе изменение не попадает в
 * supabase/migrations/, и боевая схема расходится с репозиторием.
 *
 * Раньше это была строка «ВСЕГДА использовать apply_migration» в CLAUDE.md.
 * Теперь DDL через execute_sql просто не выполнится.
 *
 * Exit code 2 = блокировка.
 */

const DDL_RE =
  /\b(CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE|COMMENT\s+ON)\s+(TABLE|INDEX|POLICY|FUNCTION|TRIGGER|VIEW|MATERIALIZED|SCHEMA|TYPE|EXTENSION|SEQUENCE|COLUMN|PUBLICATION|ROLE|DATABASE)\b/i

// `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`, `CREATE OR REPLACE FUNCTION` и т.п.
const DDL_LOOSE_RE = /\b(CREATE\s+OR\s+REPLACE|ENABLE\s+ROW\s+LEVEL\s+SECURITY|DROP\s+POLICY)\b/i

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

  const sql = payload?.tool_input?.query ?? payload?.tool_input?.sql ?? ''
  if (!sql) process.exit(0)

  // строки-комментарии не считаем
  const stripped = sql
    .split('\n')
    .filter(l => !l.trim().startsWith('--'))
    .join('\n')

  if (DDL_RE.test(stripped) || DDL_LOOSE_RE.test(stripped)) {
    console.error(
      `ЗАБЛОКИРОВАНО: DDL через execute_sql.\n\n` +
        `Любое изменение схемы в этом проекте идёт только через apply_migration — иначе\n` +
        `изменение не попадает в supabase/migrations/ и боевая схема расходится с репозиторием.\n\n` +
        `Что сделать:\n` +
        `  1. вызвать apply_migration с осмысленным именем (add_org_id_to_showings, а не migration_1);\n` +
        `  2. RLS-политики обернуть в DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies ...) THEN ... END $$;\n` +
        `  3. закоммитить файл миграции вместе с кодом, в том же пуше.\n\n` +
        `execute_sql остаётся для SELECT и разовых проверок данных.`
    )
    process.exit(2)
  }

  process.exit(0)
})
