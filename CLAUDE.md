# HousePro CRM — Инструкция для Claude

Этот файл — главное руководство для работы с проектом. Читай его ПОЛНОСТЬЮ перед любой задачей.

## Стек проекта

- **Next.js 16.2.6** + **React 19** + **TypeScript**
- **Tailwind CSS v4** (без `tailwind.config.ts` конфигурации классов, только через postcss)
- **shadcn/ui** (компоненты в `src/components/ui/`)
- **Supabase** (PostgreSQL + Auth + Storage)
- **@dnd-kit** для Kanban drag-and-drop
- **react-hook-form** + **zod** для форм
- **docxtemplater** + **pizzip** для генерации DOCX
- **sonner** для toast-уведомлений
- **framer-motion** для анимаций
- **lucide-react** для иконок

## Подключение к инфраструктуре

```
Supabase URL:  https://zwclvcswvhjeqwxrkbte.supabase.co
Supabase Ref:  zwclvcswvhjeqwxrkbte
GitHub:        https://github.com/nojkinrs124/housepro-crm
Admin user ID: 508499ac-0268-49c7-9c31-8198deafeeda
```

## Настройка окружения в каждой сессии

```bash
# 1. Клонировать репо
git clone https://[PAT]@github.com/nojkinrs124/housepro-crm.git
cd housepro-crm

# 2. Установить зависимости (ОБЯЗАТЕЛЬНО --legacy-peer-deps)
npm install --legacy-peer-deps

# 3. Создать .env.local
cat > .env.local << 'EOF'
NEXT_PUBLIC_SUPABASE_URL=https://zwclvcswvhjeqwxrkbte.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[ANON_KEY]
EOF
```

**После push убирать PAT из remote URL:**
```bash
git remote set-url origin https://github.com/nojkinrs124/housepro-crm.git
```

---

## ОБЯЗАТЕЛЬНЫЕ ПРАВИЛА Next.js (нарушение = Runtime Error)

### ❌ ЗАПРЕЩЕНО в Server Components

```tsx
// НИКОГДА не добавляй event handlers в Server Component (файл без 'use client')
export default function Page() {
  return <button onClick={() => {}}>Click</button>  // ❌ ОШИБКА
}

// НИКОГДА не добавляй: onClick, onChange, onSubmit, onDrag, onMouseEnter и т.д.
// НИКОГДА не используй useState, useEffect, useTransition в Server Component
```

### ✅ ПРАВИЛЬНЫЙ ПАТТЕРН

```tsx
// Server Component (page.tsx) — только данные и разметка
import { DeleteButton } from './DeleteButton'  // ← client component

export default async function Page() {
  const data = await fetchData()
  return <DeleteButton id={data.id} />
}

// DeleteButton.tsx — отдельный файл с 'use client'
'use client'
import { deleteAction } from '../actions/delete.actions'

export function DeleteButton({ id }: { id: string }) {
  return <button onClick={() => deleteAction(id)}>Удалить</button>
}
```

**Правило**: любая интерактивность (кнопки, формы, drag) → отдельный Client Component с `'use client'` наверху.

---

## Структура файлов

```
src/
  app/
    (auth)/           # страницы авторизации
    (dashboard)/      # основные страницы CRM
      [модуль]/
        page.tsx          # Server Component, загружает данные
        [id]/page.tsx     # детальная карточка
        [id]/edit/page.tsx
        new/page.tsx
    api/              # API routes (XML экспорт и др.)
    layout.tsx
  components/
    layout/           # Sidebar, Header, NotificationBell
    search/           # GlobalSearch
    ui/               # shadcn компоненты
  features/
    [модуль]/
      actions/        # Server Actions ('use server')
      components/     # Client Components ('use client')
      services/       # бизнес-логика (document.service.ts и др.)
  lib/
    supabase/
      server.ts       # createClient() для Server Components и Actions
      client.ts       # createClient() для Client Components
    utils.ts
  types/
    database.ts       # все TypeScript типы
```

---

## Supabase — правила работы

### Клиент в Server Action / Server Component

```ts
import { createClient } from '@/lib/supabase/server'

export async function myAction() {
  const supabase = await createClient()  // ← await обязателен
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }
  // ...
}
```

### Клиент в Client Component

```tsx
'use client'
import { createClient } from '@/lib/supabase/client'  // ← другой путь!

const supabase = createClient()  // ← без await
```

### Схема изменений БД

