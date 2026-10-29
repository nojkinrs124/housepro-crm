# HousePro Telegram-бот (@HouseProAI_bot) — карта для навигации

Один бот, два независимых контура + серия самостоятельных уведомлений. Если
задача — добавить сценарий владельцу/клиенту или новое `notify*`, сначала
определи, в какой из ветвей оно попадает, не придумывай новую интеграцию.

## Ветка 1: входящий Telegram-апдейт от тебя/сотрудника

```
webhook → webhook/router.ts routeTelegramUpdate()
  │  идемпотентность (claimUpdate/markDone/markFailed)
  ├─ message        → handlers/message.ts handleMessage()
  └─ callback_query → handlers/callback/index.ts handleCallbackQuery()
```

Роль (admin/member/stranger) вычисляется один раз в `webhook/context.ts
resolveActor()` из `channel_bot_settings.admin_telegram_user_id` +
`bot_allowed_users`, передаётся дальше объектом `BotActor` — не перевычисляй
её внутри нового обработчика.

**Права — одна таблица `CAPABILITIES` в `features/telegram/services/permissions.ts`**
(аудит BOT-10, 28.10.2026): ключи `screen:*`, `tool:*`, `action:*` (бывает пара
`action:prop:find`), `intent:*`, `command:*`, `prompt:*`. Один `can(role, key)`;
**нет ключа → нет доступа** (кроме владельца). Новая возможность с ролью = строка
в этой таблице; `if (actor.role !== 'admin')` в обработчиках НЕ ПИСАТЬ — именно
россыпь таких проверок была источником P0 «сотрудник видит оборот агентства».
Кнопки проверяет диспетчер `callback/index.ts` (`canRunCallback`: `nav` — по
экрану, `confirm/cancel` — уровень сотрудника, неизвестная кнопка — «устарела»),
текстовые формы — `canFulfilIntentKey` в цепочке `pending-input.ts`.
`MEMBER_SCREENS` и `ADMIN_ONLY_TOOLS` — ПРОИЗВОДНЫЕ от таблицы, не отдельные
списки. Кнопки меню собираются по `canOpenScreen` (root/today/crm в `menu.ts`),
чтобы «показать» и «разрешить» не разъезжались. Тест покрытия —
`src/tests/unit/telegram-permissions.test.ts`: новый экран/инструмент без строки
в таблице валит его.

Текст И голос в `handleMessage()` проходят ОДНУ цепочку «состояния, которые ждут
ввод» — `handlers/pending-input.ts: routePendingInput()` в фиксированном порядке:
формы кнопок (`awaiting_intent`: add_bot_user, find_property/contact, add_money,
set_timezone, слот расписания, промпт рубрики) → сессия «Занести в CRM»
(`routeIntakeText`) → `tryHandleChannelInput` → `handleUserTurn()` (LLM). Раньше у
голоса была отдельная урезанная копия цепочки и другой приоритет intake —
поведение текста и голоса расходилось (голосом нельзя было ответить на половину
форм). Slash-команды (`/start`, `/menu`, `/help`, `/repair_cta`) обрабатываются в
`message.ts` до цепочки. Правило: новый text-intent-перехватчик добавляется в
`pending-input.ts` в правильную позицию, а НЕ отдельным вызовом в `message.ts`.

`handleUserTurn()` (webhook/dialog/turn.ts) — цикл до 4 раундов с OpenRouter.
Два класса инструментов в `src/lib/telegram/tools.ts`:
- `MUTATING_TOOLS` (create_lead, update_deal_status, add_transaction,
  create_property, update_property_status, create_task, complete_task,
  add_meter_readings) — НИКОгда выполняются сразу внутри turn.ts; вместо
  этого пишутся в `bot_pending_actions` (батчем, один `batch_id` на все мутации
  одного раунда) и бот спрашивает кнопками ✅/❌; реальное выполнение — только
  в `handlers/callback/batch.ts handleConfirmOrCancel()` по нажатию `confirm`.
- всё остальное (get_deals, get_finance_summary, list_properties, get_client, ...)
  — read-only, выполняются сразу внутри цикла без подтверждения, бьют в
  `/api/v1/*` с `HOUSEPRO_BOT_API_KEY`.

