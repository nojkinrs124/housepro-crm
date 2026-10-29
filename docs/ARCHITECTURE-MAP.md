# HousePro CRM — карта проекта

Снимок на 29.10.2026, версия 2.46.2, коммит `1f01383`.
Цифры сняты с кода, не по памяти (`find src -name '*.ts*' | xargs wc -l`).

## 1. Одной фразой

Одна Next.js-аппликация, в которой живут **четыре продукта** с общим кодом:
внутренняя CRM агентства (`/dashboard`), публичный сайт агентства (`/`),
личные кабинеты собственников и арендаторов (`/cabinet`), публичные страницы
по ссылке (`/c/{token}`, `/sign/{token}`, `/r/{code}`) — плюс Telegram-бот,
который работает как второй UI к той же базе.

## 2. Цифры

| Метрика | Значение |
|---|---|
| Файлов TS/TSX в `src/` | 662 |
| Строк в `src/` | 88 869 |
| Страниц (`page.tsx`) | 114 |
| API-роутов (`route.ts`) | 46 |
| Server Actions (`export async function *Action`) | 167 |
| Файлов с `'use client'` | 215 |
| Файлов с `'use server'` | 72 |
| Модулей `src/features/` | 34 |
| Миграций БД | 68 файлов (153 версии применено в БД) |
| Юнит-тестов | 648 в 49 файлах |
| E2E-сценариев | 7 спек + смоук-набор |
| Вызовов `.from(` (запросы к БД) | 967 |
| Прямых `process.env` | 156 |

## 3. Слои

```
middleware.ts            — только авторизация сессии CRM, api/ и публичные пути исключены
src/app/(dashboard)/     — страницы CRM (Server Components, ходят в Supabase сами)
src/app/(site)/          — публичный сайт: /, /uslugi/*, /catalog, /o-kompanii
src/app/(portal)/cabinet — кабинет собственника/арендатора (вход по телефону + OTP)
src/app/c, r, sign       — публичные страницы по токену (подборка, ссылка канала, подпись)
src/app/api/             — 48 роутов: v1 (публичный REST), cron, вебхуки, экспорт фидов
src/features/<модуль>/   — 34 модуля: actions/ components/ services/ (data/ в пяти)
src/components/          — только общее: layout, forms, ui (2 файла), search
src/lib/                 — сквозная логика и подсистемы (telegram, ai, email, pdf, storage)
src/types/               — supabase.ts (генерённый, 4435 стр.) + database.ts (доменные союзы)
supabase/migrations/     — 68 SQL-миграций, единственный путь изменения схемы
scripts/checks/          — проверки гейта и их baseline
scripts/agent-hooks/     — хуки Hermes (блокировки и pre_verify)
.hermes/skills/          — процедуры housepro-*
```

Правило слоя, которое реально соблюдается: **страница = запрос + разметка**,
**интерактив = клиентский компонент рядом**, **мутация = Server Action в
`features/*/actions`**. Никакого ORM и слоя репозиториев нет — страница и экшен
общаются с PostgREST напрямую.

## 4. Модули (по весу)

| Модуль | Строк / файлов | За что отвечает |
|---|---|---|
| contracts | 4761 / 27 | договоры, DOCX-генерация, версии, подпись (ПЭП + Подпислон), PDF |
| accounting | 4417 / 32 | доходы/расходы, категории, график начислений, счёт, банковская выписка |
| site | 4285 / 33 | публичный сайт: услуги, каталог, лид-формы, тексты |
| management | 3498 / 19 | доверительное управление: тарифы, взаиморасчёт, отчёты собственнику, акт |
| properties | 3113 / 20 | объекты, фото (Yandex S3), фиды Avito/CIAN/Domclick, объявления через LLM |
| settings | 2314 / 13 | компания, сотрудники, шаблоны, каналы, API-ключи, вебхуки, подпись |
| deals | 2204 / 13 | сделки, kanban, воронка, «Оформить» (договор + график + комиссия) |
| contacts | 2176 / 17 | единые клиенты/собственники, юрлица, дубли, контрагент-чек |
| portal | 1299 / 11 | кабинет, доступы, заявки, счётчики |
| directions | 1293 / 9 | 4 направления и воронки, чек-листы стадий, предусловия перехода |
| avito | 1234 / 8 | Avito API: автозагрузка, чаты, авто-диалог |
| telegram (features) | 1206 / 5 | права бота (`CAPABILITIES`), форматирование intake, дайджесты |
| остальные 22 | < 1100 каждый | leads, knowledge, communications, registry, auth, plans, … |

Отдельно от `features`: **`src/lib/telegram/`** — самая тяжёлая подсистема
(`tools.ts` 702, `crm-menu.ts` 690, `channel.ts` 683, `intake.ts` 561).
Роут `src/app/api/telegram/webhook/route.ts` сжат до 39 строк: диспетчеризация
переехала в `src/lib/telegram/webhook/` (router, handlers, idempotency, context).

## 5. Как течёт запрос

**Чтение (страница CRM):**
`middleware.ts` (есть ли сессия) → `app/(dashboard)/<модуль>/page.tsx` →
`await createClient()` → 4–8 запросов `supabase.from(...).select(...)` в `Promise.all`
→ разметка `PageHeader + StatStrip + RegistryTable` → клиентские острова
(`DeleteButton`, формы) отдельными файлами.

**Запись (Server Action):**
`ServerActionForm` → action в `features/*/actions` → `auth.getUser()` →
`requireOrgId()` → `rateLimit*()` → Zod → `.insert({... organization_id})` →
`writeAuditLog()` → `revalidatePath()` → `redirect()` или toast.

