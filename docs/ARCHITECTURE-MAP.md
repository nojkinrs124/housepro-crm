# HousePro CRM — карта проекта

Снимок на 22.10.2026, версия 2.28.3, коммит `6736f25`.
Цифры сняты с кода, не по памяти: `find src -name '*.ts*' | xargs wc -l`.

## 1. Одной фразой

Одна Next.js-аппликация, в которой живут **четыре продукта** с общим кодом:
внутренняя CRM агентства (`/dashboard`), публичный сайт агентства (`/`),
личные кабинеты собственников и арендаторов (`/cabinet`), публичные страницы
по ссылке (`/c/{token}`, `/sign/{token}`, `/r/{code}`) — плюс Telegram-бот,
который работает как второй UI к той же базе.

## 2. Цифры

| Метрика | Значение |
|---|---|
| Файлов TS/TSX в `src/` | 620 |
| Строк в `src/` | 84 498 |
| Страниц (`page.tsx`) | 114 |
| API-роутов (`route.ts`) | 45 |
| Server Actions (`export async function *Action`) | 161 |
| Файлов с `'use client'` | 211 |
| Файлов с `'use server'` | 70 |
| Миграций БД | 58 |
| Юнит-тестов | 534 в 38 файлах |
| E2E-сценариев | ~40 в 8 спеках + 7 смоуков |
| Вызовов `.from(` (запросы к БД) | 903 |
| Прямых `process.env` | 127 |

## 3. Слои

```
middleware.ts            — только авторизация сессии CRM, api/ и публичные пути исключены
src/app/(dashboard)/     — 84 страницы CRM (Server Components, ходят в Supabase сами)
src/app/(site)/          — публичный сайт: /, /uslugi/*, /catalog, /o-kompanii, /policy
src/app/(portal)/cabinet — кабинет собственника/арендатора (вход по телефону + OTP)
src/app/c, r, sign       — публичные страницы по токену (подборка, ссылка канала, подпись)
src/app/api/             — 45 роутов: v1 (публичный REST), cron, вебхуки, экспорт фидов
src/features/<модуль>/   — 32 модуля: actions/ components/ services/ config/
src/components/          — только общее: layout (12), forms (6), ui (2), search
src/lib/                 — 70 файлов сквозной логики (18 в корне + подпапки интеграций)
src/types/               — supabase.ts (генерённый, 4314 стр.) + database.ts (доменные союзы)
supabase/migrations/     — 58 SQL-миграций, единственный путь изменения схемы
```

Правило слоя, которое реально соблюдается: **страница = запрос + разметка**,
**интерактив = клиентский компонент рядом**, **мутация = Server Action в
`features/*/actions`**. Никакого ORM и никакого слоя репозиториев нет — страница
и экшен общаются с PostgREST напрямую.

## 4. Модули (по весу)

| Модуль | Строк / файлов | За что отвечает |
|---|---|---|
| contracts | 5073 / 28 | договоры, DOCX-генерация, версии, подпись (ПЭП + Подпислон), PDF |
| site | 4085 / 30 | публичный сайт: услуги, каталог, лид-формы, тексты |
| accounting | 3941 / 30 | доходы/расходы, категории, график начислений, счёт, банковская выписка |
| management | 3516 / 19 | доверительное управление: тарифы, взаиморасчёт, отчёты собственнику, акт |
| properties | 2905 / 18 | объекты, фото (Yandex S3), фиды Avito/CIAN/Domclick, объявления через LLM |
| deals | 2391 / 14 | сделки, kanban, воронка, «Оформить» (договор + график + комиссия) |
| settings | 2301 / 13 | компания, сотрудники, шаблоны, каналы, API-ключи, вебхуки, подпись |
| contacts | 2081 / 16 | единые клиенты/собственники, юрлица, дубли, контрагент-чек |
| portal | 1379 / 12 | кабинет, доступы, заявки, счётчики |
| directions | 1283 / 9 | 4 направления и их воронки, чек-листы стадий, предусловия перехода |
| leads | 1137 / 10 | лиды, kanban, конвертация в контакт |
| knowledge | 983 / 10 | база знаний + handbook, свежесть статей |
| telegram (features) | 939 / 4 | форматирование intake, дайджесты |
| avito | 891 / 7 | Avito API: автозагрузка, чаты |
| остальные 18 | < 900 каждый | tasks, showings, collections, files, plans, meters, analytics, … |

Отдельно от `features`: **`src/lib/telegram/`** — 3800+ строк, самая тяжёлая
подсистема проекта (crm-menu 690, channel 651, tools 608, intake 558, menu 371,
api 303, llm 60). Плюс `src/app/api/telegram/webhook/route.ts` — 1321 строка,
вся диспетчеризация бота лежит в одном файле.

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
`vercel.json` — 4 суточных крона (daily-digest, payment-reminders,
generate-recurring-transactions, channel-weekly-summary); всё, что чаще
суток, крутится в pg_cron и дергает `public.call_vercel_cron(path)`;
GitHub Actions — только CI и ручной E2E.

