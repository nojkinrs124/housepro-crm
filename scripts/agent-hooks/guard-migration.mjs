#!/usr/bin/env node
/**
 * Hermes pre_tool_call — Supabase `apply_migration`.
 *
 * guard-sql закрывает свободный SQL, но apply_migration — единственный штатный
 * путь, а значит и единственный путь к необратимой потере боевых данных.
 * Блокируются только разрушительные операции; CREATE TABLE / ADD COLUMN /
 * CREATE POLICY / CREATE INDEX проходят свободно — их тут большинство.
 *
 * Escape hatch: строка `-- УДАЛЕНИЕ ПОДТВЕРЖДЕНО` в тексте миграции. Ставить
 * только после явного согласия владельца на конкретное удаление.
 *
 * Вне репозитория CRM — no-op.
 */

import { findRepoRoot, block, noop, readPayload } from './lib-hook.mjs'

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

const payload = readPayload()
if (!payload) noop()

const ti = payload?.tool_input ?? {}
const sql = ti.query ?? ti.sql ?? ''
if (typeof sql !== 'string' || !sql) noop()

if (!findRepoRoot(payload)) noop()
if (CONFIRMED_RE.test(sql)) noop()

const stripped = sql
  .split('\n')
  .filter(l => !l.trim().startsWith('--'))
  .join('\n')

const hits = DESTRUCTIVE.filter(({ re }) => re.test(stripped)).map(({ what }) => what)
if (hits.length === 0) noop()

block(
  `ЗАБЛОКИРОВАНО: разрушительная миграция (${hits.join(', ')}).\n\n` +
    `Это единственный путь в проекте к необратимой потере боевых данных, поэтому он закрыт.\n\n` +
    `Что сделать:\n` +
    `  1. остановиться и спросить Руслана — удаление данных не входит в полномочия агента;\n` +
    `  2. если он подтвердил конкретно это удаление — добавить в текст миграции строку\n` +
    `     \`-- УДАЛЕНИЕ ПОДТВЕРЖДЕНО\` и указать, что именно и с чьего согласия удаляется;\n` +
    `  3. перед удалением таблицы убедиться, что \`grep -rn "from('имя_таблицы')" src/\` пуст;\n` +
    `  4. выгрузить удаляемые строки в docs/JOURNAL.md + локальный бэкап строк (не в публичный репозиторий).\n\n` +
    `Создание и изменение (CREATE TABLE, ADD COLUMN, CREATE POLICY, CREATE INDEX) не блокируется.`
)
