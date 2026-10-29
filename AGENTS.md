# HousePro CRM — правила проекта (Hermes Agent)

Здесь только то, что нужно **всегда**. Процедуры — в skills `housepro-*`
(`.hermes/skills/`), планы и история — в `docs/`, жёсткие запреты — в хуках
(`scripts/agent-hooks/`, подключаются в `~/.hermes/config.yaml`).

Этот файл — единственный источник правил: `CLAUDE.md` удалён 29.10.2026, проект
ведётся в Hermes Agent, а не в Claude Code.

## Стек

Next.js 16 · React 19 · TypeScript · Tailwind v4 через `@config` на классический
`tailwind.config.ts` (живой конфиг, не «безконфигурный» режим) · Supabase
(Postgres + Auth + Storage) · react-hook-form + zod · docxtemplater + pizzip (DOCX) ·
pdf-lib (PDF) · recharts · sonner · framer-motion · lucide-react · Upstash Redis
(rate limit) · Sentry · vitest (юнит) + Playwright (E2E).

Библиотеки компонентов нет: `src/components/ui/` — два своих файла, Radix и shadcn
удалены. Kanban — нативный HTML5 drag-and-drop, без @dnd-kit.

```
Supabase:  https://zwclvcswvhjeqwxrkbte.supabase.co  (ref zwclvcswvhjeqwxrkbte)
GitHub:    https://github.com/nojkinrs124/housepro-crm
Прод:      https://housepro24.ru  (vercel.app → 308 редирект)
Admin ID:  508499ac-0268-49c7-9c31-8198deafeeda
```

Работаем в текущем чекауте — клонировать заново не нужно. Основной чекаут
`~/projects/work-space/housepro-crm` может содержать чужие незакоммиченные правки —
не затирать их и не коммитить. Параллельные задачи — в отдельном `git worktree`.

## Supabase — минимум

Схема меняется **только** через MCP-коннектор Supabase: `APPLY_A_MIGRATION`
(в Hermes имя вида `connectors__supabase__APPLY_A_MIGRATION`). `EXECUTE_SQL` /
`RUN_READ_ONLY_QUERY` — только чтение, DDL там запрещён хуком.

Коннектор Supabase уже подключён в Hermes: инструменты видны как
`connectors__supabase__*` (`LIST_TABLES`, `APPLY_A_MIGRATION`,
`RUN_READ_ONLY_QUERY`, `GENERATE_TYPESCRIPT_TYPES`). Если в сессии их нет —
сказать об этом и не изобретать обходной путь (прямые HTTP-запросы к
`api.supabase.com` не делаем, MCP-сервер руками не добавляем).

- Актуальный список таблиц — `LIST_TABLES`, а не память и не документация.
- После каждой миграции — `GENERATE_TYPESCRIPT_TYPES` → `src/types/supabase.ts`
  (файл сгенерированный, руками не править). С машины — `npm run db:types`.
- Клиенты, шаблоны RLS и PostgREST-хинты — skill `housepro-migration`.
  Коротко: сервер — `await createClient()` из `lib/supabase/server`, клиент —
  `createClient()` из `lib/supabase/client` без await, API-роут —
  `getSupabaseAdmin()` лениво внутри хендлера.

Ключевые сущности: `contacts` (единые клиенты и собственники, поле `role`:
`client | owner | both`; у юрлица — реквизиты и представители в
`contact_representatives`), `leads`, `deals`, `properties`, `contracts`,
`accounting_transactions` (**единственный** источник денег), `tasks`, `showings`,
`property_collections`, `organizations` + `organization_members`.
`clients` и `owners` — больше нет: удалены 02.09.2026, колонки-ссылки
`client_id`/`owner_id` — 16.09.2026. `LIST_TABLES` — источник истины.

Мультиарендность: каждая запись несёт `organization_id`, изоляция в RLS через
`get_user_org_id()`.

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
Server Component в клиентский — RSC-payload её не сериализует, в проде это
«Minified React error #441» на всю страницу. Исключение — Server Action в
`action`/`formAction`. Вместо колбэка передавать сериализуемое: строку-шаблон,
объект, массив (образец — `hintTemplate` в `DadataSuggestInput.tsx`).

Из файла с `'use client'` серверный код может рендерить только PascalCase-компонент
как JSX. **Обычную функцию оттуда импортировать нельзя** — вызов с сервера падает в
рантайме. Чистые типы и функции выносить в файл без `'use client'`; образец —
`src/features/contracts/utils/rent-apartment-data.ts`.

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

## TypeScript

