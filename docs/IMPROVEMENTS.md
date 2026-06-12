# HousePro CRM — Анализ и план улучшений

> Анализ проведён с помощью скилов: `fullstack-guardian`, `secure-code-guardian`, `code-reviewer`, `nextjs-developer`, `react-expert`, `typescript-pro`, `postgres-pro`, `feature-forge`
>
> Дата: июнь 2026 | Стек: Next.js 16.2.6 · React 19 · TypeScript · Supabase · Tailwind v4

---

## Статус проекта

| Метрика | Значение |
|---|---|
| Роутов (pages) | 48 |
| Компонентов | 96 tsx-файлов |
| Client Components | 43 (45%) |
| Server Actions модулей | 13 |
| Таблиц БД | 14 |
| Тестов | **0** |
| `loading.tsx` / `error.tsx` | **0 / 0** |
| Zod-валидация в actions | **0 из 13** |
| Next.js Middleware | **отсутствует** |

---

## Критические проблемы (P0)

### 1. Нет Next.js Middleware — маршруты не защищены

**Проблема:** Файл `middleware.ts` отсутствует. Любой неавторизованный пользователь может напрямую открыть URL вида `/deals`, `/contracts`, `/employees` — сервер отрендерит страницу до проверки сессии. Защита сейчас работает только внутри Server Actions (`if (!user) redirect('/login')`), но страницы-листинги не проверяют auth на уровне роутинга.

**Решение:**
```typescript
// middleware.ts (корень проекта)
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/login', '/auth/callback', '/auth/reset-password']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  let response = NextResponse.next()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => request.cookies.getAll(),
        setAll: (c) => c.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)) } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/public).*)'],
}
```

---

### 2. Нет Zod-валидации в Server Actions

**Проблема:** Все 13 модулей Server Actions выполняют ручную валидацию через `if (!field)` или `includes()`. Пакет `zod@4.4.3` уже установлен, но используется только в одном месте — `LoginForm.tsx`. Это нарушает принцип **server-side validation** из скила `secure-code-guardian`.

**Последствия:** числовые поля принимают `NaN` без ошибки, строковые поля не имеют ограничений длины, отсутствует email-формат проверка в contacts.

**Решение:** общий паттерн для всех actions:
```typescript
// src/lib/schemas/contact.schema.ts
import { z } from 'zod'

export const ContactSchema = z.object({
  full_name: z.string().min(1).max(200),
  phone: z.string().regex(/^\+?[\d\s\-()]{7,20}$/).nullable().optional(),
  email: z.string().email().nullable().optional(),
  role: z.enum(['client', 'owner', 'both']),
  status: z.enum(['new', 'active', 'vip', 'inactive']).default('new'),
  birth_date: z.string().date().nullable().optional(),
  // ... остальные поля
})

export type ContactInput = z.infer<typeof ContactSchema>
```

```typescript
// в contacts.actions.ts
export async function createContactAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const parsed = ContactSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message, fields: parsed.error.flatten().fieldErrors }
  }
  // ... работа с parsed.data
}
```

**Приоритет внедрения:** `contacts`, `deals`, `payments`, `contracts` — 4 ключевых модуля.

---

### 3. Search использует legacy-таблицу `clients`

**Проблема:** `src/features/search/actions/search.actions.ts:29` делает запрос `supabase.from('clients')` — нарушение правила из `CLAUDE.md`. Таблица `clients` — легаси, новые контакты хранятся в `contacts`.

**Решение:**
```typescript
// Заменить в search.actions.ts
supabase
  .from('contacts')
  .select('id, full_name, phone, role, status')
  .or(`full_name.ilike.%${q}%,phone.ilike.%${q}%`)
  .limit(5)
```

---

## Высокоприоритетные улучшения (P1)

### 4. Нет `loading.tsx` и `error.tsx` — пустые экраны при загрузке

**Проблема:** 48 страниц, ни одного `loading.tsx` или `error.tsx`. При медленном Supabase-запросе пользователь видит пустую страницу без индикации. При ошибке — некрасивое необработанное исключение.

**Решение:** создать на уровне layout и для тяжёлых страниц:
```
src/app/(dashboard)/
├── loading.tsx          ← глобальный скелетон для dashboard
├── error.tsx            ← глобальный error boundary
├── deals/
│   ├── loading.tsx      ← скелетон для Kanban
│   └── [id]/loading.tsx
├── analytics/
│   └── loading.tsx      ← скелетон для графиков
```

```typescript
// src/app/(dashboard)/loading.tsx
export default function DashboardLoading() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
    </div>
  )
}
```

```typescript
// src/app/(dashboard)/error.tsx
'use client'
export default function DashboardError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <p className="text-red-600">Что-то пошло не так: {error.message}</p>
      <button onClick={reset} className="px-4 py-2 bg-green-600 text-white rounded-lg">
        Попробовать снова
      </button>
    </div>
  )
}
```

---

### 5. Нет кэширования — каждый запрос к Supabase «живой»

**Проблема:** Все Server Component страницы делают прямые `supabase.from()` запросы без `unstable_cache`. Аналитика (444 строки) выполняет ~8 параллельных тяжёлых запросов при каждом рефреше.

