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

### 8. Типизация Database = any — ✅ сделано 02.09.2026

**Было:** `export type Database = any` плюс 19 ручных интерфейсов при 50 таблицах в базе.
Больше половины схемы не описана вообще, а `any` отключал проверку типов во всех запросах
к Supabase.

**Стало:** `src/types/supabase.ts` генерируется из живой схемы (53 таблицы),
`npm run db:types` — перегенерация. В `src/types/database.ts` остались доменные union'ы
(`UserRole`, `ContractType`, …) и хелперы `Row<'deals'>` / `Insert<'contacts'>` /
`Update<'showings'>`.

**Что это сразу нашло** — три поломки, невидимые для `tsc` и `next build`, пока схема
была `any`:

- история версий договоров не сохранялась при редактировании (писали несуществующую
  колонку `organization_id` в `contract_versions`, ошибку не проверяли);
- второй шаг онбординга не сохранял ничего (слали `company_type`, колонка —
  `legal_form`);
- заведение сотрудника падало всегда (см. задачу 19).

**Хвост:** 208 `any` в коде остались — они теперь не нужны, но сами не исчезнут, см.
задачу 21.

---

### 19. Приглашение сотрудников не реализовано

**Проблема:** форма `/employees/new` вызывает `createEmployeeAction`, которая делала
`insert` в `public.users` без `id`. Колонка — NOT NULL без DEFAULT и внешний ключ на
`auth.users(id)`, поэтому вставка падала **всегда**: сотрудника через интерфейс завести
было нельзя, пользователь видел сырую ошибку Postgres. Найдено 02.09.2026 генерацией
типов — с `Database = any` ни `tsc`, ни `next build` этого не видели.

Сейчас действие возвращает понятное объяснение вместо заведомо падающей вставки.

**Решение:** приглашение через Supabase Admin API с service-role ключом —
`inviteUserByEmail(email)`, затем проставить роль и `organization_id` в строке, которую
создаст триггер `handle_new_user`. Отдельный API-роут, ключ только на сервере.

---

### 20. ESLint не работает

**Проблема:** `npm run lint` падает целиком: `typescript-eslint does not support TS 7.0`
(в проекте TypeScript 7.0.2). То есть линтера в проекте фактически нет — и это объясняет,
откуда взялись 108 подавлений `no-explicit-any`: их никто не проверял.

