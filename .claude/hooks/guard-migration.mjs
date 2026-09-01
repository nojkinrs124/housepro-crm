#!/usr/bin/env node
/**
 * PreToolUse hook на Supabase MCP `apply_migration`.
 *
 * `guard-sql` закрывает execute_sql, но apply_migration оставался открытым —
 * а это единственный путь в проекте, ведущий к необратимой потере данных.
 * В docs/ROADMAP.md лежал готовый `DROP TABLE clients CASCADE` для фазы 1.7,
 * притом что таблицы живые: сессия, пришедшая в файл грепом, увидела бы SQL
 * без предупреждения из шапки.
 *
 * Блокируются только разрушительные операции над существующими данными.
 * Обычные миграции (CREATE TABLE, ADD COLUMN, CREATE POLICY, CREATE INDEX)
 * проходят свободно — их тут большинство.
 *
 * Escape hatch: строка `-- УДАЛЕНИЕ ПОДТВЕРЖДЕНО` в тексте миграции. Ставить
 * её можно только после явного согласия Руслана на конкретное удаление.
 *
 * Exit code 2 = блокировка, stderr уходит обратно модели.
 */

const DESTRUCTIVE = [
  { re: /\bDROP\s+TABLE\b/i, what: 'DROP TABLE' },
  { re: /\bDROP\s+(MATERIALIZED\s+)?VIEW\b/i, what: 'DROP VIEW' },
  { re: /\bDROP\s+SCHEMA\b/i, what: 'DROP SCHEMA' },
  { re: /\bDROP\s+DATABASE\b/i, what: 'DROP DATABASE' },
  { re: /\bTRUNCATE\b/i, what: 'TRUNCATE' },
  { re: /\bDROP\s+COLUMN\b/i, what: 'DROP COLUMN' },
  { re: /\bDELETE\s+FROM\b(?![\s\S]{0,200}\bWHERE\b)/i, what: 'DELETE FROM без WHERE' },
]

const CONFIRMED_RE = /--\s*УДАЛЕНИЕ\s+ПОДТВЕРЖДЕНО/i

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

  if (CONFIRMED_RE.test(sql)) process.exit(0)

  // строки-комментарии не считаем (кроме маркера подтверждения выше)
  const stripped = sql
    .split('\n')
    .filter(l => !l.trim().startsWith('--'))
    .join('\n')

  const hits = DESTRUCTIVE.filter(({ re }) => re.test(stripped)).map(({ what }) => what)
  if (hits.length === 0) process.exit(0)

  console.error(
    `ЗАБЛОКИРОВАНО: разрушительная миграция (${hits.join(', ')}).\n\n` +
      `Это единственный путь в проекте к необратимой потере боевых данных, поэтому он закрыт.\n` +
      `Отдельно: таблицы \`clients\` и \`owners\` ещё живые — их удаление уронит прод\n` +
      `(модуль src/app/(dashboard)/clients/ и обращения из кода, задача #17 в docs/IMPROVEMENTS.md).\n\n` +
      `Что сделать:\n` +
      `  1. остановиться и спросить Руслана — удаление данных не входит в полномочия агента;\n` +
      `  2. если он подтвердил конкретно это удаление — добавить в текст миграции строку\n` +
      `     \`-- УДАЛЕНИЕ ПОДТВЕРЖДЕНО\` и указать, что именно и с чьего согласия удаляется;\n` +
      `  3. перед удалением таблицы убедиться, что \`grep -rn "from('имя_таблицы')" src/\` пуст.\n\n` +
      `Создание и изменение (CREATE TABLE, ADD COLUMN, CREATE POLICY, CREATE INDEX) не блокируется.`
  )
  process.exit(2)
})