**Решение:** обернуть read-only данные в `unstable_cache`:
```typescript
import { unstable_cache } from 'next/cache'

const getAnalyticsData = unstable_cache(
  async (userId: string) => {
    const supabase = await createClient()
    // ... все 8 запросов
    return { monthlyDeals, funnelData, ... }
  },
  ['analytics'],
  { revalidate: 300, tags: ['analytics', 'deals'] } // 5 минут
)
```

После мутаций добавить `revalidateTag('analytics')` в deals/payments actions.

**Ожидаемый эффект:** аналитика — до 10× быстрее при повторных посещениях.

---

### 6. `useActionState` не используется в формах

**Проблема:** React 19 предоставляет `useActionState` для управления состоянием форм (pending, errors). Сейчас 17 клиентских компонентов используют ручной `useState` + `try/catch` паттерн вместо нативного React 19 API.

**Решение:**
```typescript
// Было (ручной паттерн):
const [loading, setLoading] = useState(false)
const [error, setError] = useState<string | null>(null)

async function handleSubmit() {
  setLoading(true)
  try { await createDealAction(formData) }
  catch (e) { setError(...) }
  finally { setLoading(false) }
}

// Стало (React 19):
'use client'
import { useActionState } from 'react'

const [state, formAction, isPending] = useActionState(createDealAction, null)
```

Это убирает boilerplate в каждом компоненте и автоматически интегрируется с Suspense.

---

### 7. Нет RLS для новых таблиц (`contacts`, `deals`, `deal_comments`)

**Проблема:** В `schema.sql` включён RLS для `clients`, `owners`, `properties`, `contracts`, `files`, `leads`, `tasks`, `payments`, `logs`, `document_templates` — но нет явных политик для таблиц `contacts`, `deals`, `deal_comments` которые добавлялись позже.

**Действие:** проверить через Supabase MCP и добавить миграцию:
```sql
-- Убедиться что RLS включён
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_comments ENABLE ROW LEVEL SECURITY;

-- Политики contacts
CREATE POLICY "Authenticated users can view contacts"
  ON public.contacts FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage contacts"
  ON public.contacts FOR ALL
  TO authenticated USING (true) WITH CHECK (true);
```

---

## Среднеприоритетные улучшения (P2)

### 8. Типизация Database = any

**Проблема:** В `src/types/database.ts` — ручные интерфейсы (263 строки), которые могут расходиться со схемой Supabase. Нет автогенерации типов из реальной схемы.

**Решение:** периодически регенерировать через Supabase CLI:
```bash
npx supabase gen types typescript --project-id zwclvcswvhjeqwxrkbte > src/types/supabase.ts
```
Затем использовать `Database['public']['Tables']['deals']['Row']` вместо кастомных интерфейсов.

---

### 9. `select('*')` в запросах — лишние данные по сети

**Проблема:** Ряд запросов выбирает все поля таблицы. Для листингов (deals list, contacts list) это передаёт поля вроде `passport_series`, `passport_number` которые на странице не отображаются.

**Решение:** явный select только нужных полей:
```typescript
// Вместо
supabase.from('contacts').select('*')

// Конкретные поля для списка
supabase.from('contacts').select('id, full_name, phone, email, role, status, created_at')
```

---

### 10. Нет индексов для поисковых запросов

**Проблема:** Поиск использует `ilike.%query%` — это full scan по таблицам `contacts`, `properties`, `contracts`. При росте данных (10k+ записей) это критично.

**Решение — добавить индексы и pg_trgm:**
```sql
-- Миграция: индексы для поиска
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX idx_contacts_full_name_trgm
  ON contacts USING GIN(full_name gin_trgm_ops);

CREATE INDEX idx_contacts_phone_trgm
  ON contacts USING GIN(phone gin_trgm_ops);

CREATE INDEX idx_properties_title_trgm
  ON properties USING GIN(title gin_trgm_ops);

CREATE INDEX idx_properties_address_trgm
  ON properties USING GIN(address gin_trgm_ops);
```

После этого `ilike '%query%'` будет использовать GIN-индекс вместо seq scan.

---

### 11. Нет `.env` валидации при старте

**Проблема:** Если `NEXT_PUBLIC_SUPABASE_URL` или `NEXT_PUBLIC_SUPABASE_ANON_KEY` пустые — приложение упадёт с криптичной ошибкой в рантайме, а не при старте.

**Решение:**
```typescript
// src/lib/env.ts
function requireEnv(key: string): string {
  const value = process.env[key]
  if (!value) throw new Error(`Missing required environment variable: ${key}`)
  return value
}

export const env = {
  supabaseUrl: requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
  supabaseAnonKey: requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
} as const
```

---

### 12. Analytics page — 444 строки в одном файле

**Проблема:** `analytics/page.tsx` — монолитный Server Component на 444 строки с 8 параллельными запросами и встроенной логикой обработки данных. Нарушает Single Responsibility.

