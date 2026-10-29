#!/usr/bin/env node
/**
 * Hermes pre_tool_call — Supabase `execute_sql` / `EXECUTE_SQL`.
 *
 * Правило проекта: любое изменение схемы — только через `apply_migration`,
 * иначе изменение не попадает в supabase/migrations/ и боевая схема расходится
 * с репозиторием. Здесь ловится DDL, пришедший через свободный SQL-инструмент.
 *
 * Вне репозитория CRM — no-op (хук глобальный).
 */

import { findRepoRoot, block, noop, readPayload } from './lib-hook.mjs'

const DDL_RE =
  /\b(CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE|COMMENT\s+ON)\s+(TABLE|INDEX|POLICY|FUNCTION|TRIGGER|VIEW|MATERIALIZED|SCHEMA|TYPE|EXTENSION|SEQUENCE|COLUMN|PUBLICATION|ROLE|DATABASE)\b/i

const DDL_LOOSE_RE = /\b(CREATE\s+OR\s+REPLACE|ENABLE\s+ROW\s+LEVEL\s+SECURITY|DROP\s+POLICY)\b/i

const payload = readPayload()
if (!payload) noop()

const ti = payload?.tool_input ?? {}
const sql = ti.query ?? ti.sql ?? ti.statement ?? ''
if (typeof sql !== 'string' || !sql) noop()

if (!findRepoRoot(payload)) noop()

const stripped = sql
  .split('\n')
  .filter(l => !l.trim().startsWith('--'))
  .join('\n')

if (DDL_RE.test(stripped) || DDL_LOOSE_RE.test(stripped)) {
  block(
    `ЗАБЛОКИРОВАНО: DDL через execute_sql.\n\n` +
      `Любое изменение схемы в этом проекте идёт только через APPLY_A_MIGRATION — иначе изменение ` +
      `не попадает в supabase/migrations/ и боевая схема расходится с репозиторием.\n\n` +
      `Что сделать:\n` +
      `  1. вызвать APPLY_A_MIGRATION с осмысленным именем (add_org_id_to_showings, а не migration_1);\n` +
      `  2. RLS-политики обернуть в DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies ...) THEN ... END $$;\n` +
      `  3. закоммитить файл миграции вместе с кодом, в том же пуше;\n` +
      `  4. перегенерировать типы (GENERATE_TYPESCRIPT_TYPES → src/types/supabase.ts).\n\n` +
      `execute_sql / RUN_READ_ONLY_QUERY остаются для SELECT и разовых проверок данных.`
  )
}

noop()