**Фон:**
`vercel.json` — суточные кроны (daily-digest, payment-reminders,
generate-recurring-transactions, channel-weekly-summary); всё, что чаще суток,
крутится в pg_cron и дергает `public.call_vercel_cron(path)` (в канонический домен,
не в `*.vercel.app` — редирект теряет `Authorization`). GitHub Actions — только CI
и ручной E2E.

## 6. Данные

Ядро: `organizations` → `organization_members` (RLS через `get_user_org_id()`),
`contacts` (общий справочник клиентов и собственников, `role`), `leads`, `deals`,
`properties`, `contracts`, `accounting_transactions` (**единственный** источник
денег; таблицы `payments`, `clients`, `owners` удалены), график начислений живёт
внутри `accounting_transactions` (`schedule_seq`, `period_start/end`), `tasks`,
`showings`, `property_collections`, `knowledge_articles`, `audit_log`,
`channel_integrations`/`channel_bot_settings`/`bot_*` (Telegram),
`portal_access`/`portal_sessions`/`portal_requests`, `api_keys`, `webhook_endpoints`.

Каждая запись несёт `organization_id`; изоляция — в RLS, не в коде.
Доменные союзы и хелперы (`Row<'deals'>`, `Update<'showings'>`) — `src/types/database.ts`.

## 7. Интеграции

| Что | Где | Как включается |
|---|---|---|
| Telegram-бот (диалог + intake + канал) | `api/telegram/webhook`, `lib/telegram/*` | токен в env, настройки в `channel_bot_settings` |
| LLM (объявления, бот, посты) | `lib/ai/*`, `lib/telegram/llm.ts` | `OPENROUTER_API_KEY`; без ключа фича отвечает 503 |
| Почта | `lib/email/*` | Resend / Unisender / log |
| Фото объектов | `lib/storage/photo-storage.ts` | Yandex Object Storage или Supabase Storage |
| DOCX / PDF | `lib/pdf/*`, `features/contracts/services/document.service.ts` | локально, шрифты в `lib/pdf/fonts.ts` |
| Подпись | `lib/signing.ts`, `lib/podpislon/*` | ПЭП по коду из письма / оператор Подпислон |
| DaData | `lib/dadata/*` | подсказки адресов, организаций, банков |
| ЮKassa | `api/payments/yookassa` | ссылки на оплату + вебхук |
| Avito | `features/avito/*`, `api/avito/feed/[token]` | токен в `avito_settings` |
| Фиды площадок | `api/export/{cian,domclick,yandex-realty,avito}` | **без авторизации** (известный долг) |
| iCal | `api/ical/[token]` | подписка в календаре |
| Метрика / GA4 / IndexNow | `features/site/lib`, `api/seo/*` | ключи в env, см. skill `housepro-seo` |

## 8. Где что искать

| Задача | Идти в |
|---|---|
| Поменять стадии воронки | `features/directions/config/*` — единый словарь, сверяется с CHECK миграций (`check:stages`) |
| Поменять деньги/начисления | `features/accounting/{actions,services}`, `features/management/actions/settlement.actions.ts` |
| Поменять договор/DOCX | `features/contracts/services/document.service.ts` + шаблоны в Storage |
| Поменять публичный сайт | `features/site/{config,uslugi/config.ts}` — тексты и числа только там |
| Поменять бота | `lib/telegram/webhook/*` (диспетчер) + `lib/telegram/*` |
| Поменять кабинет | `features/portal/*`, `app/(portal)/cabinet/*` |
| Поменять схему БД | `supabase/migrations` через `APPLY_A_MIGRATION`, затем регенерация типов |
| Понять, почему упало | `lib/errors.ts` (`friendlyDbError`), Sentry, `docs/archive/qa/WALKTHROUGH.md` |

## 9. Где код тяжелее всего (кандидаты на распил)

1. `src/types/supabase.ts` — 4435 строк, но это генерированный файл, трогать нельзя.
2. `features/contracts/services/document.service.ts` — 723 строки в одном файле.
3. `lib/telegram/tools.ts` — 702 строки: реестр инструментов бота и их исполнение.
4. `lib/telegram/crm-menu.ts` — 690 строк экранов бота.
5. `lib/telegram/channel.ts` — 683 строки: публикации в канал.
6. `app/(dashboard)/management/[id]/page.tsx` и `deals/[id]/page.tsx` — по 579 строк
   (6+ запросов и вся разметка карточки).
7. `features/accounting/actions/accounting.actions.ts` — 540 строк, 20+ экшенов.

## 10. Контроль качества

- `npm run check` (`scripts/pre-push-check.mjs`) — шаги: tsc → обработчики →
  границы client/server → функции-пропы → правила серверного слоя → поля форм →
  `any` → визуальный стандарт → словарь стадий → кроны → build → тесты.
- Хуки Hermes (`scripts/agent-hooks/`): `guard-bash` (пуш/секреты/пакеты),
  `guard-sql`, `guard-migration` (разрушительные миграции), `verify-edits`
  (pre_verify: те же проверки по изменённым файлам раз на ход).
- Baseline-ратчет: `scripts/checks/design-baseline.json`, `any-baseline.json` —
  новые нарушения видны, легаси не блокирует.
- E2E (Playwright) — ручной запуск, против прода, + vision-проверка скриншотов.
- Sentry — клиент/сервер/edge конфиги, `instrumentation.ts`.
