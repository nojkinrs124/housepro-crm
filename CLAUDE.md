# HousePro CRM — правила проекта

Здесь только то, что нужно **всегда**. Процедуры — в skills, планы и история — в `docs/`,
жёсткие запреты — в hooks (см. «Что проверяется автоматически»).

## Стек

Next.js 16 · React 19 · TypeScript · Tailwind v4 (только через postcss, без конфига
классов) · Supabase (Postgres + Auth + Storage) · react-hook-form + zod ·
docxtemplater + pizzip (DOCX) · pdf-lib (PDF) · recharts (графики) · sonner ·
framer-motion · lucide-react · Upstash Redis (rate limit) · Stripe · Sentry ·
vitest (юнит) + Playwright (E2E).

Библиотеки компонентов в проекте нет: `src/components/ui/` — два своих файла,
Radix и shadcn удалены (не использовались). Kanban — на нативном HTML5
drag-and-drop (`onDragStart`/`onDrop`), без @dnd-kit.

Точные версии — в `package.json`, дублировать их сюда не нужно: расходятся быстрее,
чем обновляются.

```
Supabase:  https://zwclvcswvhjeqwxrkbte.supabase.co  (ref zwclvcswvhjeqwxrkbte)
GitHub:    https://github.com/nojkinrs124/housepro-crm
Прод:      https://housepro24.vercel.app
Admin ID:  508499ac-0268-49c7-9c31-8198deafeeda
```

Работаем в текущем чекауте — клонировать репозиторий заново не нужно.

---

## Server Components — граница, которую нельзя нарушать

Нарушение = Runtime Error в проде, который **не ловят ни `tsc`, ни `next build`**
(страницы с `force-dynamic` или `cookies()` во время сборки не выполняются).

```tsx
// ❌ файл без 'use client' — никаких onClick/onChange/onSubmit/onDrag,
//    никаких useState/useEffect/useTransition
export default function Page() {
  return <button onClick={() => {}}>Click</button>   // ОШИБКА
}

// ✅ Server Component — только данные и разметка
import { DeleteButton } from './DeleteButton'
export default async function Page() {
  const data = await fetchData()
  return <DeleteButton id={data.id} />
}
```

Любая интерактивность → отдельный файл с `'use client'` наверху.

Обратное направление тоже запрещено: **функцию нельзя передать пропом** из
Server Component в клиентский — RSC-payload её не сериализует и падает весь
рендер страницы, в проде это «Minified React error #441» без указания места.
Исключение — Server Action в `action`/`formAction`. Вместо колбэка передавать
сериализуемое: строку-шаблон, объект, массив (образец — `hintTemplate` в
`src/components/forms/DadataSuggestInput.tsx`).

Из файла с `'use client'` серверный код может рендерить только PascalCase-компонент
как JSX. **Обычную функцию оттуда импортировать нельзя** — вызов с сервера падает в
рантайме. Чистые типы и функции выносить в файл без `'use client'`; образец —
`src/features/contracts/utils/rent-apartment-data.ts`.

---

## Supabase — минимум

```ts
// Server Component / Server Action
import { createClient } from '@/lib/supabase/server'
const supabase = await createClient()      // ← await обязателен

// Client Component — ДРУГОЙ путь
import { createClient } from '@/lib/supabase/client'
const supabase = createClient()            // ← без await
```

- Изменение схемы — **только `apply_migration`**, никогда `execute_sql` (заблокировано хуком).
  Подробности, шаблоны RLS и PostgREST-хинты — skill `housepro-migration`.
- Актуальный список таблиц — через MCP `list_tables`, а не по памяти.
- Прямые HTTP-запросы к `api.supabase.com` заблокированы — только MCP-коннектор.

Ключевые сущности: `contacts` (единые клиенты и собственники, поле `role`:
`client | owner | both`; `client_type`: `individual | legal_entity`, у юрлица —
`company_name/inn/kpp/ogrn/legal_address/…` и представители в
`contact_representatives`), `leads`, `deals`, `properties`, `contracts`, `payments`,
`tasks`, `showings`, `property_collections`, `organizations` + `organization_members`.
`clients` и `owners` — больше нет: код отвязан, таблицы удалены 02.09.2026
(`list_tables` их не показывает). Остались только пустые колонки-ссылки
`client_id`/`owner_id` в `tasks`/`deals` — вычистить при случае, задача #24
в `docs/IMPROVEMENTS.md`.

Мультиарендность: каждая запись несёт `organization_id`, изоляция в RLS через
`get_user_org_id()`.

---

## Server Action — шаблон

```ts
'use server'
export async function createThingAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const orgId = await requireOrgId().catch(() => null)
  if (!orgId) return { error: 'Организация не найдена' }

  const rl = await rateLimitCreate(user.id, 'thing')     // ← await обязателен
  if (!rl.success) return { error: 'Слишком много запросов' }

  const parsed = ThingSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { data, error } = await supabase
    .from('things')
    .insert({ ...parsed.data, organization_id: orgId, created_by: user.id })
    .select('id').single()
  if (error) return { error: error.message }

  revalidatePath('/things')
  redirect(`/things/${data.id}`)
}
```

Дубль имени функции в `*.actions.ts` валит сборку Turbopack («the name X is defined
multiple times») — ловится хуком на правку, помнить не нужно.

---

## TypeScript

```ts
const data: any = {}                                  // ❌ в новом коде
import type { Contact, Deal } from '@/types/database' // ✅
```