**ВСЕГДА использовать `Supabase:apply_migration`**, никогда не `execute_sql` для DDL:

```sql
-- Шаблон миграции
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS new_field text;
CREATE INDEX IF NOT EXISTS idx_contacts_new_field ON contacts(new_field);

-- RLS политики — оборачивать в DO блок:
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Policy name' AND tablename = 'table'
  ) THEN
    CREATE POLICY "Policy name" ON table FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
```

### PostgREST — join с одной таблицей через несколько FK

```ts
// НЕВЕРНО — если два FK на contacts:
supabase.from('deals').select('*, contacts(*)')

// ВЕРНО — явные hints:
supabase.from('deals').select(`
  *,
  client:contacts!deals_client_contact_id_fkey(id, full_name, phone),
  owner:contacts!deals_owner_contact_id_fkey(id, full_name, phone)
`)
```

---

## Server Actions — шаблон

```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function createSomethingAction(formData: FormData) {
  const supabase = await createClient()
  
  // 1. Проверка авторизации
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }
  
  // 2. Получение и валидация данных
  const name = (formData.get('name') as string)?.trim()
  if (!name) return { error: 'Заполните обязательные поля' }
  
  // 3. Операция с БД
  const { data, error } = await supabase
    .from('table')
    .insert({ name, created_by: user.id })
    .select()
    .single()
  
  if (error) return { error: error.message }
  
  // 4. Инвалидация кэша и редирект
  revalidatePath('/module')
  redirect(`/module/${data.id}`)
}
```

---

## База данных — таблицы

| Таблица | Назначение |
|---------|-----------|
| `users` | Сотрудники (связано с auth.users) |
| `contacts` | Единые контакты (клиенты + собственники, поле `role`) |
| `leads` | Лиды/заявки |
| `deals` | Сделки |
| `deal_comments` | Комментарии к сделкам |
| `properties` | Объекты недвижимости |
| `contracts` | Договоры |
| `payments` | Платежи |
| `tasks` | Задачи |
| `notifications` | Уведомления |
| `files` | Файловые вложения (метаданные) |
| `contract_versions` | Версии договоров |
| `clients` | Устаревшая, legacy (не использовать для новых фич) |
| `owners` | Устаревшая, legacy (не использовать для новых фич) |

**Важно**: `clients` и `owners` — legacy таблицы для обратной совместимости. Все новые фичи работают через `contacts`.

### Поле role в contacts

```ts
type ContactRole = 'client' | 'owner' | 'both'
type ContactStatus = 'new' | 'active' | 'vip' | 'inactive'
```

---

## Supabase Storage

Бакеты:
- `documents` — договоры, документы
- `document-templates` — шаблоны DOCX
- `property-photos` — фото объектов
- `avatars` — аватары пользователей
- `passports` — паспорта
- `files` — прочие файлы

Валидация при загрузке:
- Блокировать: `exe, bat, cmd, com, msi, scr, vbs, js, jar, zip`
- Максимум: 20 МБ

---

## TypeScript — правила

```ts
// ❌ ЗАПРЕЩЕНО
const data: any = {}
const result = value as never
// eslint-disable-next-line @typescript-eslint/no-explicit-any

// ✅ ПРАВИЛЬНО
import type { Contact, Deal } from '@/types/database'
const data: Contact = {}
```

Все типы — в `src/types/database.ts`. Добавлять туда при создании новых сущностей.

---

## Git — обязательный workflow

**После каждой завершённой фазы работы:**

```bash
# 1. ОБЯЗАТЕЛЬНАЯ проверка перед пушем — event handlers в Server Components
python3 -c "
import os, re
for root, dirs, files in os.walk('src/app'):
    for f in files:
        if not f.endswith('.tsx'): continue
        path = os.path.join(root, f)
        content = open(path).read()
        if content.split('\n')[0].strip() == \"'use client'\": continue
        if re.search(r'on(Mouse|Click|Change|Submit|Drag|Drop)\w*\s*=', content):
            print('❌ SERVER COMPONENT WITH HANDLERS:', path)
"
# Если вывод есть — исправить до пуша!

# 2. Коммит и пуш
git add -A
git commit -m "feat: описание что сделано"
git push origin main
```

Без push изменения потеряются при смене сессии. **Без исключений.**

---

## Установленные пакеты (не переустанавливать, не заменять)

