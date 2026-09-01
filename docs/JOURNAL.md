# HousePro CRM — хроника сессий

Что происходило и почему так решили. **Это история, а не правила** — действующий
процесс лежит в `docs/WORKFLOW.md`, приоритеты в `docs/IMPROVEMENTS.md`.
Читать не обязательно; заглядывать сюда, когда нужно понять, откуда взялось решение.

---

## Сессия 28.08.2026 (ночь) — Leaked Password Protection, Dependabot, Upstash Redis, security advisors

Сделано (выполнялось агентом самостоятельно через браузер, доступ дал Руслан — «давай ты сам всё это сделаешь а я дам доступ который нужно»):

- **Dependabot: все 7 открытых PR слиты** (`#2`, `#3`, `#5`, `#6`, `#7`, `#8` — npm, и github-actions группа) через GitHub UI, с `@dependabot rebase` там, где были конфликты `package-lock.json` (стейл-ветки на коммитах старше `8ec4aa5`). CI (`npm run check`-эквивалент) зелёный по каждому перед мержем — ориентировались на живой статус чека на странице PR, а не на локальный прогон (после rebase версии в PR иногда уезжали дальше, чем локально проверялось до этого). Настройки репозитория «Dependabot security updates» / «Grouped security updates» уже были включены раньше — трогать не пришлось.
- **Supabase advisor — закрыто**:
  - `extension_in_public` (pg_trgm) — `alter extension pg_trgm set schema extensions` (миграция `20260828_relocate_pg_trgm_to_extensions_schema.sql`). Безопасно: `extensions` уже в default `search_path`, GIN-индексы `idx_*_trgm` не тронуты, поиск проверен вживую после переноса.
  - `extension_in_public` (pg_net) — `pg_net` **не поддерживает** `ALTER EXTENSION ... SET SCHEMA` (`ERROR 0A000`). Решение (DROP/CREATE, разрушительное — теряются in-flight запросы) подтверждено Русланом явно перед выполнением. Миграция `20260828_relocate_pg_net_via_drop_recreate.sql`. Проверено: `cron.job` (`check-overdue-daily-telegram`) не пострадал (функции `pg_net` живут в фиксированной схеме `net` независимо от схемы регистрации расширения), живой `net.http_post(...)` отработал.
  - `anon`/`authenticated` EXECUTE на внутренних SECURITY DEFINER функциях — отозван у `check_expiring_contracts`, `check_overdue_payments`, `handle_new_user`, `import_rental_contract` (миграция `20260828_revoke_public_execute_on_internal_functions.sql`). **`get_user_org_id()` НЕ тронут** — используется в RLS-политиках повсеместно. `import_rental_contract` проверен перед изменением грантов: вызывается только из `src/app/api/v1/import/rental-contract/route.ts` через `service_role`-клиент, с фронтенда напрямую не вызывается.
  - Технический нюанс: `revoke ... from anon, authenticated` сам по себе не срабатывал — функции имели `EXECUTE` на псевдо-роли `PUBLIC`, а `anon`/`authenticated` наследуют её привилегии. Пришлось `revoke ... from public` явно.
  - Итог по `get_advisors`: остались только 2 ожидаемых warning — `get_user_org_id` executable by anon/authenticated (осознанно, для RLS) и `auth_leaked_password_protection` (см. ниже).
- **Upstash Redis (rate limiting) — подключён**: создана Upstash Redis база `housepro-crm-rate-limit` через нативную интеграцию Vercel (Storage → Create Database → Upstash for Redis), тариф **Free** (лимит 500k команд/мес, 1 база на аккаунт — бесплатного тира хватило, платить не пришлось). Интеграция сама создаёт `KV_REST_API_URL`/`KV_REST_API_TOKEN`/`KV_URL`/`REDIS_URL`/`KV_REST_API_READ_ONLY_TOKEN` — но код (`src/lib/rate-limit.ts`) читает `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`, которых интеграция не создаёт. Добавлены вручную в Vercel Env Vars (Production + Preview) со значениями, скопированными из `KV_REST_API_URL`/`KV_REST_API_TOKEN` (та же база, два набора имён). Сделан redeploy Production, чтобы новый рантайм подхватил переменные — деплой зелёный.
- **Leaked Password Protection — заблокировано, нужно решение Руслана**: тумблер в Supabase Dashboard → Authentication → требует Pro-план проекта (`"Configuring leaked password protection via HaveIBeenPwned.org is available on Pro Plans and up"`), проект сейчас на Free. Не апгрейдил самостоятельно — это платное решение, не в зоне полномочий агента. **Нужно от Руслана:** апгрейдить проект до Pro (или явно отложить).