Добавляя новый инструмент боту: реши одним вопросом владельцу, нужен ли
  ставить его в MUTATING_TOOLS (пишет в CRM) — подтверждение обязательно,
  без явного исключения владельца (см. ветку 2). Ещё обязательные решения
  (аудит 28.10.2026, `docs/audit-remediation/PATCHLOG.md` раздел BOT-01..07):
  * **Роль.** `canUseTool(role, name)` из `features/telegram/services/access.ts`;
    деньги и раздел «Канал» (`ADMIN_ONLY_TOOLS`) закрыты для `member` так же, как
    их экраны в `MEMBER_SCREENS`. `toolDefinitionsFor(role)` фильтрует схему для
    модели; проверка в `dispatchReadOnlyTool`/`executeConfirmedMutation` — второй
    слой (батч подтверждения живёт в БД — допуск мог измениться).
  * **Стоимость.** Платный инструмент (генерация, веб-поиск) или тот, что шлёт
    сообщения, — в `COSTLY_TOOLS`: не больше `COSTLY_CALLS_PER_TURN` за ход,
    иначе модель зовёт его несколько раз за цикл из 4 раундов.
  * **Контракт параметров.** Каждый параметр из `TOOL_DEFINITIONS` обязан
    читаться в `tools.ts` как `args.<name>` и доходить до API
    (`get_deals.deal_type` терялся на обоих шагах). Тест —
    `src/tests/unit/telegram-tool-permissions.test.ts`.
  * **Деньги — только через `/api/v1/accounting/summary`.** Итоги за период считает
    `features/accounting/services/finance-summary.ts` (`summarizeFinance`):
    постраничный обход всей выборки + деление `agencyRevenue` / `transitIncome`
    тем же предикатом, что витрина (`isAgencyRevenue`). Не суммируй `type='income'`
    по одной странице (`meta.summary` в `/accounting/transactions` помечен
    `summary_scope: 'page'`) — иначе на 200+ операциях доход молча занижается и
    смешивается с транзитом.

## Ветка 2: автодиалог с клиентами в Авито (без Telegram со стороны клиента)

```
pg_cron → GET /api/cron/avito-messenger  (каждый опрос по всем is_enabled организациям)
  → fetchAvitoChats(unreadOnly) → найти/создать лид по тегу avito:<chat_id>
  → logCommunication() каждой сообщения
  → runAvitoDialogTurn() [features/avito/services/avito-dialog.service.ts]
```

Решение владельца: этот бот ведёт диалог САМ и сам вызывает
`create_showing` БЕЗ подтверждения (один агент, редкие конфликты расписания
некритичны) — другая модель, чем у Telegram-бота ветки 1. Не копируй паттерн
подтверждения сюда и наоборот — без повторного вопроса владельцу, какая из двух
моделей нужна новому сценарию.

История диалога — отдельная таблица `avito_conversations` (не `bot_conversations`
ветки 1). Системный промпт и список инструментов бота — `SYSTEM_PROMPT`/`TOOLS`
в `avito-dialog.service.ts`; прямого UI-переключателя нет — менять поведение значит
редактировать эти файлы и деплоить.

## Ветка 3: бот сам пишет владельцу (без входящего апдейта)

Реестр `src/lib/telegram/notify.ts`: `NOTIFICATIONS` (событие → `label` +
чистый `build(payload)`), отправка одна — `notify(event, orgId, payload)`, всегда
гасит свои исключения (сбой Telegram не должен ронять основной сценарий) и бьёт
в `admin_telegram_user_id` из `channel_bot_settings`. Сейчас в реестре
`new_lead` и `avito_escalation`; `notify-lead.ts` — тонкая обёртка для старых мест
вызова (`notifyNewLead`/`notifyAvitoEscalation`). Отдельно от реестра — кроны
(daily-digest, channel-weekly-summary, payment-reminders, channel-heartbeat) и
`sendDraftForReview` в `channel.ts`.

Новое «бот должен сообщить владельцу о X» (любая ветвь, не только Авито) —
запись в `NOTIFICATIONS` с типом нагрузки в `NotificationPayloads` + один вызов
`notify(...)` из места события. Шаблон держи чистой функцией — тогда он тестируется
без сети и переиспользуется в дайджесте. Не создавай отдельную интеграцию и не
предполагай, что нужен другой Telegram-бот, пока владелец явно не попросил
развести каналы.

## Что там настроено в Vercel/БД

| Что | Где |
|---|---|
| Админ (кто получает уведомления) | `channel_bot_settings.admin_telegram_user_id` |
| Кто ещё допущен к боту | таблица `bot_allowed_users` |
| Токен бота | `TELEGRAM_BOT_TOKEN` в Vercel (sensitive, API не возвращает значение) |
| Username бота | `TELEGRAM_BOT_USERNAME` = `@HouseProAI_bot` |
| История диалога (CRM-бот) | `bot_conversations` |
| История диалога (Авито-бот) | `avito_conversations` |
| Отложенные мутации до подтверждения | `bot_pending_actions` |
| LLM | OpenRouter, `OPENROUTER_MODEL`/`OPENROUTER_LISTING_MODEL` |
| CRM API, который дёргает бот | `/api/v1/*` с `HOUSEPRO_BOT_API_KEY` (`src/lib/telegram/tools.ts`) |