## 6. Данные

Ядро: `organizations` → `organization_members` (RLS через `get_user_org_id()`),
`contacts` (общий справочник клиентов и собственников, `role`), `leads`, `deals`,
`properties`, `contracts`, `accounting_transactions` (**единственный** источник
денег; таблицы `payments`, `clients`, `owners` удалены), `payment schedules`
живут внутри `accounting_transactions` (`schedule_seq`, `period_start/end`),
`tasks`, `showings`, `property_collections`, `knowledge_articles`, `audit_log`,
`channel_integrations`/`channel_bot_settings`/`bot_*` (Telegram),
`portal_access`/`portal_sessions`/`portal_requests`, `api_keys`, `webhook_endpoints`.

Каждая запись несёт `organization_id`; изоляция — в RLS, не в коде.
Доменные союзы и хелперы (`Row<'deals'>`, `Update<'showings'>`) — `src/types/database.ts`.

## 7. Интеграции

| Что | Где | Как включается |
|---|---|---|
| Telegram-бот (диалог + intake + канал) | `api/telegram/webhook`, `lib/telegram/*` | токен в env, настройки в `channel_bot_settings` |
| LLM (объявления, бот, посты) | `lib/ai/*`, `lib/telegram/llm.ts` | `OPENROUTER_API_KEY`; без ключа фича отвечает 503 |
| Почта | `lib/email/*` (465 стр. send.ts) | Resend / Unisender / log |
| Фото объектов | `lib/storage/photo-storage.ts` | Yandex Object Storage или Supabase Storage |
| DOCX / PDF | `lib/pdf/*`, `features/contracts/services/document.service.ts` | локально, шрифты в `lib/pdf/fonts.ts` |
| Подпись | `lib/signing.ts`, `lib/podpislon/*` | ПЭП по коду из письма / оператор Подпислон |
| DaData | `lib/dadata/*` | подсказки адресов, организаций, банков |
| ЮKassa | `api/payments/yookassa` | ссылки на оплату + вебхук |
| Avito | `features/avito/*`, `api/avito/feed/[token]` | токен в `avito_settings` |
| Фиды площадок | `api/export/{cian,domclick,yandex-realty,avito}` | **без авторизации** (см. аудит) |
| iCal | `api/ical/[token]` | подписка в календаре |

## 8. Где что искать

| Задача | Идти в |
|---|---|
| Поменять стадии воронки | `features/directions/config/*` — единый словарь, синхронизируется с CHECK миграций (`check:stages`) |
| Поменять деньги/начисления | `features/accounting/{actions,services}`, `features/management/actions/settlement.actions.ts` |
| Поменять договор/DOCX | `features/contracts/services/document.service.ts` + шаблоны в Storage |
| Поменять публичный сайт | `features/site/{config,uslugi/config.ts}` — тексты и числа только там |
| Поменять бота | `app/api/telegram/webhook/route.ts` (диспетчер) + `lib/telegram/*` |
| Поменять кабинет | `features/portal/*`, `app/(portal)/cabinet/*` |
| Поменять схему БД | `supabase/migrations` через `apply_migration`, затем `npm run db:types` |
| Понять, почему упало | `lib/errors.ts` (`friendlyDbError`), Sentry, `docs/archive/qa/WALKTHROUGH.md` |

## 9. Где код тяжелее всего (кандидаты на распил)

1. `app/api/telegram/webhook/route.ts` — 1321 строка, ~30 функций, диспетчеризация цепочкой `if`.
2. `features/contracts/services/document.service.ts` — 723 строки в одном файле.
3. `lib/readiness.ts` — 521 строка: правила готовности всех сущностей в одном модуле.
4. `app/(dashboard)/deals/[id]/page.tsx` — 586 строк: 6 запросов + вся разметка карточки.
5. `app/(dashboard)/management/[id]/page.tsx` — 570 строк.
6. `features/accounting/actions/accounting.actions.ts` — 522 строки, 20+ экшенов в одном файле.

## 10. Контроль качества

- `npm run check` (`scripts/pre-push-check.mjs`) — 11 шагов: tsc → обработчики →
  границы client/server → функции-пропы → правила серверного слоя → `any` →
  визуальный стандарт → словарь стадий → поля форм → build → тесты.
- `check:design` держит baseline (`scripts/checks/design-baseline.json`) — новые
  нарушения видны, легаси не блокирует.
- E2E (Playwright) — ручной запуск, против прода, + vision-проверка скриншотов.
- Sentry — клиент/сервер/edge конфиги, `instrumentation.ts`.