**Не сделано / открыто:**
1. **Supabase Pro-план** — решение Руслана (см. выше, Leaked Password Protection).
2. **GitHub Security tab** (вне scope этой сессии, но замечено): Code scanning — 8 алертов, Secret scanning — 1 алерт. Секретный алерт стоит проверить отдельно — может означать утёкший ключ, требующий ротации.

## Верификация сессии 28.08.2026 (ночь) — найдена и починена регрессия

Проверял результат предыдущей сессии (см. выше) заново, с нуля (`rm -rf node_modules && npm install --legacy-peer-deps`, как предписывает CLAUDE.md для каждой сессии):

- **Supabase advisor** — подтверждено, ровно 2 warning остались (`get_user_org_id` executable, `auth_leaked_password_protection`), как и заявлено. Миграции (`relocate_pg_trgm`, `relocate_pg_net_via_drop_recreate`, `revoke_public_execute_on_internal_functions`) прочитаны, обоснование в комментариях корректное и проверяемое.
- **Vercel деплои** — все READY, включая деплой на коммите с WORKFLOW.md (последний). Runtime-логи rate-limit не нашлись за последние 2ч (нет мутаций в этот период) — не удалось на 100% подтвердить, что `UPSTASH_REDIS_REST_URL/TOKEN` реально подхватились, но таймлайн деплоев это не опровергает.
- **❌ РЕГРЕССИЯ, ПОЙМАНА И ПОЧИНЕНА**: PR `#6` (`@testing-library/jest-dom` 6.9.1 → 7.0.1) сломал **весь тестовый набор** (`Cannot find package '@testing-library/dom'`) — jest-dom 7.x использует этот пакет в рантайме, но не объявляет его как прямую зависимость (баг апстрима). GitHub CI на этом же коммите почему-то зелёный (расхождение `npm ci` в CI vs `npm install --legacy-peer-deps` локально — не разобрался до конца, почему именно, но локальный симптом стабильно воспроизводится). Добавил `@testing-library/dom` явной dev-зависимостью — `npm run check` снова полностью зелёный (53/53 страниц, тесты проходят).
- **Вывод про мерж-процесс**: "CI зелёный на странице PR" оказалось недостаточным критерием — по крайней мере один раз тесты были красными в реальности при зелёном CI. Держать в голове на будущее при автомерже Dependabot-PR: перепроверять `npm run check` локально после мержа в main, не только доверять статусу на GitHub.
- Не проверено (нет доступа к токену в этой сессии): GitHub code-scanning (8 алертов) и secret-scanning (1 алерт) — **secret-scanning алерт стоит посмотреть Руслану лично** (Settings → Code security → Secret scanning alerts), может означать утёкший ключ.

## Сессия 28.08.2026 (вечер) — закрытие техдолга + мёртвый код

