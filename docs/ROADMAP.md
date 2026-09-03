# HousePro CRM — SaaS Roadmap

> Вынесено из `CLAUDE.md` 02.09.2026: 1265 строк готовых миграций и кода занимали
> половину файла правил и грузились в контекст каждой сессии, хотя описывают
> в основном **уже сделанное**.
>
> ## ⚠️ Как этим пользоваться
>
> **Статус фазы сверять с кодом, а не с текстом ниже.** На 02.09.2026 по факту:
>
> | Пункт | Реальность |
> |---|---|
> | 0.1 Генерация типов Supabase | ✅ сделано 02.09.2026 — `src/types/supabase.ts` (53 таблицы), `npm run db:types`, хелперы `Row`/`Insert`/`Update` |
> | 0.2 `middleware.ts` | ✅ есть в корне (`PUBLIC_PREFIXES`, `/` — публичный сайт) |
> | 0.3 Upstash Redis | ✅ подключён; **код отличается от текста ниже** — в `src/lib/rate-limit.ts` есть fallback на in-memory для локали и CI, «полная замена файла» из инструкции этот fallback уберёт |
> | 0.4 GitHub Actions CI | ✅ `.github/workflows/ci.yml` + ещё 4 workflow |
> | 1.x Multi-tenant | ✅ `src/lib/org.ts`, `organization_id` в таблицах, RLS через `get_user_org_id()` |
> | 1.7 Удаление legacy `clients`/`owners` | ⛔ **НЕ ВЫПОЛНЯТЬ** — таблицы ещё используются, см. ниже |
> | 2.x Audit / permissions | ✅ `src/lib/audit.ts`, `src/lib/permissions.ts` |
> | 3.1 Показы | ✅ `/showings` |
> | 3.2 Подборки | ✅ `/collections` + публичные страницы |
> | 3.3 Email | ⚠️ реализовано иначе — не `src/lib/email.ts`, а провайдеры с автовыбором (см. `docs/INTEGRATIONS.md`) |
> | 4.1 Stripe | ❌ удалено 04.09.2026 — подписку сделают заново при масштабировании |
> | 4.2 Onboarding | ✅ визард есть — `src/app/onboarding/page.tsx` + `OnboardingWizard.tsx`, 5 шагов (запись в таблице отставала) |
> | 4.3 PWA | ✅ `public/manifest.json` |
> | 5.1 Public API | ✅ `src/lib/api-auth.ts`, `/api/v1` |
> | 5.2 Webhooks | ✅ `src/lib/webhooks.ts` |
>
> ### ⛔ Про пункт 1.7 (DROP legacy-таблиц)
>
> Готовый `DROP TABLE clients CASCADE` ниже **уронит прод**: таблицы ещё живые, на
> 02.09.2026 к ним три обращения плюс целый модуль:
>
> - `src/app/(dashboard)/contracts/page.tsx:56`
> - `src/app/(dashboard)/employees/[id]/page.tsx:35`
> - `src/features/clients/actions/clients.actions.ts:19`
> - `src/app/(dashboard)/clients/` — модуль целиком
>
> Сначала мигрировать эти места на `contacts`, только потом DROP. Задача заведена
> в `docs/IMPROVEMENTS.md`.
>
> ### Правило порядка фаз
>
> Phase 0 → 1 → 2 → 3 → 4 → 5. После Phase 4 можно принимать платящих клиентов,
> Phase 5 выполнять параллельно.

---

## 🚀 SAAS TRANSFORMATION ROADMAP

> **Цель**: трансформировать single-tenant CRM в полноценный SaaS-продукт.  
> После выполнения всех фаз останется только ценообразование и продажа.  
> **Порядок фаз нарушать НЕЛЬЗЯ** — каждая фаза является фундаментом для следующей.

---

### Общая карта фаз

| Фаза | Что делаем | Срок | Результат |
|------|-----------|------|-----------|
| **Phase 0** | Preflight: типы, middleware, Redis, CI | 1–2 дня | Критические баги prod устранены |
| **Phase 1** | Multi-tenant: org_id, RLS, JWT | 3–4 нед. | Данные агентств изолированы |
| **Phase 2** | Security: Audit log, версионирование, permissions | 1–2 нед. | Compliance-ready |
| **Phase 3** | PropTech: показы, подборки, email, KPI | 3–4 нед. | Конкурентный продукт |
| **Phase 4** | SaaS core: onboarding, PWA (подписка отложена до масштабирования) | 4–6 нед. | Можно подключать агентства |
| **Phase 5** | API & интеграции | 4–6 нед. | Enterprise-ready |

---

## PHASE 0 — Preflight (1–2 дня)

Исправляем критические production-баги без архитектурных изменений.

### 0.1 Генерация реальных Supabase типов — ✅ СДЕЛАНО 02.09.2026

> Инструкция ниже оставлена как история. Заглушки `Database = any` больше нет,
> файл `src/types/supabase.ts` существует, скрипт `npm run db:types` добавлен.
> **Не выполнять заново** — перегенерация после миграции описана в skill
> `housepro-migration`.