**Решение:** дождаться поддержки TS 7 в typescript-eslint (issue #10940) либо
зафиксировать TypeScript 6 до неё. В `npm run check` шага lint нет, так что на пуш это
не влияет — но и пользы от конфига сейчас ноль.

---

### 21. Остаток `any` после генерации типов — 130 из 208

**Проблема:** типы схемы больше не `any`, но написанные раньше `as any` и подавления
линтера сами собой не исчезли — было 208 штук в 50 файлах. Теперь почти все они не
нужны: под ними лежит точный тип.

**Ход:** 03.09.2026 при пересборке вокруг направлений сняты все `any` из тронутых
файлов — 208 → 130 в 34 файлах. Снятие обнажило два настоящих бага, которые
компилятор не видел именно из-за кастов:

- восстановление версии договора писало `updated_at`, а такой колонки у `contracts`
  нет — PostgREST отвергал запрос, и функция **не работала вовсе**;
- в карточке сделки в разметку уходил `href={null}` для файлов без ссылки.

Это лучший аргумент за то, чтобы долг снимать: каждый `any` прячет не стиль, а ошибку.

**Решение:** снимать попутно — трогаешь файл под задачу, убираешь оттуда `any` и
переснимаешь baseline (`npm run check:any:baseline`). Ратчет `check:any` не даёт числу
расти, так что долг может только уменьшаться.

---

### 22. E2E: `/search` падает с net::ERR_ABORTED

**Проблема:** в `e2e/smoke-prod.spec.ts` тест «все страницы кабинета открываются без
ошибок» валится на `/search`: `page.goto: net::ERR_ABORTED`. Проверено 02.09.2026 —
воспроизводится и на чистом `main`, к генерации типов отношения не имеет.

Сервер при этом отдаёт **200** (видно в логах dev-сервера), то есть страница рендерится.
Обрывается именно клиентская навигация — похоже, что-то на странице сразу инициирует
второй переход (кандидат — поле поиска в `Header.tsx`, оно держит `useRouter`).

**Решение:** воспроизвести руками с открытой консолью, найти источник повторной
навигации. Если это ожидаемое поведение — в тесте использовать `waitUntil: 'commit'`
вместо дефолтного ожидания для этого маршрута.

---

### 20. ESLint не работает — 🔵 заблокировано апстримом

Проверено 02.09.2026: последняя стабильная `typescript-eslint` 8.69.0 (и 8.68.0,
которая стоит транзитивно через `eslint-config-next`) содержит жёсткий отказ
`if (versionMajor >= 7) throw` — в проекте TypeScript 7.0.2, поэтому `npm run lint`
падает на загрузке конфига.

Обходных путей без ущерба нет: даунгрейд TypeScript до 6 ради линтера — плохой размен,
а подмена резолвинга `typescript` только для процесса ESLint хрупка.

**Условие разблокировки:** релиз typescript-eslint с поддержкой TS 7
(отслеживается в их issue #10940). Тогда — обновить и прогнать `npm run lint`
по всему коду, накопившийся долг разбирать отдельно.

На `npm run check` не влияет: шага lint там нет, проверки проекта живут в
`scripts/checks/*`.

---

### 21. Оставшиеся `any` — не механическая замена

Попытка 02.09.2026: снятие `as any` и подавлений линтера по всему коду (24 файла)
уменьшает счётчик 208 → 104, но вскрывает **67 ошибок типов**, из них 26 вида
«свойство не существует». То есть приведения прятали не только шум: часть кода
обращается к полям, которых на реальном типе нет — вероятно, к полям встроенных
через PostgREST связей, которые генератор выводит иначе.

Разбор требует решения по каждому месту, механической заменой не берётся —
попытка откачена, чтобы не оставлять половину.

**Как подходить:** по одному файлу за раз, вместе с задачей, которая его и так
трогает. Снять приведения → `npx tsc --noEmit` → разобрать вскрывшееся →
`npm run check:any:baseline`. Ратчет не даёт числу расти, так что долг только убывает.

---

### 23. Счётчики на карточке сотрудника показывали 0 — ✅ 02.09.2026

`.select('id', { count: 'exact', head: true })` возвращает число в `count`, а `data`
при этом **всегда** null. Код читал `data?.length`, поэтому «Клиентов», «Сделок»,
«Договоров» и «Задач» на карточке сотрудника показывали 0 при любых реальных данных.
Найдено при отвязке от legacy-таблиц (задача 17).

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
| 1 | ~~Нет middleware — маршруты открыты~~ | ✅ Done | Низкая | Безопасность |
| 2 | ~~Нет Zod-валидации в actions~~ | ✅ Done | Средняя | Безопасность + DX |
| 3 | ~~Search uses legacy clients~~ | ✅ Done | Низкая | Данные |
| 4 | ~~Нет loading/error страниц~~ | ✅ Done | Низкая | UX |
| 5 | ~~Нет кэширования~~ | ✅ Done | Средняя | Производительность |
| 6 | ~~useActionState не используется~~ | ✅ Done | Средняя | DX + UX |
| 7 | ~~RLS public→authenticated~~ | ✅ Done | Низкая | Безопасность |
| 8 | ~~Ручные типы вместо генерации~~ — `src/types/supabase.ts`, 53 таблицы | ✅ Done | Средняя | Надёжность |
| 9 | ~~select('*') в листингах~~ | ✅ Done | Низкая | Производительность |
| 10 | ~~Нет GIN-индексов для поиска~~ | ✅ Done | Средняя | Производительность |
| 11 | ~~Нет env-валидации~~ | ✅ Done | Низкая | DX |
| 12 | ~~Analytics page монолит~~ | ✅ Done | Средняя | Maintainability |
| 13 | ~~Нет тестов~~ — Vitest, 15 файлов | ✅ Done | Высокая | Надёжность |
| 14 | ~~Нет rate limiting~~ — Upstash Redis | ✅ Done | Средняя | Безопасность |
| 15 | ~~Нет мониторинга (Sentry)~~ | ✅ Done | Низкая | Observability |
| 16 | ~~next/image без remotePatterns~~ | ✅ Done | Низкая | Конфигурация |
| 17 | ~~Legacy `clients`/`owners`~~ — код отвязан, таблицы удалены 02.09.2026 | ✅ Done | Средняя | Данные |
| 18 | Три источника приоритетов расходились | ✅ Done | Низкая | Процесс |
| 19 | ~~Приглашение сотрудников~~ — inviteUserByEmail + organization_members | ✅ Done | Средняя | Функциональность |
| 20 | ESLint не работает: typescript-eslint не поддерживает TS 7 | 🔵 Заблокировано | Низкая | Качество |
| 21 | Остаток `any` после генерации типов — 130 из 208 | 🟡 P2 | Высокая | Надёжность |
| 22 | ~~E2E: `/search` падает~~ — гонка после маршрута-редиректа | ✅ Done | Низкая | Тесты |
| 23 | ~~Счётчики на карточке сотрудника показывали 0~~ | ✅ Done | Низкая | Данные |
| 24 | ~~Колонки client_id/owner_id остались без FK~~ — пустые, вычистить при случае | 🟡 P2 | Низкая | Схема |
| 25 | ~~15 неиспользуемых зависимостей (Radix ×11, @dnd-kit ×3, @stripe/stripe-js)~~ | ✅ Done | Низкая | Вес сборки |
| 26 | ~~Словари подписей копировались по 25 файлам~~ — единый источник в config | ✅ Done | Средняя | Консистентность |
| 27 | ~~Лимиты тарифов не применяются~~ — подписка удалена целиком 04.09.2026 | ✅ Снято | Низкая | Биллинг |
| 28 | ~~Два словаря статусов лида: фантомный `in_work`, лиды пропадали с доски~~ | ✅ Done | Средняя | Данные |
| 29 | Телеграм-подсистема 3 749 строк — второй интерфейс CRM, решение отложено | 🔵 Решение | Высокая | Продукт |
| 30 | База знаний устареет: нет правила и никто не следит за актуальностью | 🟡 P2 | Средняя | Процесс |

> **Сверено с кодом 02.09.2026.** Пункты 1, 13–16 были помечены открытыми, хотя давно
> сделаны: `middleware.ts` есть в корне, тесты гоняются в `npm run check`, Upstash
> подключён, Sentry в зависимостях, `remotePatterns` в `next.config.ts`.
> **Этот файл — единственный источник приоритетов.** `docs/ROADMAP.md` — только
> долгосрочные фазы, `docs/WORKFLOW.md` — только процесс; своих списков «что делать
> дальше» они больше не держат.

### #17 — Legacy `clients` / `owners` — ✅ закрыто 02.09.2026

Код больше не обращается к этим таблицам ни разу. Что сделано:

- `contracts/page.tsx` — запасной путь через `clients` убран: договоров со ссылкой
  `client_id` без `client_contact_id` в базе **0**, имена берутся из `contacts`;
- `employees/[id]/page.tsx` — счётчик клиентов считает `contacts` (заодно починены
  все четыре счётчика, см. задачу 23);
- `features/clients/actions/clients.actions.ts` — удалён, `deleteClientAction`
  нигде не вызывался;
- `files.actions.ts` и `GlobalSearch` — пути ревалидации и быстрое действие
  «Новый клиент» переведены на `/contacts`.

**Страницы `src/app/(dashboard)/clients/` оставлены.** Это не легаси-модуль, а четыре
редирект-заглушки на `/contacts`, и они покрыты тестом
`e2e/payments-permissions.spec.ts` — при попытке удалить их он краснеет. Старые
ссылки и закладки должны продолжать работать.

Данных для миграции не было: в `owners` 0 строк, в `clients` одна, и она уже есть
в `contacts`.

**Таблицы удалены 02.09.2026** с явного подтверждения Руслана — миграции
`20260902_backfill_contacts_from_legacy_clients.sql` и
`20260902_drop_legacy_clients_and_owners.sql`.

Перед удалением перенесены три поля, которых не было в `contacts`: `telegram`,
`comment`, `manager_id`. Паспорт переносить не потребовалось — в `contacts` он уже
разложен по полям и дополнен. Копия удалённой строки сохранена в тексте миграции.

**Что вскрылось при удалении:** проверка «код не обращается к таблицам» была
неполной — грепался `from('clients')`, а PostgREST-встраивание выглядит как
`client:clients(...)` внутри `select`. Таких мест нашлось четыре: страница
генерации договора, карточка договора, список и карточка сделки. Три из них
`tsc` не видел, потому что результат приводился к `any` — наглядная цена
приведений из задачи 21. Все убраны, рядом везде уже был `client_contact`
из `contacts`.

Добавлен `e2e/detail-pages.spec.ts`: smoke-набор ходил только по статическим
маршрутам, и сломанный embed на карточках не поймал бы никто.

### #8 — Ручные типы вместо генерации — ✅ закрыто 02.09.2026

`src/types/supabase.ts` генерируется из схемы (53 таблицы), `Database = any` убран.
Подробности и что это вскрыло — в разделе 8 выше. Хвост из 208 приведений — задача 21.

---

### #25–#29 — Ponytail-аудит на over-engineering — 02.09.2026

Прогон скилла `ponytail-audit` по всему дереву. **Сделано в тот же день:**

- **Удалено 15 зависимостей** (6.6 МБ в `node_modules`): 11 пакетов `@radix-ui/*`,
  3 пакета `@dnd-kit/*`, `@stripe/stripe-js` — ни одного импорта в коде. Kanban
  всё это время работал на нативном HTML5 drag-and-drop, а не на @dnd-kit;
  `CLAUDE.md`, `README.md` и мотивировка в `guard-bash.mjs` утверждали обратное.
- **Мёртвый код:** `DealStatusSelector.tsx` целиком, компонент `Button`
  (импортировался только `buttonVariants`), `checkLimit`, `sendDailyDigestEmail`,
  `clearPaymentScheduleAction`, `fetchAvitoItemStatus`, `sendAvitoMessage`,
  `createUnauthorizedMock`, 4 неиспользуемых интерфейса в `types/database.ts`.
- **Словари подписей** типов и статусов сделки, типов и статусов объекта больше не
  копируются: 12 файлов импортируют `DEAL_TYPE_LABELS`/`DEAL_STATUS_LABELS` из
  `features/deals/config/deal-stages.ts` и `PROPERTY_*` из
  `features/properties/config/property-labels.ts`.
- **Палитра графиков:** три компонента recharts и страница аналитики перешли на
  константы `CHART*` из `lib/design/chartColors.ts` — исчезли яркий `#22D3EE`,
  `#0891B2` и радиусы 10/12 у тултипов. Нарушений визуального стандарта стало
  95 вместо 134.
- **Модалки на нативном `<dialog>`:** `QuickCreateModal` (фокус-трап, Esc и inert
  теперь от браузера), формы API-ключа и вебхука переиспользуют его вместо своих
  оверлеев, `GlobalSearch` тоже на `<dialog>`.
- **Почта:** `email/notify.ts` схлопнут в `email/send.ts`, копии `formatMoney` и
  `formatDate` заменены на `@/lib/utils` (туда же добавлена защита от Invalid Date).
- **Авторизация:** появился `getSessionContext()` в `lib/org.ts` — связка
  клиент+пользователь+организация. 13 экшенов с полной шестистрочной преамбулой
  переведены на него.

**Осталось решить:**

- ~~**#27 Лимиты тарифов не применяются.**~~ — ✅ снято 04.09.2026 вместе со всей
  подпиской на CRM. Решение владельца: до масштабирования подписка не нужна,
  сделают заново, когда появятся сторонние агентства.

  Удалено: `src/lib/feature-gates.ts` (`PLAN_LIMITS`, `getFeatureGate`, названия и
  цены тарифов), страница `/settings/billing` с её клиентским блоком, три роута
  (`/api/billing/checkout`, `/api/billing/portal`, `/api/stripe/webhook`), пакет
  `stripe`, пункт меню в настройках, публичные префиксы в `middleware.ts` и
  маршрут в смоук-тесте.

  **Оставлено намеренно:** колонки `plan`, `stripe_customer_id`,
  `stripe_subscription_id`, `subscription_status`, `trial_ends_at` в
  `organizations`. `DROP COLUMN` заблокирован хуком, и это правильно: колонки
  пустые, никому не мешают, а при возврате подписки пригодятся. Секреты
  `STRIPE_SECRET_KEY` и `STRIPE_WEBHOOK_SECRET` в окружении Vercel можно убрать
  руками — код их больше не читает.
- ~~**#28 Два словаря статусов лида.**~~ — ✅ закрыто 02.09.2026, разбор ниже.
- **#29 Телеграм-подсистема.** 1 182 строки роута + 2 567 строк `lib/telegram/`:
  LLM-агент с 23 тулами, меню CRM со своими копиями словарей, генератор постов
  в канал. Второй продуктовый интерфейс рядом с веб-CRM. Разбор отложен
  сознательно — до решения телеграм-файлы не трогали.

**Сознательно не тронуто:**

- Словари публичного сайта (`features/site/lib/labels.ts`) — там своя формулировка
  («Доверительное управление» вместо «Управление»), это другая аудитория.
- `dealTypeLabels` на карточке лида с «Покупка» вместо «Продажа» — намеренное
  расхождение: у лида это намерение клиента.
- `ContractStatusSelector` — это не модалка, а выпадающий список; `<dialog>` ему
  не подходит.
- `docs/ROADMAP.md` (1 313 строк) не сокращали: что там устарело, а что нет —
  вопрос к владельцу продукта, а не к аудиту кода.

---

### #28 — Статусы лида: один словарь вместо шести — ✅ 02.09.2026

Словарь статусов лида был скопирован в шести местах и разъехался **по составу
ключей**, а не только по формулировкам. Настоящий словарь — тот, что пропускает
`updateLeadStatusAction`: `new · contacted · showing · searching · interested ·
converted · closed · rejected`. Четыре бага из одного расхождения:

1. **Плашка «В работе» на `/leads` всегда показывала 0** — считалась по
   `status === 'in_work'`, которого не пишет ни один экшен (в базе таких строк нет
   и не было).
2. **Фильтр «В работе» всегда отдавал пустой список** — по той же причине.
   Заодно в фильтре не было половины реальных статусов: `contacted`, `showing`,
   `searching`, `interested`, `closed` выбрать было нельзя.
3. **Реестр показывал статус латиницей.** Словарь подписей знал 4 ключа, фолбэк —
   `statusLabels[status] ?? status`, то есть лид со статусом `contacted` рисовал
   бейдж «contacted». Не всплывало только потому, что все лиды сейчас в `new`.
4. **Канбан терял лиды.** Колонок было 6 на 8 статусов: лид с `interested` или
   `rejected` не попадал ни в одну колонку и **исчезал с доски**. При этом
   `interested` ставится автоматически — `showings.actions.ts` переводит в него лид
   по результату показа. То есть отметил показ успешным — лид пропал с канбана.

**Как теперь.** `src/features/leads/config/lead-statuses.ts` — единственный
источник: `LEAD_STATUSES` (значение, подпись, подпись колонки, оформление),
производные `LEAD_STATUS_VALUES` (ими же валидирует экшен), `LEAD_STATUS_LABELS`,
`LEAD_STATUS_BADGE`, `LEAD_STATUSES_IN_WORK`, `LEAD_STATUSES_TERMINAL`. Из него
живут канбан (колонка на каждый статус — потерять лид больше нечем), фильтры,
реестр, карточка, селектор статуса и серверная валидация. `in_work` удалён из
кода. «В работе» = `contacted + showing + searching + interested`. Кнопка
«→ Контакт» на доске скрыта во всех терминальных колонках, а не только в двух.

Проверено на живых данных: канбан отдаёт все 8 колонок, карточка закрытого лида
показывает «Закрыт» и селектор из восьми русских подписей.

**Не тронуто:** свои копии словаря статусов лида в `lib/telegram/crm-menu.ts` —
телеграм-подсистема разбирается отдельно (#29).

---

### 30. Кто ведёт базу знаний — 🟡 P2

**Задача от 02.09.2026: придумать правило или агента.**

**Проблема.** Раздел «База знаний» наполнен справочником из `docs/handbook/`,
но у него нет хозяина. Через несколько правок интерфейса статьи начнут врать —
ровно так же, как врал футер с зашитой «v1.0.0» при `"version": "0.1.0"`, и как
разъезжались словари статусов, пока у них не появился единый источник.
Инструкция, которая врёт, хуже отсутствующей: по ней сотрудник делает не то и
перестаёт ей верить.

Отдельная сложность: статьи живут **в двух местах** — файлы `docs/handbook/`
(источник для NotebookLM и для истории правок) и строки `knowledge_articles`
в базе (то, что читают сотрудники). Правка в интерфейсе не возвращается в
репозиторий, правка в файлах не доезжает до базы без `npm run seed:handbook`.
Расхождение — вопрос времени.

**Что нужно решить.**

1. **Направление синхронизации.** Файлы — источник правды, а интерфейс только
   читает? Или база — источник, а файлы выгружаются из неё? Двусторонняя
   синхронизация без конфликтов не делается, надо выбрать одно.
2. **Как ловить устаревание.** Варианты по возрастанию жёсткости:
   - правило в `CLAUDE.md` — слабое, соблюдается по настроению (так уже было
     с проверкой перед пушем, пока не появился `guard-bash`);
   - хук, который при изменении раздела (`src/app/(dashboard)/leads/**`)
     требует тронуть соответствующую главу — по аналогии со `stop-readme`;
   - агент, который после изменений сам перечитывает раздел и предлагает
     правку статьи — дороже, но не требует дисциплины от человека.
3. **Кто отвечает у клиента.** В самой CRM: напоминание владельцу статьи, если
   её не трогали N месяцев, — задача с дедлайном на автора.

**Критерий готовности.** Изменение поведения раздела CRM не может уехать в прод
так, чтобы инструкция осталась старой и никто об этом не узнал.

**Не делать наспех.** Хук, который требует править главу на каждое касание кода,
быстро научатся обходить пустой правкой — как это происходит с любой проверкой,
которую нельзя выполнить осмысленно за секунду.