Сделано:
- **npm audit**: Next.js 16.2.9 → 16.3.3 (5 CVE: proxy bypass, DoS, SSRF, cache confusion) + `npm audit fix` для транзитивных (brace-expansion, js-yaml, nanoid, postcss, undici). 0 уязвимостей.
- **Supabase advisor**: закреплён `search_path` у 5 функций (`get_user_org_id`, `handle_new_user`, `generate_contract_number`, `check_expiring_contracts`, `check_overdue_payments`) — защита от search_path hijacking, поведение не менялось. Миграция `20260828_pin_search_path_on_security_definer_functions.sql`.
- **Не тронуто, требует отдельного разбора** (риск сломать RLS/поиск, не хардить с ходу): `extension_in_public` (pg_trgm, pg_net в public-схеме — перенос может сломать GIN-индексы), `anon`/`authenticated` EXECUTE на SECURITY DEFINER функциях (`get_user_org_id` используется внутри RLS-политик — отзыв EXECUTE у `authenticated` сломает весь доступ к данным), `auth_leaked_password_protection` (тумблер в Supabase Dashboard → Authentication → Policies, не в SQL).
- **Пункт 2 старого списка закрыт** (мусор vs задел, по решению Руслана «улучшай, если стоит, иначе удаляй»):
  - `updateCategoryAction` был без UI → добавлена инлайн-редактура категорий (`CategoryRow.tsx`), было только create+delete.
  - `generateRecurringTransactionsAction` был вообще ничем не вызывался — периодические операции (аренда офиса, зарплаты) **никогда не создавались повторно** после первого раза, несмотря на текст на странице «автоматически создаются». Вынес логику в `features/accounting/services/recurring.service.ts`, добавил ежедневный cron `/api/cron/generate-recurring-transactions` (см. `vercel.json`) + кнопку «Сгенерировать сейчас» на странице.
  - `resetPassword` — вообще не было UI (`/forgot-password`, `/reset-password` не существовали), и `middleware.ts` держал в публичных путях несуществующий `/auth/reset-password`, пока сам экшен редиректил на другой, тоже несуществующий путь. Собран полный флоу: `/forgot-password` → email → `/auth/callback` (PKCE-обмен кода на сессию, тоже был заявлен в middleware, но не существовал) → `/reset-password` → `updatePassword`.
  - `CohabitantSchema`/`InventoryItemSchema` — ложное срабатывание грепового аудита, реально используются внутри `RentApartmentDataSchema`/`CommercialRentDataSchema`, которые в проде и в тестах. Не трогал.
  - Заодно нашёл и закрыл: `categories.actions.ts` и `recurring.actions.ts` были без `requirePermission`, хотя соседний `accounting.actions.ts` в том же модуле — с ним. Тот же паттерн пропуска, что уже был в аудите 27–28.08 (PaymentsSection).
- Next.js 16.3.3 ужесточил тайпчек Server Actions в `next build` (не в чистом `tsc --noEmit`) — при правке `categories.actions.ts`/`recurring.actions.ts` вылезли ошибки доступа к `.error` на union-типе в зависимых клиентских компонентах (`res?.error` невалиден, когда `error` есть не у всех членов union). Заменено на `'error' in res`. Другие 15 файлов с похожим паттерном по всему репо build прошли чисто — не трогал их превентивно, но если при следующей правке рядом с ними всплывёт та же ошибка — паттерн известен.

**Блокеры, не решаемые из сессии:**
1. **Push в GitHub недоступен** — в этом окружении не настроен git-credential (нет PAT/gh auth). Все изменения только закоммичены локально, ждут push.
2. **Supabase-миграции внутри сессии** — под permission-классификатором Claude Code, каждую операцию с прод-БД нужно одобрять явно (уже сделано разово для search_path-фикса).

## Открытые вопросы после сессии 27–28.08.2026 (аудит + E2E)

Сделано в этой сессии (см. git log 27–28.08.2026 для деталей):
- Аудит мёртвого кода по всему `src/` (405 экспортов, грепом), удалено подтверждённо неиспользуемое
- `requirePermission` подключён в `payments.actions.ts` и `accounting.actions.ts` (create/update/delete) — раньше проверки прав по роли нигде не вызывались, кроме одной ручной проверки в `deletePaymentAction`
- Обнаружено и исправлено: карточка договора (`PaymentsSection`) читала из мёртвой таблицы `payments`, хотя ещё в июне (`003e71d`) всё было осознанно перенесено на `accounting_transactions` — виджет просто забыли переключить. Переключён, добавлены `createContractPaymentAction`/`completeTransactionAction`, инлайн без редиректа (заодно чинит потерю `contract_id`)
- Удалены как подтверждённо мёртвые: весь `payments.actions.ts`, `/payments/[id]/edit`, старые компоненты `MarkPaidButton`/`DeletePaymentButton`/6 payments-компонентов, легаси `createClientAction`/`updateClientAction`
- SQL-функция `mark_overdue_payments()` дропнута (была мёртвая)
- Настроена E2E-инфраструктура: Playwright + OpenRouter vision-модель, `.github/workflows/e2e-tests.yml` (workflow_dispatch), результат постится комментарием к коммиту через `api.github.com` — читается напрямую без скачивания артефактов
- Подтверждено E2E-прогоном на реальных прод-данных: права работают, виджет платежей на карточке договора рендерится корректно