```ts
const data: any = {}                                  // ❌ в новом коде
import type { Contact, Deal, Row } from '@/types/database'   // ✅
const deal: Row<'deals'> = …                          // строка таблицы
```

Схема БД сгенерирована (`src/types/supabase.ts` руками не править), доменные
union'ы и хелперы — в `src/types/database.ts`. Тип честно неизвестен — `unknown`
с сужением, а не `any`.

**`any` в проекте нет** — хвост от старой заглушки `Database = any` снят 04.09.2026
(208 → 0). `check:any` не пропускает новые, baseline — `scripts/checks/any-baseline.json`.
Если доменный тип разошёлся со схемой — править тип, а не ставить каст на месте.

**ESLint не работает** — `typescript-eslint` не поддерживает TS 7 (пункт #1 в
`docs/IMPROVEMENTS.md`). На `npm run check` это не влияет, шага lint там нет.

## Дизайн — «Кабинет», короткая версия

Полный гайд и шаблоны страниц — skill `housepro-ui`. Всегда действуют:

1. Цвет только через токены `var(--hp-*)` из `globals.css` — никакого хардкода хекса
   и никакой палитры Tailwind (`bg-blue-500`, `text-slate-600`).
2. Форму карточки задаёт `border border-[var(--hp-border)]`; тень — только через
   `var(--hp-shadow)`. Значения токенов — единственный источник, не хардкодить числом.
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
Иконки `lucide-react` — всегда `strokeWidth={1.6}` явно.

## Правила интерфейса CRM

Целевой пользователь — нанятый риелтор, впервые открывший CRM. Всё, что требует
объяснений, — дефект. Экран готов, только если проходит все восемь правил:

1. **≤ 3 кликов** от `/dashboard` до завершения частого действия.
2. **Одна главная кнопка на экран** — `hp-btn-primary`. Остальные вторичные или в меню «…».
3. **≤ 6 полей на виду** в форме, остальное свёрнуто в «Дополнительно». Обязательных — минимум.
4. **Единый скелет модуля:** список → фильтр → карточка → действия. Без уникальных структур.
5. **Нет пустых экранов:** что это и что делать + кнопка, которая это делает.
6. **Человеческий язык:** никаких `deal_stage`, `null`, `error.message` от Postgres. Ошибка говорит, что случилось и что делать.
7. **Необратимое подтверждается, обратимое — нет.** Удаление спрашивает и называет последствия; сохранение просто сохраняет.
8. **Одно действие — один способ.** Дубли кнопок и путей убираются.

Эталон — модуль **Сделки** (`src/app/(dashboard)/deals`, `src/features/deals`).
Новые экраны собираются только из готовых компонентов: `PageHeader`, `StatStrip`,
`RegistryToolbar` + `RegistryTable`, `EmptyState`, `RecordActions` + `OverflowMenu`,
`ConfirmDeleteButton`, `FormSection`/`FieldGrid`/`Field`/`FormExtra`/`FormActions`,
`friendlyDbError()`. Таблица «компонент → где → зачем» — skill `housepro-ui`.
Свою разметку вместо них не писать.

Обратная связь: **toast** (sonner) — для действий на месте (смена статуса, удаление,
публикация); **баннер** `ServerActionForm` — для форм с редиректом. Не смешивать.

Форматы (утверждены владельцем): дата в реестрах/канбанах — `25.10.26`
(`formatDateCompact`), дата+время — `25.10.26 · 08:12` (`formatDateTimeCompact`);
документы (отчёт, счёт, договор) — полный год. В `StatStrip` ровно 4 цифры,
крупные суммы кратко (`formatMoneyShort`: `1,8 млн ₽`); в таблицах — полная сумма.

## Версия

Версия CRM живёт в `package.json` и показывается в футере настроек — руками в
разметку не вписывать (`import { APP_VERSION } from '@/lib/version'`). Поднимать
при каждом изменении кода, тем же коммитом: `npm run version:patch` / `:minor` / `:major`.

## Что проверяется автоматически

Правила ниже не нужно держать в голове — их не дадут нарушить хуки Hermes
(`scripts/agent-hooks/*.mjs`, раздел `hooks` в `~/.hermes/config.yaml`).