**Проблема (была):** `export type Database = any` в `src/types/database.ts` — убивает всю типобезопасность.

```bash
# Установить CLI
npm install -g supabase --legacy-peer-deps

# Добавить в .env.local:
# SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Сгенерировать типы
npx supabase gen types typescript \
  --project-id zwclvcswvhjeqwxrkbte \
  --schema public \
  > src/types/supabase.ts

# Добавить скрипт в package.json:
# "db:types": "supabase gen types typescript --project-id zwclvcswvhjeqwxrkbte --schema public > src/types/supabase.ts"
```

```ts
// src/types/database.ts — ЗАМЕНИТЬ строку: export type Database = any
// НА:
export type { Database } from './supabase'
```

**После каждой миграции БД:** `npm run db:types`

---

### 0.2 middleware.ts — централизованная защита роутов

**Проблема:** Нет файла `middleware.ts`. Любой новый `page.tsx` без проверки auth — публично доступен.

```ts
// middleware.ts — создать в КОРНЕ проекта (рядом с package.json)
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PATHS = [
  '/login',
  '/auth/callback',
  '/auth/reset-password',
  '/api/public',
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/stripe|api/export).*)',
  ],
}
```

---

### 0.3 Upstash Redis — production-grade rate limiting

**Проблема:** In-memory rate limiter сбрасывается при каждом cold start на Vercel. В production не работает.

```bash
npm install @upstash/redis @upstash/ratelimit --legacy-peer-deps
```

```env
# .env.local + Vercel Dashboard → Environment Variables
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token_here
```

```ts
// src/lib/rate-limit.ts — ПОЛНАЯ ЗАМЕНА файла
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url:   process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const mutationLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, '1 m'),
  prefix: 'rl:mutation',
})

const createLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 m'),
  prefix: 'rl:create',
})

export interface RateLimitResult {
  success: boolean
  remaining: number
  resetAt: number
}

export async function rateLimitMutation(userId: string, action: string): Promise<RateLimitResult> {
  const { success, remaining, reset } = await mutationLimiter.limit(`${userId}:${action}`)
  return { success, remaining, resetAt: reset }
}

export async function rateLimitCreate(userId: string, entity: string): Promise<RateLimitResult> {
  const { success, remaining, reset } = await createLimiter.limit(`${userId}:${entity}`)
  return { success, remaining, resetAt: reset }
}

export async function rateLimitSearch(userId: string): Promise<RateLimitResult> {
  return rateLimitMutation(userId, 'search')
}
```

> ⚠️ **Важно:** функции теперь async. Обновить все call sites:  
> `const rl = rateLimitCreate(...)` → `const rl = await rateLimitCreate(...)`  
> Найти все: `grep -rn "rateLimitCreate\|rateLimitMutation\|rateLimitSearch" src/`

Добавить в `src/lib/env.ts`:
```ts
upstashRedisUrl:   requireEnv('UPSTASH_REDIS_REST_URL'),
upstashRedisToken: requireEnv('UPSTASH_REDIS_REST_TOKEN'),
```

---

### 0.4 GitHub Actions CI Pipeline

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci --legacy-peer-deps

      - name: Type check
        run: npx tsc --noEmit

      - name: Run tests
        run: npm test
        env:
          NEXT_PUBLIC_SUPABASE_URL: 'https://placeholder.supabase.co'
          NEXT_PUBLIC_SUPABASE_ANON_KEY: 'placeholder'

      - name: Build
        run: npm run build
        env:
          NEXT_PUBLIC_SUPABASE_URL: 'https://placeholder.supabase.co'
          NEXT_PUBLIC_SUPABASE_ANON_KEY: 'placeholder'
          UPSTASH_REDIS_REST_URL: 'https://placeholder.upstash.io'
          UPSTASH_REDIS_REST_TOKEN: 'placeholder'