**Не сделано / требует решения — не откладывать молча, спросить Руслана или явно решить:**
1. ✅ **ЗАКРЫТО ПОЛНОСТЬЮ** — `requirePermission` подключён во всех Server Actions, где role-based модель применима (contacts, deals+comments, leads, properties, tasks, showings, collections, contracts+generate, employees, settings/company, webhooks, api-keys, files, легаси clients). Добавлены ресурсы `tasks`/`showings`/`collections`/`files` в `permissions.ts` — их не было вообще. Заменены все дублирующиеся inline role-check'и (`['admin','manager'].includes(...)`, локальные `requireAdmin()`-хелперы) на единый вызов. Осознанно НЕ гейтили self-service действия (auth, profile, свои настройки/пароль/сессии) и read-only (search) — роль там ни при чём по смыслу. Подтверждено E2E на проде (5/5, дважды подряд после разных партий изменений).
2. ✅ **ЗАКРЫТО (сессия 28.08.2026 вечер)** — `updateCategoryAction`/`generateRecurringTransactionsAction`/`resetPassword` были не мусором, а недособранными фичами — доделаны (инлайн-редактор категорий, cron для периодических операций, полный флоу сброса пароля). `CohabitantSchema`/`InventoryItemSchema` — ложное срабатывание, используются. Детали — в разделе сессии выше.
3. **Dependabot: 24 уязвимости (14 high, 10 moderate)** на GitHub — не разбирали вообще в этой сессии.
4. **Upstash Redis ENV** всё ещё не добавлен в Vercel вручную (тех.долг #1 из старого списка, частично закрыт кодом, не средой).
5. **E2E-покрытие** — сейчас только 5 сценариев вокруг payments/accounting под одним admin-аккаунтом. Остального приложения (leads, deals, properties, tasks, employees, showings, settings, telegram-бот) E2E не касался. Роли `manager`/`agent`/`accountant` не протестированы вообще — нет тестового пользователя с этими ролями.
6. **Общий паттерн из сегодняшнего разбора**: если видишь компонент/экшен, «замененный» другим модулем (как payments → accounting) — **всегда проверяй, что ВСЕ потребители переключены**, не только точки входа (списки/формы). Виджеты, встроенные в другие страницы (как `PaymentsSection` в карточке договора), легко забыть при миграции.

## Порядок закрытия техдолга

> **02.09.2026: приоритеты переехали в `docs/IMPROVEMENTS.md` — он единственный источник.**
> Раньше «что делать дальше» было записано в трёх местах (здесь, в таблице статусов
> CLAUDE.md и в роадмапе Phase 0), и все три говорили разное. Список ниже оставлен как
> история решений, приоритеты по нему больше не берутся.

1. ✅ **ЗАКРЫТО (сессия 28.08.2026 ночь)** — **Rate limiting**: Upstash Redis подключён (Free tier), `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` добавлены в Vercel Production+Preview, redeploy сделан. Код в `src/lib/rate-limit.ts` был готов заранее, изменений не потребовал.
2. **Миграции** — снять baseline-снапшот текущей боевой схемы Supabase, закоммитить как `supabase/migrations/`. Дальше — каждое изменение схемы только через `apply_migration` + обязательный коммит файла миграции в том же PR/пуше (не откладывать).
3. **`any`-типы и декомпозиция больших файлов** — не отдельным спринтом, а *попутно*: трогаешь файл под фичу — заодно убираешь `any` и разбиваешь, если файл >300 строк.
4. ✅ **ЗАКРЫТО (сессия 28.08.2026 ночь)** — **Dependabot**: все 7 открытых PR слиты, security updates/grouped updates уже были включены. 24 алерта (14 high, 10 moderate) закрыты мержем.