| Хук | Событие | Что делает |
|---|---|---|
| `guard-bash.mjs` | `pre_tool_call` (terminal) | блокирует `git push` без зелёного `npm run check` на **текущем** коде и без бампа версии; секреты и PAT в командной строке; `npm install` без `--legacy-peer-deps` и запрещённые пакеты (`axios`, `react-query`, второй drag-and-drop) |
| `guard-sql.mjs` | `pre_tool_call` (`RUN_READ_ONLY_QUERY`) | блокирует DDL и запись в read-only инструменте — схема только через `APPLY_A_MIGRATION` |
| `guard-migration.mjs` | `pre_tool_call` (`APPLY_A_MIGRATION`) | блокирует `DROP TABLE` / `TRUNCATE` / `DROP COLUMN` / `DELETE` без `WHERE`, требует парную `down` |
| `verify-edits.mjs` | `pre_verify` (раз на ход, по изменённым файлам) | по изменённым файлам: визуальный стандарт, новые `any`, границы client/server, дубль имени в actions, `force-dynamic` в GET-роутах, частота кронов, поля форм; плюс напоминания README/handbook |

Все скрипты no-op вне репозитория CRM: хук глобальный, а проект один.
Подключение — один раз (пути, формат payload, самопроверка): `scripts/agent-hooks/README.md`.
Согласие на хуки даётся однократно (`hermes --accept-hooks chat -q ok`), состояние —
`hermes hooks doctor`.

`npm run check` гоняет по порядку: tsc → event handlers → границы client/server →
функции-пропы → правила серверного слоя → поля форм → `any` → визуальный стандарт →
словарь стадий → кроны → build → тесты. **Шаги не нумеруются** — номера разъезжались
по документам, ссылаться на шаг по названию.

Отдельные шаги: `check:design`, `check:boundary`, `check:cron`, `check:server`,
`check:stages`, `check:forms`, `check:any`; baseline переснимается после чистки легаси.

## Статус (сверено 29.10.2026, v2.46.2)

- 662 файла TS/TSX, 88.9k строк, 114 страниц, 46 API-роутов, 34 модуля `features`.
- Тесты: 49 файлов, 648 тестов, зелёные. `npx tsc --noEmit` — 0 ошибок.
- Миграций в репозитории — 68, в БД применено 153 версии.
- Открытые приоритеты — `docs/IMPROVEMENTS.md` (единственный бэклог). Сейчас:
  #1 ESLint (апстрим), #2 секреты в query (8 мест), #3 `public_company_contacts`
  без org-скоупа, #4 rate limit в 32 из 57 файлов actions, #7 568 мест на
  shadcn-классах, #8 data-слой в 5 модулях, #10 TRUNCATE-грант.

## Указатель

| Нужно | Где |
|---|---|
| Создать страницу/форму/карточку | skill `housepro-ui` |
| Изменить схему БД, RLS, PostgREST | skill `housepro-migration` |
| Пуш, релиз, деплой, E2E | skill `housepro-release` |
| Новый модуль целиком | skill `housepro-new-module` |
| Аудит, QA, визуальная проверка | skill `housepro-audit` |
| Telegram-бот CRM | skill `housepro-telegram-bot` |
| SEO, индексация, ключевые слова | skill `housepro-seo` |
| Локальный стенд Supabase, RLS | skill `housepro-local-testing` |
| Доступы: панель, вход в CRM, dev-сервер, пул моделей | skill `housepro-ops` (вне репозитория, `~/.hermes/skills/`) |
| Правила API routes | `src/app/api/AGENTS.md` |
| Правила actions/components | `src/features/AGENTS.md` |
| Что делать дальше | `docs/IMPROVEMENTS.md` — единственный бэклог |
| Как мы работаем, красные флаги | `docs/WORKFLOW.md` |
| Что было в прошлых сессиях | `docs/JOURNAL.md` (хроника, не правила) |
| Долгосрочные фазы | `docs/ROADMAP.md` |
| Карта кода, модули, потоки | `docs/ARCHITECTURE-MAP.md` |
| Интеграции | `docs/INTEGRATIONS.md` |
| Карта всей документации | `docs/INDEX.md` |
| Что умеет система | `README.md` |
| Как работать в системе (сотрудникам) | `docs/handbook/` |
| История аудитов и решений | `docs/archive/` |

## Как работать с агентом

- **Коммит, пуш и слияние — три отдельных разрешения.** Правки можно оставлять
  в рабочей копии и поднимать версию; `git commit` — после «коммить», пуш — в свою
  ветку, слияние в `main` — после отдельного «сливай».
- Сеть (git/gh/npm) — через `env -u HTTPS_PROXY -u HTTP_PROXY`: локальный прокси
  ломает запросы к GitHub.
- Секреты не печатать и не класть в командную строку: брать из хранилища по
  имени записи, не значением (как именно — skill `housepro-ops`).
- `~/.hermes/config.yaml` руками не править — только `hermes config set`.
- Живой прогон важнее зелёного билда: «страница открылась» не равно «функция работает».

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