```

### ✅ Чеклист Phase 0

- [ ] `src/types/supabase.ts` сгенерирован, `Database = any` убран
- [ ] `middleware.ts` в корне проекта
- [ ] Upstash Redis создан, env переменные добавлены в .env.local и Vercel
- [ ] `rate-limit.ts` заменён, все call sites обновлены с `await`
- [ ] `.github/workflows/ci.yml` создан, первый run зелёный
- [ ] `npm test` + `npm run build` — зелёные
- [ ] git commit + git push

---

## PHASE 1 — Multi-tenant Foundation (3–4 недели)

**Самая важная фаза.** Без неё продать продукт второму агентству невозможно.

### 1.1 Таблицы organizations и organization_members

Применить через **Supabase:apply_migration** с именем `create_organizations`:

```sql
CREATE TABLE IF NOT EXISTS organizations (
  id                     uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  name                   text    NOT NULL,
  slug                   text    UNIQUE NOT NULL,
  plan                   text    NOT NULL DEFAULT 'free'
                                 CHECK (plan IN ('free', 'pro', 'enterprise')),
  stripe_customer_id     text,
  stripe_subscription_id text,
  subscription_status    text    DEFAULT 'inactive',
  trial_ends_at          timestamptz,
  is_active              boolean NOT NULL DEFAULT true,
  created_at             timestamptz DEFAULT now(),
  updated_at             timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS organization_members (
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role            text NOT NULL DEFAULT 'agent'
                       CHECK (role IN ('admin', 'manager', 'agent', 'accountant')),
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz DEFAULT now(),
  PRIMARY KEY (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_organizations_slug  ON organizations(slug);

ALTER TABLE organizations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE policyname = 'Members can view their org' AND tablename = 'organizations') THEN
    CREATE POLICY "Members can view their org" ON organizations FOR SELECT TO authenticated
      USING (id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid() AND is_active = true
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE policyname = 'Members can view org membership' AND tablename = 'organization_members') THEN
    CREATE POLICY "Members can view org membership" ON organization_members FOR SELECT TO authenticated
      USING (organization_id IN (
        SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
      ));
  END IF;
END $$;
```

Применить через **Supabase:apply_migration** с именем `create_org_helper_function`:

```sql
-- Helper: получить org_id текущего пользователя (используется во всех RLS)
CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT organization_id
  FROM organization_members
  WHERE user_id = auth.uid() AND is_active = true
  LIMIT 1
$$;
```

---

### 1.2 Миграция: добавить org_id на все таблицы

Применить через **Supabase:apply_migration** с именем `add_org_id_to_all_tables`:

```sql
-- Шаг 1: организация по умолчанию для существующих данных
INSERT INTO organizations (id, name, slug, plan) VALUES (
  '00000000-0000-0000-0000-000000000001', 'HousePro', 'housepro', 'pro'
) ON CONFLICT (slug) DO NOTHING;

-- Шаг 2: существующие users → organization_members
INSERT INTO organization_members (organization_id, user_id, role)
SELECT '00000000-0000-0000-0000-000000000001', u.id, u.role
FROM users u
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- Шаг 3: добавить org_id (nullable сначала)
ALTER TABLE contacts   ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id);
ALTER TABLE leads      ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id);
ALTER TABLE deals      ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id);
ALTER TABLE contracts  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id);
ALTER TABLE payments   ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id);
ALTER TABLE tasks      ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id);
ALTER TABLE files      ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id);
ALTER TABLE users      ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id);
ALTER TABLE notifications             ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id);
ALTER TABLE accounting_transactions   ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id);
ALTER TABLE accounting_categories     ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id);
ALTER TABLE accounting_recurring_rules ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id);
ALTER TABLE company_settings          ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id);
ALTER TABLE document_templates        ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id);

-- Шаг 4: заполнить org_id для существующих данных
UPDATE contacts   SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE leads      SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE deals      SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE properties SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE contracts  SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE payments   SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE tasks      SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE files      SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE users      SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE notifications             SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE accounting_transactions   SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE accounting_categories     SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE accounting_recurring_rules SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE company_settings          SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE document_templates        SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;

-- Шаг 5: NOT NULL constraint
ALTER TABLE contacts   ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE leads      ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE deals      ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE properties ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE contracts  ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE tasks      ALTER COLUMN organization_id SET NOT NULL;