| Что нужно | Пакет |
|-----------|-------|
| Drag-and-drop | `@dnd-kit/core` + `@dnd-kit/sortable` |
| Формы | `react-hook-form` + `@hookform/resolvers` + `zod` |
| DOCX генерация | `docxtemplater` + `pizzip` |
| Toast | `sonner` |
| Анимации | `framer-motion` |
| Иконки | `lucide-react` |
| UI компоненты | `@radix-ui/*` через shadcn |

**НЕ добавлять**: `@hello-pangea/dnd`, `react-beautiful-dnd`, `axios`, `react-query` — в проекте их нет и они не нужны.

---

## Частые ошибки и решения

### "Event handlers cannot be passed to Client Component props"
→ Убрать onClick/onChange/onSubmit из Server Component. Создать отдельный файл с `'use client'`.

### "Cannot find module '@/utils/supabase/server'"
→ Правильный путь: `@/lib/supabase/server` (не `utils`).

### npm install падает с peer dependency ошибкой
→ Всегда `npm install --legacy-peer-deps`.

### PostgREST: "Could not embed..."
→ Использовать hint синтаксис: `contacts!deals_client_contact_id_fkey(fields)`.

### Supabase прямые HTTP запросы не работают
→ `api.supabase.com` заблокирован. Использовать только MCP коннектор Supabase.

### \"the name X is defined multiple times\" (Turbopack build error)
→ Перед добавлением функции в существующий actions файл **всегда проверять** что такой функции там ещё нет:
```bash
grep -n "functionName" src/features/module/actions/module.actions.ts
```
Если функция уже есть — использовать её, не добавлять новую. Особенно актуально для `delete*Action` — они часто уже существуют в файлах.

### RLS политика уже существует
→ Оборачивать в `DO $$ BEGIN IF NOT EXISTS ... END $$`.

---

## Модули проекта — статус

| Модуль | Страницы | Статус |
|--------|----------|--------|
| Auth | `/login` | ✅ |
| Dashboard | `/dashboard` | ✅ |
| Leads | `/leads` + Kanban | ✅ |
| Contacts | `/contacts` (unified clients+owners) | ✅ |
| Deals | `/deals` + Kanban + комментарии | ✅ |
| Properties | `/properties` | ✅ |
| Contracts | `/contracts` + генерация DOCX | ✅ |
| Payments | `/payments` + `/payments/[id]` | ✅ |
| Tasks | `/tasks` + Kanban + `/tasks/[id]` | ✅ |
| Employees | `/employees` | ✅ |
| Search | `/search` (Ctrl+K) | ✅ |
| Export | `/export` (Avito/CIAN XML) | ✅ |
| Analytics | `/analytics` (Recharts: funnel, payments, conversion) | ✅ |
| Settings | `/settings/*` | ✅ |
| Notifications | bell + pg_cron | ✅ |
| Files | upload + preview + magic bytes validation | ✅ |

---

## Коммуникация с Русланом

- Короткие команды: "продолжай", "далее", "делай" = одобрение, продолжать без уточнений
- Принимать архитектурные решения самостоятельно
- Только production-ready код, никаких заглушек
- Compact summary в конце сессии для экономии контекста

---

## Claude Skills (jeffallan/claude-skills v0.4.12)

Установлены в `.claude/skills/` — 12 специализированных скилов для стека проекта.

### Активные скилы

| Скил | Когда активировать |
|------|--------------------|
| `nextjs-developer` | App Router, Server Components, Server Actions, Vercel деплой |
| `react-expert` | React 19, хуки, состояние, производительность |
| `typescript-pro` | Типы, generics, strict mode, Supabase types |
| `postgres-pro` | SQL оптимизация, индексы, JSONB, PostgREST |
| `fullstack-guardian` | Code review всего стека перед push |
| `debugging-wizard` | Диагностика ошибок Vercel/Supabase/TS |
| `secure-code-guardian` | RLS политики, auth, input validation |
| `feature-forge` | Проектирование новых фич |
| `api-designer` | REST endpoints, server actions API design |
| `test-master` | Тесты для критичных модулей |
| `code-reviewer` | Pre-push review |
| `javascript-pro` | JS паттерны, async, performance |

### Команды

- `/common-ground` — синхронизация контекста проекта с Claude Code
- `/intake` — intake новой фичи
- `/project` — workflow управление

### Использование

Скилы активируются автоматически по контексту запроса в **Claude Code**.
В этом чате (claude.ai) — читать SKILL.md вручную при необходимости.