Схема БД — **сгенерирована**, `src/types/supabase.ts` руками не править.
Перегенерация после каждой миграции обязательна — порядок в skill
`housepro-migration` (из сессии — MCP `generate_typescript_types`, с машины —
`npm run db:types`). В `src/types/database.ts` живут доменные union'ы и хелперы
поверх схемы:

```ts
import type { Row, Insert, Update } from '@/types/database'
const deal: Row<'deals'> = …                 // строка таблицы
const payload: Update<'showings'> = { … }    // вместо Record<string, unknown>
```

Тип честно неизвестен — `unknown` с сужением, а не `any`.

**Про 208 оставшихся `any`:** это хвост от старой заглушки `Database = any`; теперь
под ними лежит точный тип, и они не нужны. Снимаем попутно — тронул файл, убрал оттуда
`any`, переснял `npm run check:any:baseline`. Ратчет `check:any` не даёт числу расти
(задача #21 в `docs/IMPROVEMENTS.md`).

**ESLint в проекте сейчас не работает** — `typescript-eslint` не поддерживает TS 7
(задача #20). На `npm run check` это не влияет, но и не рассчитывать на него.

---

## Дизайн — «Кабинет», короткая версия

Полный гайд и шаблоны страниц — **skill `housepro-ui`**. Всегда действуют:

1. Цвет только через токены `var(--hp-*)` из `globals.css` — никакого хардкода хекса
   и никакой палитры Tailwind (`bg-blue-500`, `text-slate-600`).
2. Теней нет. Форму карточки задаёт `border border-[var(--hp-border)]`.
3. Радиус один и равен 0 (`rounded-[var(--hp-radius)]`), аватары квадратные.
   `rounded-full` — только точки-статусы, полоски прогресса, спиннеры.
4. Акцент плоский `var(--hp-accent)` — без градиентов.
5. Hover — только смена цвета границы/фона. Без `translate`, `scale`, `shadow`.
6. Карточка: `bg-[var(--hp-surface)] border border-[var(--hp-border)] p-5`.
7. Поля форм: `h-10 px-4`, фокус `focus:border-[var(--hp-ink)]` (не `ring`) —
   или готовые `.hp-input` / `.hp-label`.
8. Секции «лейбл/значение» — `.hp-block` + `.hp-block-row`, не мини-карточка на поле.
9. Бейджи — `.hp-badge hp-badge-{good|warn|info|danger|neutral}`; `danger` только для
   тревожного, «неактивный» — это `neutral`.
10. Сетки только с breakpoint (`grid-cols-1 sm:grid-cols-2`), группы кнопок —
    `flex-wrap shrink-0`, `space-y-6` на корне страницы.

Шрифты: Source Sans 3 (интерфейс) + Source Serif 4 (заголовки, глобально на теге).
Моно-шрифта нет. Не заменять на Public Sans/Archivo/Sora — у них нет кириллицы.

---

## Что проверяется автоматически

Эти правила больше не нужно держать в голове — они не дадут себя нарушить
(`.claude/settings.json` → `.claude/hooks/`):

| Хук | Что делает |
|---|---|
| `guard-bash` | блокирует `git push` без зелёного `npm run check` на **текущем** коде; секреты и PAT в командной строке; `npm install` без `--legacy-peer-deps` и запрещённые пакеты (`axios`, `react-query`, второй drag-and-drop) |
| `guard-sql` | блокирует DDL через `execute_sql` — только `apply_migration` |
| `guard-migration` | блокирует `DROP TABLE` / `TRUNCATE` / `DROP COLUMN` через `apply_migration` — единственный путь к потере боевых данных |
| `post-edit` | на каждую правку: визуальный стандарт, новые `any`, границы client/server, дубль имени в actions, `force-dynamic` в GET-роутах, частота кронов |
| `session-start` | ветка, незакоммиченное, статус проверки, открытые пункты бэклога |
| `stop-readme` | напоминает обновить README, если появился новый модуль |

`npm run check` гоняет по порядку: tsc → event handlers → границы client/server →
функции-пропы → правила серверного слоя → `any` → визуальный стандарт → кроны →
build → тесты. **Шаги не нумеруются** — номера разъезжались по документам, ссылаться
на шаг по названию.

Отдельно: `check:design`, `check:boundary`, `check:cron`, `check:server`, `check:any`.
Переснять baseline после чистки легаси — `check:design:baseline`, `check:any:baseline`.

---

## Указатель

| Нужно | Где |
|---|---|
| Создать страницу/форму/карточку | skill `housepro-ui` |
| Изменить схему БД, RLS, PostgREST | skill `housepro-migration` |
| Пуш, релиз, E2E | skill `housepro-release` |
| Новый модуль целиком | skill `housepro-new-module` |
| Правила API routes | `src/app/api/CLAUDE.md` |
| Правила actions/components | `src/features/CLAUDE.md` |
| Что делать дальше, приоритеты | `docs/IMPROVEMENTS.md` — единственный бэклог |
| Как мы работаем, красные флаги | `docs/WORKFLOW.md` |
| Что происходило в прошлых сессиях | `docs/JOURNAL.md` (хроника, не правила) |
| Долгосрочные фазы SaaS | `docs/ROADMAP.md` (статус сверять с кодом) |
| Интеграции: почта, карты, площадки, подпись | `docs/INTEGRATIONS.md` |
| История редизайнов, дизайн-долг | `docs/DESIGN_SYSTEM_AUDIT.md` |
| Что умеет система | `README.md` |

Как работать с Русланом — в `~/.claude/CLAUDE.md`, он грузится в каждой сессии.
Здесь не дублировать.