-- Шаг 6: индексы (КРИТИЧНО для производительности)
CREATE INDEX IF NOT EXISTS idx_contacts_org_id    ON contacts(organization_id);
CREATE INDEX IF NOT EXISTS idx_leads_org_id       ON leads(organization_id);
CREATE INDEX IF NOT EXISTS idx_deals_org_id       ON deals(organization_id);
CREATE INDEX IF NOT EXISTS idx_properties_org_id  ON properties(organization_id);
CREATE INDEX IF NOT EXISTS idx_contracts_org_id   ON contracts(organization_id);
CREATE INDEX IF NOT EXISTS idx_tasks_org_id       ON tasks(organization_id);
CREATE INDEX IF NOT EXISTS idx_accounting_org_id  ON accounting_transactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_notifications_org_id ON notifications(organization_id);
```

---

### 1.3 JWT Hook — org_id в токен

Создать Edge Function в Supabase Dashboard → Authentication → Hooks → **Customize access token**:

```ts
// supabase/functions/custom-access-token/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const payload = await req.json()
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
  const { data: membership } = await supabaseAdmin
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', payload.user_id)
    .eq('is_active', true)
    .single()

  return new Response(
    JSON.stringify({
      claims: {
        ...payload.claims,
        org_id:   membership?.organization_id ?? null,
        org_role: membership?.role ?? null,
      }
    }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
```

Создать helper для получения org_id в Server Actions:

```ts
// src/lib/org.ts — новый файл
import { createClient } from '@/lib/supabase/server'

export async function getOrgId(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const orgId = session?.access_token
    ? JSON.parse(atob(session.access_token.split('.')[1]))?.org_id
    : null
  return orgId ?? null
}

export async function requireOrgId(): Promise<string> {
  const orgId = await getOrgId()
  if (!orgId) throw new Error('Organization not found')
  return orgId
}
```

---

### 1.4 Переписать RLS политики с org_id изоляцией

Применить через **Supabase:apply_migration** с именем `rewrite_rls_with_org_isolation`.

Шаблон для каждой таблицы (повторить для: contacts, leads, deals, properties, contracts, payments, tasks, accounting_transactions, accounting_categories, notifications, files, company_settings, document_templates):

```sql
-- Пример для contacts (повторить для каждой таблицы)
DROP POLICY IF EXISTS "Authenticated users can view contacts" ON contacts;
DROP POLICY IF EXISTS "Authenticated users can insert contacts" ON contacts;
DROP POLICY IF EXISTS "Authenticated users can update contacts" ON contacts;
DROP POLICY IF EXISTS "Authenticated users can delete contacts" ON contacts;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE policyname = 'org members can view contacts' AND tablename = 'contacts') THEN
    CREATE POLICY "org members can view contacts" ON contacts FOR SELECT TO authenticated
      USING (organization_id = get_user_org_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE policyname = 'org members can insert contacts' AND tablename = 'contacts') THEN
    CREATE POLICY "org members can insert contacts" ON contacts FOR INSERT TO authenticated
      WITH CHECK (organization_id = get_user_org_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE policyname = 'org members can update contacts' AND tablename = 'contacts') THEN
    CREATE POLICY "org members can update contacts" ON contacts FOR UPDATE TO authenticated
      USING      (organization_id = get_user_org_id())
      WITH CHECK (organization_id = get_user_org_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE policyname = 'org admins can delete contacts' AND tablename = 'contacts') THEN
    CREATE POLICY "org admins can delete contacts" ON contacts FOR DELETE TO authenticated
      USING (organization_id = get_user_org_id());
  END IF;
END $$;
```

---

### 1.5 Обновление Server Actions — добавить org_id

Паттерн для всех actions (contacts, leads, deals, properties, contracts, accounting, tasks, files):

```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { requireOrgId } from '@/lib/org'   // ← ДОБАВИТЬ ИМПОРТ
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function createContactAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  // ← ДОБАВИТЬ: получаем org_id
  const orgId = await requireOrgId().catch(() => null)
  if (!orgId) return { error: 'Организация не найдена' }

  const rl = await rateLimitCreate(user.id, 'contact')  // ← await!
  if (!rl.success) return { error: 'Слишком много запросов' }

  const parsed = ContactSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { data, error } = await supabase
    .from('contacts')
    .insert({
      ...parsed.data,
      organization_id: orgId,  // ← ДОБАВИТЬ в каждый .insert()
      created_by: user.id,
    })
    .select().single()

  if (error) return { error: error.message }

  revalidatePath('/contacts')
  redirect(`/contacts/${data.id}`)
}
```

---

### 1.6 Обновить TypeScript типы

Добавить в `src/types/database.ts`:

```ts
export interface Organization {
  id: string
  name: string
  slug: string
  plan: 'free' | 'pro' | 'enterprise'
  stripe_customer_id?: string
  stripe_subscription_id?: string
  subscription_status?: string
  trial_ends_at?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface OrganizationMember {
  organization_id: string
  user_id: string
  role: UserRole
  is_active: boolean
  created_at: string
  organization?: Organization
  user?: User
}
```

Добавить `organization_id: string` в интерфейсы: `Contact`, `Lead`, `Deal`, `Property`, `Contract`, `Task`, `AccountingTransaction`.

После изменений БД: `npm run db:types`

---

### 1.7 Удаление legacy таблиц — ⛔ НЕ ВЫПОЛНЯТЬ

**Готовый SQL отсюда удалён намеренно.** Таблицы `clients` и `owners` живые: к ним
обращается код и целый модуль `src/app/(dashboard)/clients/`. `DROP TABLE ... CASCADE`
здесь уронит прод.

Порядок работ — только такой:

1. мигрировать оставшиеся обращения на `contacts` (задача #17 в `docs/IMPROVEMENTS.md`);
2. убедиться, что `grep -rn "from('clients')\|from('owners')" src/` пуст;
3. только после этого писать миграцию на удаление — вручную, а не копированием.

Попытка удалить таблицу через `apply_migration` блокируется хуком
`.claude/hooks/guard-migration.mjs`.

### ✅ Чеклист Phase 1

- [ ] `organizations` + `organization_members` таблицы созданы
- [ ] `get_user_org_id()` helper функция создана в БД
- [ ] `org_id` добавлен на все таблицы, `NOT NULL` установлен
- [ ] Все существующие данные обновлены с `org_id` дефолтной организации
- [ ] Индексы на `org_id` созданы для всех таблиц
- [ ] JWT hook создан и добавляет `org_id` в access token
- [ ] RLS политики переписаны с `get_user_org_id()`
- [ ] Все Server Actions обновлены — добавляют `organization_id` при insert
- [ ] `src/lib/org.ts` создан с `getOrgId()` / `requireOrgId()`
- [ ] TypeScript типы обновлены, `npm run db:types` выполнен
- [ ] Legacy таблицы `clients` + `owners` удалены
- [ ] Проверено вручную: два тестовых агентства не видят данные друг друга
- [ ] `npm test` + `npm run build` — зелёные

---

## PHASE 2 — Security & Audit (1–2 недели)

### 2.1 Audit Log

Применить через **Supabase:apply_migration** с именем `setup_audit_log`:

```sql
CREATE TABLE IF NOT EXISTS audit_logs (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES auth.users(id),
  action          text NOT NULL,   -- 'create' | 'update' | 'delete'
  entity_type     text NOT NULL,   -- 'contact' | 'deal' | 'contract' | ...
  entity_id       uuid,
  entity_label    text,
  changes         jsonb,           -- { field: { old: val, new: val } }
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_org_id
  ON audit_logs(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
  ON audit_logs(entity_type, entity_id);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE policyname = 'org members can view audit logs' AND tablename = 'audit_logs') THEN
    CREATE POLICY "org members can view audit logs" ON audit_logs FOR SELECT TO authenticated
      USING (organization_id = get_user_org_id());
  END IF;
END $$;
```

Создать `src/lib/audit.ts`:

```ts
import { createClient } from '@/lib/supabase/server'

interface AuditParams {
  userId:      string
  orgId:       string
  action:      'create' | 'update' | 'delete'
  entityType:  string
  entityId:    string
  entityLabel: string
  changes?:    Record<string, { old: unknown; new: unknown }>
}

export async function writeAuditLog(params: AuditParams): Promise<void> {
  try {
    const supabase = await createClient()
    await supabase.from('audit_logs').insert({
      organization_id: params.orgId,
      user_id:         params.userId,
      action:          params.action,
      entity_type:     params.entityType,
      entity_id:       params.entityId,
      entity_label:    params.entityLabel,
      changes:         params.changes ?? null,
    })
  } catch (e) {
    // Audit не должен ломать основной флоу
    console.error('Audit log error:', e)
  }
}
```

Добавить `writeAuditLog(...)` в key Server Actions после успешного insert/update/delete.  
Создать страницу `/settings/audit/page.tsx` (только для admin роли).

---

### 2.2 Версионирование договоров — UI

Таблица `contract_versions` уже существует в БД — нужно только write path и UI:

```ts
// В updateContractAction — перед update сохранить текущую версию:
const { data: current } = await supabase
  .from('contracts').select('*').eq('id', id).single()

if (current) {
  await supabase.from('contract_versions').insert({
    contract_id:     id,
    organization_id: orgId,
    version_data:    current,
    created_by:      user.id,
    created_at:      new Date().toISOString(),
  })
}
```

Создать `src/features/contracts/components/ContractVersionHistory.tsx` — список версий с датой, автором, кнопкой "Восстановить". Встроить в `contracts/[id]/page.tsx`.

---

### 2.3 Role permissions matrix

```ts
// src/lib/permissions.ts — новый файл
import type { UserRole } from '@/types/database'

type Resource = 'contacts' | 'deals' | 'leads' | 'properties'
              | 'contracts' | 'payments' | 'employees' | 'accounting'
              | 'analytics' | 'settings'

type Action = 'read' | 'create' | 'update' | 'delete' | 'export'

const PERMISSIONS: Record<UserRole, Partial<Record<Resource, Action[]>>> = {
  admin: {
    contacts:   ['read', 'create', 'update', 'delete', 'export'],
    deals:      ['read', 'create', 'update', 'delete'],
    contracts:  ['read', 'create', 'update', 'delete'],
    employees:  ['read', 'create', 'update', 'delete'],
    accounting: ['read', 'create', 'update', 'delete', 'export'],
    settings:   ['read', 'update'],
    analytics:  ['read', 'export'],
    leads:      ['read', 'create', 'update', 'delete'],
    properties: ['read', 'create', 'update', 'delete'],
    payments:   ['read', 'create', 'update', 'delete'],
  },
  manager: {
    contacts:   ['read', 'create', 'update'],
    deals:      ['read', 'create', 'update'],
    contracts:  ['read', 'create', 'update'],
    employees:  ['read'],
    accounting: ['read'],
    analytics:  ['read'],
    leads:      ['read', 'create', 'update'],
    properties: ['read', 'create', 'update'],
    payments:   ['read', 'create'],
    settings:   ['read'],
  },
  agent: {
    contacts:   ['read', 'create', 'update'],
    deals:      ['read', 'create', 'update'],
    leads:      ['read', 'create', 'update'],
    properties: ['read'],
    contracts:  ['read'],
  },
  accountant: {
    accounting: ['read', 'create', 'update', 'export'],
    deals:      ['read'],
    contracts:  ['read'],
    payments:   ['read', 'create', 'update'],
    analytics:  ['read'],
  },
}

export function can(role: UserRole, resource: Resource, action: Action): boolean {
  return PERMISSIONS[role]?.[resource]?.includes(action) ?? false
}
```

### ✅ Чеклист Phase 2

- [ ] `audit_logs` таблица создана с `org_id`
- [ ] `src/lib/audit.ts` создан, `writeAuditLog` вызывается в key actions
- [ ] Страница `/settings/audit` создана (только для admin)
- [ ] Версии договоров сохраняются при update, `ContractVersionHistory` встроен
- [ ] `src/lib/permissions.ts` создан, `can()` используется в Server Actions

---

## PHASE 3 — PropTech Features (3–4 недели)

### 3.1 Модуль показов (Showings)

Применить через **Supabase:apply_migration** с именем `create_showings`:

```sql
CREATE TABLE IF NOT EXISTS showings (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  property_id     uuid REFERENCES properties(id) ON DELETE SET NULL,
  lead_id         uuid REFERENCES leads(id)      ON DELETE SET NULL,
  deal_id         uuid REFERENCES deals(id)      ON DELETE SET NULL,
  contact_id      uuid REFERENCES contacts(id)   ON DELETE SET NULL,
  agent_id        uuid REFERENCES auth.users(id),
  scheduled_at    timestamptz NOT NULL,
  duration_min    integer DEFAULT 30,
  status          text NOT NULL DEFAULT 'planned'
                       CHECK (status IN ('planned', 'completed', 'cancelled', 'no_show')),
  result          text,   -- 'interested' | 'not_interested' | 'thinking'
  feedback        text,
  next_step       text,
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_showings_org_id    ON showings(organization_id);
CREATE INDEX IF NOT EXISTS idx_showings_property  ON showings(property_id);
CREATE INDEX IF NOT EXISTS idx_showings_agent_date ON showings(agent_id, scheduled_at);

ALTER TABLE showings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE policyname = 'org showings access' AND tablename = 'showings') THEN
    CREATE POLICY "org showings access" ON showings FOR ALL TO authenticated
      USING      (organization_id = get_user_org_id())
      WITH CHECK (organization_id = get_user_org_id());
  END IF;
END $$;
```

Файловая структура модуля:

| Файл | Тип | Что делает |
|------|-----|-----------|
| `src/app/(dashboard)/showings/page.tsx` | Server | Список показов с фильтрами |
| `src/app/(dashboard)/showings/new/page.tsx` | Server | Форма создания |
| `src/app/(dashboard)/showings/[id]/page.tsx` | Server | Детали показа |
| `src/features/showings/actions/showings.actions.ts` | Actions | CRUD + смена статуса |
| `src/features/showings/components/ShowingStatusBadge.tsx` | Client | Бейдж статуса |
| `src/features/showings/components/ShowingResultForm.tsx` | Client | Форма результата |

Добавить ссылку в Sidebar между Properties и Contracts.

---

### 3.2 Подборки объектов (Property Collections)

Применить через **Supabase:apply_migration** с именем `create_property_collections`:

```sql
CREATE TABLE IF NOT EXISTS property_collections (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id         uuid REFERENCES leads(id) ON DELETE CASCADE,
  title           text NOT NULL,
  share_token     text UNIQUE DEFAULT encode(gen_random_bytes(12), 'hex'),
  is_public       boolean DEFAULT false,
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS collection_items (
  collection_id uuid NOT NULL REFERENCES property_collections(id) ON DELETE CASCADE,
  property_id   uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  sort_order    integer DEFAULT 0,
  agent_note    text,
  added_at      timestamptz DEFAULT now(),
  PRIMARY KEY (collection_id, property_id)
);
```

Создать публичную страницу подборки (без auth): `src/app/c/[token]/page.tsx`.  
Добавить `/c/` в `PUBLIC_PATHS` в `middleware.ts`.

---

### 3.3 Email уведомления (Resend)

```bash
npm install resend --legacy-peer-deps
```

```env
RESEND_API_KEY=re_your_key_here
NEXT_PUBLIC_SITE_URL=https://your-domain.vercel.app
```

```ts
// src/lib/email.ts — новый файл
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = 'HousePro CRM <noreply@your-domain.ru>'

export async function sendPaymentOverdueEmail(params: {
  to: string; agentName: string; amount: number; dueDate: string; contractNumber?: string
}) {
  await resend.emails.send({
    from: FROM, to: [params.to],
    subject: `⚠️ Просроченный платёж — ${params.contractNumber ?? ''}`,
    html: `<p>Платёж ${params.amount.toLocaleString('ru')} ₽ просрочен (ожидался ${params.dueDate})</p>`,
  })
}

// Аналогично создать:
// sendContractExpiryEmail()
// sendNewLeadAssignedEmail()
// sendTaskOverdueEmail()
```

---

### 3.4 KPI Dashboard сотрудников

Обновить `src/app/(dashboard)/employees/[id]/page.tsx` — добавить блок статистики:

```ts
// Добавить в Promise.all:
const [{ count: dealsCount }, { count: completedCount }, { data: dealStats }] = await Promise.all([
  supabase.from('deals').select('id', { count: 'exact', head: true })
    .eq('manager_id', employeeId).gte('created_at', monthStart),
  supabase.from('deals').select('id', { count: 'exact', head: true })
    .eq('manager_id', employeeId).eq('status', 'completed').gte('created_at', monthStart),
  supabase.from('deals').select('commission, amount')
    .eq('manager_id', employeeId).eq('status', 'completed'),
])

const totalCommission = (dealStats ?? []).reduce((s, d) => s + Number(d.commission ?? 0), 0)
```

Отображать в 4 stat-карточках по визуальному стандарту CLAUDE.md: Сделки за месяц, Завершено, Конверсия, Комиссия.

---

### 3.5 Расширенная аналитика — кастомный период

Создать `src/features/analytics/components/DateRangePicker.tsx` — Client Component с `input[type=date]` from/to. При изменении обновлять `searchParams` через `useRouter().push`.

В `src/app/(dashboard)/analytics/page.tsx` читать `searchParams.from` и `searchParams.to` для фильтрации запросов.

### ✅ Чеклист Phase 3

- [ ] `showings` таблица создана, модуль `/showings` работает (CRUD + смена статуса)
- [ ] `property_collections` + `collection_items` созданы, `/c/[token]` публичная страница
- [ ] Resend установлен, email уведомления работают для просроченных платежей
- [ ] KPI блок добавлен на страницу сотрудника
- [ ] Аналитика поддерживает произвольный период через `searchParams`
- [ ] `npm test` + `npm run build` — зелёные

---

## PHASE 4 — SaaS Core (4–6 недель)

### 4.1 Stripe Billing

```bash
npm install stripe @stripe/stripe-js --legacy-peer-deps
```

```env
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

Добавить в `src/lib/env.ts`:
```ts
stripeSecretKey:     requireEnv('STRIPE_SECRET_KEY'),
stripeWebhookSecret: requireEnv('STRIPE_WEBHOOK_SECRET'),
```

Создать API routes:

| Файл | Endpoint | Описание |
|------|---------|---------|
| `src/app/api/billing/checkout/route.ts` | POST | Создать Stripe Checkout Session |
| `src/app/api/billing/portal/route.ts` | POST | Создать Stripe Customer Portal |
| `src/app/api/stripe/webhook/route.ts` | POST | Обработать Stripe webhooks |

```ts
// src/app/api/stripe/webhook/route.ts — ключевая логика
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { headers } from 'next/headers'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(request: Request) {
  const body = await request.text()
  const headersList = await headers()
  const sig = headersList.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    return new Response(`Webhook error: ${err}`, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  switch (event.type) {
    case 'customer.subscription.updated':
    case 'customer.subscription.created': {
      const sub = event.data.object as Stripe.Subscription
      const plan = sub.items.data[0]?.price?.lookup_key ?? 'free'
      await supabase.from('organizations')
        .update({ plan, subscription_status: sub.status, stripe_subscription_id: sub.id })
        .eq('stripe_customer_id', sub.customer as string)
      break
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      await supabase.from('organizations')
        .update({ plan: 'free', subscription_status: 'cancelled' })
        .eq('stripe_customer_id', sub.customer as string)
      break
    }
  }

  return new Response('OK')
}
```

```ts
// src/lib/feature-gates.ts — новый файл
const PLAN_LIMITS = {
  free:       { max_users: 1,        max_properties: 20,       max_contracts: 10,       api_access: false, webhooks: false },
  pro:        { max_users: 10,       max_properties: Infinity, max_contracts: Infinity, api_access: true,  webhooks: false },
  enterprise: { max_users: Infinity, max_properties: Infinity, max_contracts: Infinity, api_access: true,  webhooks: true  },
} as const

export function getFeatureGate(plan: string) {
  return PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS] ?? PLAN_LIMITS.free
}
```

Создать страницу `/settings/billing/page.tsx` с тарифами и кнопками апгрейда.

---

### 4.2 Onboarding Wizard

Создать `src/app/(dashboard)/onboarding/page.tsx` — 5-шаговый wizard:

| Шаг | Что делаем | Таблица |
|-----|-----------|---------|
| 1. Компания | Название + ИНН + телефон | organizations |
| 2. Профиль исполнителя | Юридическая форма + реквизиты | company_settings |
| 3. Первый объект | Быстрое добавление | properties |
| 4. Первый лид | Добавить тестовый лид | leads |
| 5. Шаблоны | Ссылка на загрузку DOCX шаблонов | document_templates |

Добавить поле `onboarding_completed boolean DEFAULT false` в `organizations`.  
В `(dashboard)/layout.tsx` — если `!onboarding_completed` → редиректить на `/onboarding`.

---

### 4.3 PWA Manifest

```json
// public/manifest.json
{
  "name": "HousePro CRM",
  "short_name": "HousePro",
  "description": "CRM для агентств недвижимости",
  "start_url": "/dashboard",
  "display": "standalone",
  "background_color": "#F8FAFC",
  "theme_color": "#16A34A",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

```ts
// src/app/layout.tsx — добавить в metadata:
export const metadata: Metadata = {
  // ... существующие поля
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'HousePro CRM' },
}
```

### ✅ Чеклист Phase 4

- [ ] Stripe установлен, `/api/billing/checkout` и `/api/stripe/webhook` работают
- [ ] Webhook обновляет `organizations.plan` при оплате/отмене
- [ ] Страница `/settings/billing` с тарифами создана
- [ ] Feature gates работают — free план ограничен 20 объектами
- [ ] Onboarding wizard создан, новые агентства проходят его при первом входе
- [ ] `manifest.json` + иконки добавлены
- [ ] `npm test` + `npm run build` — зелёные

---

## PHASE 5 — API & Integrations (4–6 недель)

### 5.1 Public REST API

Применить через **Supabase:apply_migration** с именем `create_api_keys`:

```sql
CREATE TABLE IF NOT EXISTS api_keys (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  key_hash        text NOT NULL UNIQUE,
  key_prefix      text NOT NULL,
  scopes          text[] NOT NULL DEFAULT '{read}',
  last_used_at    timestamptz,
  expires_at      timestamptz,
  is_active       boolean DEFAULT true,
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
```

```ts
// src/lib/api-auth.ts — новый файл
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function authenticateApiKey(request: Request) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer hp_'))
    return { error: 'Invalid API key format', status: 401 }

  const apiKey  = authHeader.replace('Bearer ', '')
  const keyHash = createHash('sha256').update(apiKey).digest('hex')

  const { data: key } = await supabaseAdmin
    .from('api_keys')
    .select('organization_id, scopes, is_active, expires_at')
    .eq('key_hash', keyHash)
    .single()

  if (!key || !key.is_active) return { error: 'Invalid API key', status: 401 }
  if (key.expires_at && new Date(key.expires_at) < new Date())
    return { error: 'API key expired', status: 401 }

  await supabaseAdmin.from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('key_hash', keyHash)

  return { orgId: key.organization_id, scopes: key.scopes }
}
```

API endpoints создать в `src/app/api/v1/`:

| Endpoint | Описание |
|---------|---------|
| `GET/POST /api/v1/contacts` | Список + создание контактов |
| `GET/PUT/DELETE /api/v1/contacts/[id]` | CRUD одного контакта |
| `GET/POST /api/v1/leads` | Лиды |
| `GET /api/v1/properties` | Объекты (read-only) |
| `GET /api/v1/deals` | Сделки (read-only) |

Добавить исключение в `middleware.ts` для `/api/v1`.  
Создать страницу управления ключами: `/settings/api/page.tsx`.

---

### 5.2 Webhooks

Применить через **Supabase:apply_migration** с именем `create_webhooks`:

```sql
CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  url             text NOT NULL,
  secret          text NOT NULL,
  events          text[] NOT NULL DEFAULT '{}',
  is_active       boolean DEFAULT true,
  created_at      timestamptz DEFAULT now()
);
```

```ts
// src/lib/webhooks.ts — новый файл
import { createClient } from '@supabase/supabase-js'
import { createHmac } from 'crypto'

export async function dispatchWebhook(orgId: string, event: string, payload: Record<string, unknown>) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data: endpoints } = await supabase
    .from('webhook_endpoints')
    .select('url, secret')
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .contains('events', [event])

  if (!endpoints?.length) return

  const body = JSON.stringify({ event, data: payload, timestamp: Date.now() })

  await Promise.allSettled(
    endpoints.map(async (ep) => {
      const sig = createHmac('sha256', ep.secret).update(body).digest('hex')
      await fetch(ep.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-HousePro-Signature': `sha256=${sig}` },
        body,
        signal: AbortSignal.timeout(5000),
      })
    })
  )
}

