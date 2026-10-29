---
name: housepro-migration
description: "Схема Supabase HousePro: миграции, RLS, типы, PostgREST"
version: 2.0.0
author: HousePro
license: MIT
platforms: [linux, macos]
metadata:
  hermes:
    tags: [housepro, supabase, migration, rls]
    related_skills: [housepro-release, housepro-local-testing]
---
# Изменение схемы Supabase

## When to Use

- Меняется схема БД: новая таблица, колонка, индекс, enum, функция.
- Нужны RLS-политики или проверка изоляции организаций.
- PostgREST не отдаёт join, или типы разошлись со схемой.


Проект: `zwclvcswvhjeqwxrkbte`. Прямые HTTP-запросы к `api.supabase.com` не делаем — только
коннектор Supabase в Hermes (`connectors__supabase__*`); если его нет в сессии, сказать владельцу,
а не поднимать MCP руками.

## Порядок

1. **Сверить реальную схему** — `LIST_TABLES` через MCP. Не полагаться на память и не на
   списки в документации: они отстают.
2. **Применить миграцию** — инструмент `apply_migration` с осмысленным именем
   (`add_org_id_to_showings`, не `migration_1`).
   `execute_sql` для DDL **заблокирован хуком** `scripts/agent-hooks/guard-sql.mjs` —
   он остаётся только для SELECT и разовых проверок данных.
3. **Закоммитить файл миграции** в `supabase/migrations/` вместе с кодом, в том же пуше.
   Отложенный коммит миграции — как раз то, из-за чего схема расходится с репозиторием.
4. **Обновить типы — обязательно, в том же пуше.** Результат кладётся в
   `src/types/supabase.ts` (файл сгенерированный, руками не править).
   - из сессии — MCP `GENERATE_TYPESCRIPT_TYPES`: ответ приходит как
     `{"types": "..."}`, распаковать и записать в файл;
   - Руслану со своей машины — `npm run db:types`.

   `npx supabase gen types` требует сетевого доступа к `api.supabase.com` и
   `SUPABASE_ACCESS_TOKEN`; при недоступности — MCP-инструмент.

   Разошедшиеся типы — не косметика: 02.09.2026 генерация сразу вскрыла три
   поломки, которые `tsc` и `next build` не видели (задачи 8 и 19 в
   `docs/IMPROVEMENTS.md`).

## Шаблон миграции

```sql
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS new_field text;
CREATE INDEX IF NOT EXISTS idx_contacts_new_field ON contacts(new_field);
```

Всё, что может выполниться дважды, — с `IF NOT EXISTS`.

## RLS-политики

Обязательно в `DO`-блоке, иначе повторный прогон падает на «policy already exists»:

```sql
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'org members can view contacts' AND tablename = 'contacts'
  ) THEN
    CREATE POLICY "org members can view contacts" ON contacts FOR SELECT TO authenticated
      USING (organization_id = get_user_org_id());
  END IF;
END $$;
```

Правила:
- изоляция арендаторов — **через `get_user_org_id()`**, а не сабквери к той же таблице
  (сабквери к своей же таблице внутри её политики даёт рекурсию);
- роль всегда `authenticated`, никогда `public`;
- новая таблица → `ENABLE ROW LEVEL SECURITY` + четыре политики (select/insert/update/delete)
  + индекс на `organization_id`.

## PostgREST — join с одной таблицей через несколько FK

```ts
// ❌ неоднозначно, если два FK на contacts
supabase.from('deals').select('*, contacts(*)')

// ✅ явные hint'ы
supabase.from('deals').select(`
  *,
  client:contacts!deals_client_contact_id_fkey(id, full_name, phone),
  owner:contacts!deals_owner_contact_id_fkey(id, full_name, phone)
`)
```

Ошибка «Could not embed…» — это всегда про отсутствующий hint.

## Клиенты Supabase

```ts
// Server Component / Server Action
import { createClient } from '@/lib/supabase/server'
const supabase = await createClient()          // ← await обязателен

// Client Component
import { createClient } from '@/lib/supabase/client'
const supabase = createClient()                // ← без await

// API route
import { getSupabaseAdmin } from '@/lib/supabase/admin'
// лениво ВНУТРИ хендлера, с no-store; не копировать инстанциацию в очередной файл —
// если паттерн повторяется, выносить в общий withOrgAuth()/withApiKeyAuth()
```

Новый GET-route с данными по организации → обязательно `export const dynamic = 'force-dynamic'`.

## Legacy-таблицы

`clients` и `owners` больше не существуют — удалены 02.09.2026, для клиентов и
собственников используется только `contacts` (поле `role`: `client | owner | both`).
Ссылочные колонки `client_id`/`owner_id` в `deals`/`contracts`/`tasks` тоже удалены
(16.09.2026). `LIST_TABLES` — источник истины по актуальной схеме.