**Рефакторинг:**
```
src/features/analytics/
├── data/
│   ├── getMonthlyDeals.ts    ← отдельная функция + cache
│   ├── getFunnelData.ts
│   ├── getPaymentsData.ts
│   └── index.ts              ← Promise.all экспорт
├── components/
│   └── AnalyticsCharts.tsx   ← уже есть ✓
└── utils/
    └── formatters.ts         ← formatMoney, monthLabel
```

---

## Долгосрочные улучшения (P3)

### 13. Нет тестов

**Проблема:** 0 тестов на 96 компонентов и 13 action-модулей. Критичные бизнес-операции (создание сделки, расчёт платежей, генерация договора) работают без страховки.

**Минимальный план по скилу `test-master`:**

| Что тестировать | Тип теста | Приоритет |
|---|---|---|
| Server Actions (deals, payments, contracts) | Unit (Vitest) | Высокий |
| Расчёт комиссии и сумм | Unit | Высокий |
| Kanban drag-and-drop | Integration | Средний |
| Auth flow (login → dashboard) | E2E (Playwright) | Средний |
| XML-экспорт Avito/CIAN | Unit | Средний |

```bash
npm install --legacy-peer-deps vitest @vitejs/plugin-react @testing-library/react @testing-library/user-event
```

---

### 14. Нет rate limiting на Server Actions

**Проблема:** Actions вроде `createContactAction`, `createDealAction` не имеют защиты от флуда. Злоумышленник может создать тысячи записей за секунды.

**Решение через Upstash Redis + @upstash/ratelimit:**
```typescript
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '1 m'), // 10 req/min per user
})

// В actions:
const { success } = await ratelimit.limit(user.id)
if (!success) return { error: 'Слишком много запросов. Подождите минуту.' }
```

---

### 15. Нет мониторинга ошибок

**Проблема:** `console.error` — единственный способ логирования (3 вхождения). Ошибки на Vercel видны только в логах, нет алертов.

**Решение:** интеграция Sentry:
```bash
npx @sentry/wizard@latest -i nextjs --saas
```

После этого все необработанные ошибки в Server Actions и Client Components автоматически попадают в Sentry с контекстом.

---

### 16. Внешние изображения без `next/image` домена

**Проблема:** В `properties/page.tsx` используются Unsplash URL как плейсхолдеры. `next.config.ts` не объявляет разрешённые домены для `next/image`.

**Решение:**
```typescript
// next.config.ts
const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: false },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: '*.supabase.co' }, // storage
    ],
  },
}
```

---

## Дорожная карта

```
Неделя 1 — Критические (P0)
  ✦ middleware.ts — защита роутов
  ✦ Zod-схемы для contacts + deals actions
  ✦ Исправить search: clients → contacts

Неделя 2 — Высокий приоритет (P1)
  ✦ loading.tsx + error.tsx для dashboard layout
  ✦ unstable_cache для analytics
  ✦ Проверить RLS contacts/deals/deal_comments
  ✦ Мигрировать формы на useActionState

Неделя 3 — Средний приоритет (P2)
  ✦ GIN-индексы pg_trgm для поиска
  ✦ env.ts — валидация переменных
  ✦ Явный select вместо select('*') в листингах
  ✦ Рефакторинг analytics/page.tsx

Неделя 4+ — Долгосрочное (P3)
  ✦ Vitest — первые тесты для actions
  ✦ Sentry мониторинг
  ✦ Rate limiting через Upstash
  ✦ next/image remotePatterns
```

---

## Сводная таблица

| # | Проблема | Приоритет | Сложность | Влияние |
|---|---|---|---|---|
| 1 | Нет middleware — маршруты открыты | 🔴 P0 | Низкая | Безопасность |
| 2 | ~~Нет Zod-валидации в actions~~ | ✅ Done | Средняя | Безопасность + DX |
| 3 | ~~Search uses legacy clients~~ | ✅ Done | Низкая | Данные |
| 4 | ~~Нет loading/error страниц~~ | ✅ Done | Низкая | UX |
| 5 | ~~Нет кэширования~~ | ✅ Done | Средняя | Производительность |
| 6 | ~~useActionState не используется~~ | ✅ Done | Средняя | DX + UX |
| 7 | ~~RLS public→authenticated~~ | ✅ Done | Низкая | Безопасность |
| 8 | Ручные типы вместо генерации | 🟡 P2 | Средняя | Надёжность |
| 9 | ~~select('*') в листингах~~ | ✅ Done | Низкая | Производительность |
| 10 | ~~Нет GIN-индексов для поиска~~ | ✅ Done | Средняя | Производительность |
| 11 | ~~Нет env-валидации~~ | ✅ Done | Низкая | DX |
| 12 | ~~Analytics page монолит~~ | ✅ Done | Средняя | Maintainability |
| 13 | Нет тестов | 🔵 P3 | Высокая | Надёжность |
| 14 | Нет rate limiting | 🔵 P3 | Средняя | Безопасность |
| 15 | Нет мониторинга (Sentry) | 🔵 P3 | Низкая | Observability |
| 16 | next/image без remotePatterns | 🔵 P3 | Низкая | Конфигурация |