// Использование в createLeadAction:
// await dispatchWebhook(orgId, 'lead.created', { id: lead.id, ... })
```

---

### 5.3 Экспорт 1С / CSV

```ts
// Паттерн экспорта в src/app/api/export/contacts/route.ts
const BOM = '\uFEFF'
const csvHeaders = ['ФИО/Название', 'Телефон', 'Email', 'ИНН', 'КПП', 'ОГРН', 'Роль']
const rows = contacts.map(c => [
  c.company_name || c.full_name,
  c.phone ?? '', c.email ?? '',
  c.inn ?? '', c.kpp ?? '', c.ogrn ?? '',
  c.role
])
const csv = BOM + [csvHeaders, ...rows].map(r => r.join(';')).join('\n')

return new Response(csv, {
  headers: {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': 'attachment; filename="contacts.csv"',
  }
})
```

Аналогично создать для: `deals`, `contracts`, `accounting_transactions`.

### ✅ Чеклист Phase 5

- [ ] `api_keys` таблица создана, `authenticateApiKey` работает
- [ ] API endpoints `/api/v1/*` созданы и возвращают данные по org
- [ ] Страница управления API ключами `/settings/api` создана
- [ ] `webhook_endpoints` таблица создана, `dispatchWebhook` вызывается из key actions
- [ ] CSV экспорт с BOM добавлен для contacts, deals, contracts
- [ ] `npm test` + `npm run build` — зелёные

---

## После выполнения всех фаз

Продукт полностью SaaS-готов. Останется только:

- **Ценообразование** — определить стоимость Free/Pro/Enterprise для рынка РФ
- **Лендинг** — сайт-витрина с описанием и кнопкой регистрации  
- **Go-to-market** — партнёрства с риелторскими ассоциациями

> **Правило порядка фаз:** Phase 0 → 1 → 2 → 3 → 4 → 5.  
> После Phase 4 можно принимать первых платящих клиентов, Phase 5 выполнять параллельно.

