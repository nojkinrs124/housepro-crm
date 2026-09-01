---
name: housepro-new-module
description: Пошаговое создание нового модуля HousePro CRM — таблица с org-изоляцией, структура каталогов, Server Actions, страницы списка/формы/детальной, пункт в Sidebar, типы. Использовать, когда добавляется новая сущность CRM целиком (показы, подборки, заявки и т.п.), а не отдельная страница. Триггеры: новый модуль, новая сущность, добавить раздел, CRUD, новая таблица с UI.
---

# Новый модуль CRM

Порядок, по которому в проекте сделаны `showings` и `collections` — брать их как образец.

## 1. Схема БД

Через skill `housepro-migration`. Минимум для новой таблицы:

```sql
CREATE TABLE IF NOT EXISTS things (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- поля модуля
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_things_org_id ON things(organization_id);
ALTER TABLE things ENABLE ROW LEVEL SECURITY;
-- + политики через get_user_org_id() в DO-блоке
```

## 2. Структура каталогов

```
src/app/(dashboard)/things/
  page.tsx            Server Component — список
  new/page.tsx        форма создания
  [id]/page.tsx       детальная карточка
  [id]/edit/page.tsx  форма редактирования
src/features/things/
  actions/things.actions.ts    'use server'
  components/*.tsx             'use client' — вся интерактивность
  services/*.ts                бизнес-логика, если её много
```

## 3. Server Action — шаблон

```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { requireOrgId } from '@/lib/org'
import { rateLimitCreate } from '@/lib/rate-limit'
import { writeAuditLog } from '@/lib/audit'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function createThingAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const orgId = await requireOrgId().catch(() => null)
  if (!orgId) return { error: 'Организация не найдена' }

  const rl = await rateLimitCreate(user.id, 'thing')   // ← await обязателен
  if (!rl.success) return { error: 'Слишком много запросов' }

  const parsed = ThingSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { data, error } = await supabase
    .from('things')
    .insert({ ...parsed.data, organization_id: orgId, created_by: user.id })
    .select('id')
    .single()

  if (error) return { error: error.message }

  await writeAuditLog({ userId: user.id, orgId, action: 'create', entityType: 'thing', entityId: data.id, entityLabel: parsed.data.title })
  revalidatePath('/things')
  redirect(`/things/${data.id}`)
}
```

**Перед добавлением функции в существующий actions-файл — проверить, что её там ещё нет:**

```bash
grep -n "deleteThingAction" src/features/things/actions/things.actions.ts
```

Дубль имени = ошибка сборки Turbopack «the name X is defined multiple times». Особенно
часто это случается с `delete*Action`.

## 4. Страницы

Разметку брать из skill `housepro-ui` (`references/page-templates.md`).

Жёстко: `page.tsx` — Server Component, ноль `onClick`/`useState`/`useEffect`. Любая
интерактивность — отдельный файл с `'use client'` наверху. Из клиентского файла нельзя
импортировать в серверный обычную функцию (только PascalCase-компонент как JSX) —
чистые типы и функции выносить в отдельный файл без `'use client'`, образец:
`src/features/contracts/utils/rent-apartment-data.ts`. Хук `post-edit.mjs` это проверяет.

Формы — только через `ServerActionForm`, без `formAction()`-антипаттерна.

## 5. Остальное

- Пункт в `src/components/layout/Sidebar.tsx` — в осмысленном месте порядка.
- Типы — в `src/types/database.ts`, с `organization_id: string`.
- Права — `can(role, resource, action)` из `src/lib/permissions.ts`, если модуль
  не для всех ролей.
- Если модуль трогает денежный или юридический поток (payments, contracts, billing) —
  **обязательно тест на этот поток**, даже если остальное без тестов.
- Файл вырос за 300 строк — выносить логику в `features/*/services`, не оставлять
  «раз уж всё равно тут».
- Перед пушем — skill `housepro-release` (README обновляется тем же коммитом).
