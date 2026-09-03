# Phase 1: модель данных

**Фича**: 001-four-process-crm · **Дата**: 2026-09-03

Обозначения: **+таблица** — новая, **~таблица** — изменяется, *таблица* — используется
как есть. Все новые таблицы несут `organization_id uuid not null` и RLS с изоляцией
через `get_user_org_id()`, кроме особо оговорённых.

---

## 1. Направления и стадии

### ~ deals

| Колонка | Было | Стало |
|---|---|---|
| `deal_type` | `rent \| sale \| management \| commercial \| subrent` | `rent_agent \| management \| sale \| tenant_search` — **направление работы** |
| `status` | 7 общих стадий | объединение стадий всех направлений (список ниже) |
| `stage_progress` | — | **новая**, `jsonb not null default '{}'` — закрытые пункты чек-листов: `{"<код стадии>": ["<код пункта>", …]}` |
| `needs_review` | — | **новая**, `boolean not null default false` — направление не удалось определить при миграции |
| `plan_id` | — | **новая**, `uuid references service_plans(id)` — тариф работы, если применим |

Колонки `client_id` и `owner_id` остаются пустыми legacy-ссылками: `DROP COLUMN`
заблокирован хуком, задача на вычистку — #24 в `docs/IMPROVEMENTS.md`.

### Стадии по направлениям

Источник правды — `src/features/directions/config/directions.ts`. CHECK на
`deals.status` принимает объединение всех значений; принадлежность направлению
проверяется в Server Action.

**`rent_agent` — аренда по тарифу «Агент»**

| Код | Название | Обязательное предусловие перехода |
|---|---|---|
| `sourcing` | Поиск и контакт | — |
| `meeting` | Встреча | назначена дата встречи |
| `agency_contract` | Договор с собственником | встреча состоялась |
| `preparation` | Подготовка и реклама | подписан договор `agency_owner`, выбран тариф |
| `showings` | Показы | загружены фотографии, объект опубликован |
| `tenant_check` | Проверка и договор найма | есть заинтересованный арендатор |
| `move_in` | Заселение и комиссия | подписан договор найма |
| `completed` | Завершена | начислена комиссия |
| `cancelled` | Отменена | вне последовательности, требует причины |

**`management` — управление**

| Код | Название | Обязательное предусловие перехода |
|---|---|---|
| `sourcing` | Поиск и контакт | — |
| `meeting` | Встреча | назначена дата встречи |
| `mgmt_contract` | Договор управления | встреча состоялась, выбран тариф и схема расчёта |
| `handover` | Приёмка объекта | подписан договор `property_management` |
| `preparation` | Подготовка и реклама | акт приёма закрыт: начальные показания и опись |
| `showings` | Показы | загружены фотографии, объект опубликован |
| `tenant_check` | Проверка и договор найма | есть заинтересованный арендатор |
| `move_in` | Заселение | подписан договор найма |
| `in_service` | В обслуживании | заведён `management_engagements` — **терминальная стадия воронки**, дальше объект живёт вне сделки |
| `cancelled` | Отменена | требует причины |

**`sale` — продажа и покупка**

| Код | Название | Обязательное предусловие перехода |
|---|---|---|
| `sourcing` | Обращение или поиск | — |
| `valuation` | Встреча и оценка | назначена дата встречи |
| `agency_contract` | Договор с собственником | оценка зафиксирована |
| `docs_check` | Проверка документов | подписан договор с собственником |
| `preparation` | Подготовка и реклама | проверка документов закрыта с результатом |
| `showings` | Показы | объект опубликован |
| `preliminary` | Предварительный договор | есть покупатель |
| `main_contract` | Основной договор | зафиксированы аванс или задаток и срок выхода на сделку |
| `registration` | Регистрация перехода права | подписан основной договор |
| `completed` | Завершена | расчёты закрыты |
| `cancelled` | Отменена | требует причины |

**`tenant_search` — подбор для арендатора**

| Код | Название | Обязательное предусловие перехода |
|---|---|---|
| `inquiry` | Обращение | — |
| `search_contract` | Договор на подбор | зафиксирована комиссия |
| `searching` | Поиск вариантов | **подписан договор `agency_client`** — блокирующее предусловие FR-003 |
| `collection_sent` | Подборка отправлена | собрана подборка объектов |
| `viewings` | Просмотры | подборка отправлена |
| `rent_contract` | Договор найма | выбран объект |
| `completed` | Завершена | начислена комиссия |
| `cancelled` | Отменена | требует причины |

Коды `sourcing`, `meeting`, `preparation`, `showings`, `tenant_check`, `completed`,
`cancelled` намеренно переиспользуются в нескольких направлениях: это один и тот же
шаг с одинаковым смыслом, и общая нумерация упрощает сводную аналитику.

---

## 2. Тарифы

### + service_plans

| Колонка | Тип | Описание |
|---|---|---|
| `id` | uuid pk | |
| `organization_id` | uuid not null | |
| `code` | text not null | `agent`, `management`, `management_premium`, `tenant_search` |
| `title` | text not null | Название как на сайте |
| `charge_type` | text not null | `deal_percent` · `monthly_percent` · `owner_fixed` · `flat_fee` · `negotiated` |
| `rate` | numeric | Процент для `*_percent`, сумма для `flat_fee`; null для `negotiated` и `owner_fixed` |
| `repair_limit` | numeric | Лимит мелкого ремонта за счёт агентства (5000 для тарифа «Управление») |
| `obligations` | jsonb not null default `'[]'` | Список обязательств: `[{code, title}]` |
| `directions` | text[] not null | В каких направлениях тариф применим |
| `is_active` | boolean not null default true | |
| `sort_order` | int not null default 0 | |

Уникальность: `(organization_id, code)`.

Стартовое наполнение (FR-006):

| code | title | charge_type | rate | repair_limit |
|---|---|---|---|---|
| `agent` | Агент по недвижимости | `deal_percent` | 25 | — |
| `management` | Управление | `monthly_percent` | 10 | 5000 |
| `management_premium` | Управление Премиум | `monthly_percent` | 15 | 5000 |
| `tenant_search` | Подбор для арендатора | `negotiated` | — | — |

Схема `owner_fixed` в стартовом наборе не представлена отдельным тарифом: это схема
расчёта конкретного договора управления, а не публичный тариф.

### ~ contracts

| Колонка | Тип | Описание |
|---|---|---|
| `plan_id` | uuid references service_plans(id) | Тариф на момент подписания |
| `plan_rate` | numeric | **Ставка зафиксирована** — правка справочника её не меняет (FR-007) |
| `settlement_scheme` | text | Только для `property_management`: `percent` \| `fixed` |
| `owner_fixed_amount` | numeric | Ежемесячная выплата собственнику при схеме `fixed` |
| `owner_payout_day` | int | День месяца, когда наступает обязательство при схеме `fixed` |

Правила целостности (проверяются в Server Action и триггером):

- `settlement_scheme = 'percent'` → `plan_rate` обязателен, `owner_fixed_amount` пуст.
- `settlement_scheme = 'fixed'` → `owner_fixed_amount` и `owner_payout_day` обязательны.
- `settlement_scheme` заполняется только у `contract_type = 'property_management'`.

Новый индекс `contracts(property_id, start_date desc)` — определение текущего
арендатора и история арендаторов объекта (решение Р-3).

---

## 3. Объект в управлении

### + management_engagements

| Колонка | Тип | Описание |
|---|---|---|
| `id` | uuid pk | |
| `organization_id` | uuid not null | |
| `property_id` | uuid not null references properties(id) | |
| `owner_contact_id` | uuid references contacts(id) | **Обнуляем**, хотя изначально планировался NOT NULL: в боевых данных два объекта в управлении и у обоих `properties.owner_id` пуст. NOT NULL заставил бы выдумать собственника или выбросить запись. Обязательность проверяет Server Action, пробел показывает карточка |
| `contract_id` | uuid references contracts(id) | Договор управления |
| `plan_id` | uuid references service_plans(id) | |
| `settlement_scheme` | text | `percent` \| `fixed`. Обнуляем по той же причине: у перенесённых записей схема неизвестна, а угадывать её нельзя — от неё зависит, кто несёт риск простоя |
| `rate` | numeric | Ставка при `percent` |
| `owner_fixed_amount` | numeric | Сумма при `fixed` |
| `owner_payout_day` | int | День месяца обязательства при `fixed` |
| `repair_limit` | numeric | Копия лимита из тарифа на момент старта |
| `started_at` | date not null | |
| `ended_at` | date | null = действует |
| `status` | text not null | `onboarding` · `active` · `paused` · `ended` |
| `deal_id` | uuid references deals(id) | Сделка, которая привела к управлению |

Уникальность: не более одного активного обслуживания на объект —
частичный уникальный индекс по `property_id where ended_at is null`.

**Переходы состояний**:

```
onboarding ──(акт приёма закрыт)──► active ──(расторжение)──► ended
                                      │
                                      └──(пауза по договорённости)──► paused ──► active
```

Простой объекта (нет действующего договора найма) — это **не** отдельный статус:
обслуживание остаётся `active`, а простой вычисляется как отсутствие договора найма
со статусом `signed`, покрывающего дату. При схеме `fixed` простой продолжает
порождать обязательство перед собственником (FR-036).

### + property_handovers — акт приёма объекта

| Колонка | Тип | Описание |
|---|---|---|
| `id` | uuid pk | |
| `organization_id` | uuid not null | |
| `engagement_id` | uuid not null references management_engagements(id) | |
| `inventory` | jsonb not null default `'[]'` | Опись имущества: `[{title, condition, note}]` |
| `condition_note` | text | Состояние объекта |
| `keys_count` | int | Переданные ключи |
| `documents` | jsonb not null default `'[]'` | Переданные документы |
| `photo_urls` | text[] | Фотофиксация |
| `completed_at` | timestamptz | null = приёмка не закрыта |
| `created_by` | uuid references users(id) | |

**Правило закрытия** (FR-020): `completed_at` можно проставить только когда по каждому
активному счётчику объекта есть показание с датой не раньше `started_at`, и опись
непуста. Проверка в Server Action, не в БД: сообщение об ошибке должно называть, чего
именно не хватает.

---

## 4. Счётчики

### * utility_meters, * meter_readings — используются как есть

Схема уже существует и пуста, менять нечего:

- `utility_meters`: `property_id`, `kind` (`electricity` · `cold_water` · `hot_water` ·
  `gas` · `heating` · `other`), `unit`, `serial_number`, `tariff`, `is_active`, `title`.
- `meter_readings`: `meter_id`, `reading_date`, `value`, `consumption`, `amount`,
  `note`, `created_by`.

**Что добавляется**: колонка `meter_readings.source` (`manager` \| `tenant`) — требование
FR-021 и FR-042 о пометке источника показания.

**Поправка к плану.** Здесь было записано, что счётчикам «нужен только интерфейс».
Это неверно: интерфейс тоже был — `src/features/properties/components/MetersPanel.tsx`
и `src/features/properties/actions/meters.actions.ts` умеют заводить приборы,
вносить показания и считать расход с начислением. Написанный параллельно
модуль `src/features/meters/{actions,components}` оказался дублем и удалён.
Действительно новыми были только три вещи, и они дописаны в существующий код:
пометка источника, поиск аномалий и проверка даты из будущего (её не было, и
опечатка в годе ломала расчёт расхода на следующем показании).

**Правила расчёта** (FR-022):
- `consumption` = `value` текущего − `value` предыдущего по тому же счётчику.
- `amount` = `consumption` × `utility_meters.tariff`, если тариф задан.
- Аномалии: `value` меньше предыдущего; разрыв больше 45 дней между показаниями;
  `consumption` отклоняется от среднего за 6 периодов более чем втрое.

---

## 5. Деньги и взаиморасчёт

### ~ accounting_transactions

| Колонка | Тип | Описание |
|---|---|---|
| `engagement_id` | uuid references management_engagements(id) | Объект в управлении |
| `borne_by` | text | `agency` \| `owner` — за чей счёт расход (FR-026) |

Существующие колонки покрывают остальное: `property_id`, `contract_id`, `contact_id`,
`type` (`income`/`expense`), `status` (`planned`/`completed`/`cancelled`), `amount`,
`date`, `due_date`, `paid_at`, `period_start`, `period_end`, `category_id`.

### ~ accounting_categories — системные категории

Добавляются с признаком `is_system` (новая колонка `boolean not null default false`),
чтобы их нельзя было удалить из интерфейса:

| Код | Тип | Назначение |
|---|---|---|
| `tenant_payment` | income | Поступление от арендатора по объекту в управлении |
| `agency_fee` | income | Вознаграждение агентства |
| `owner_payout` | expense | Выплата собственнику |
| `repair_minor` | expense | Мелкий ремонт |
| `cleaning` | expense | Клининг |
| `utilities` | expense | Коммунальные платежи |
| `contractor` | expense | Услуги подрядчиков |

### Расчёт сальдо

Считается запросом, колонкой не хранится (решение Р-5). Формулы — в
[research.md](./research.md#р-5-где-вести-деньги-управления-и-как-считать-сальдо).

Ключевая развилка по схемам:

| | `percent` | `fixed` |
|---|---|---|
| Когда возникает обязательство перед собственником | при поступлении от арендатора | по календарю, `owner_payout_day` каждого месяца |
| Вознаграждение агентства | `rate` % от поступления | поступление − фиксированная выплата − расходы агентства |
| Простой объекта | обязательства нет, вознаграждения нет | обязательство есть, вознаграждение отрицательное |
| Что видит собственник в отчёте | поступления, удержание, расходы, к выплате | обязательство, факт выплаты, расходы за его счёт |

---

## 6. Регламент обслуживания

### + management_regulations — шаблон регламента

| Колонка | Тип | Описание |
|---|---|---|
| `id` | uuid pk | |
| `organization_id` | uuid not null | |
| `plan_id` | uuid references service_plans(id) | Для какого тарифа |
| `code` | text not null | `meter_reading` · `rent_collection` · `owner_payout` · `inspection` · `contract_expiry` · `seasonal` |
| `title` | text not null | Заголовок порождаемой задачи |
| `period` | text not null | `monthly` · `quarterly` · `semiannual` · `annual` · `on_event` |
| `day_of_month` | int | Для периодических |
| `lead_days` | int not null default 0 | За сколько дней до срока создавать задачу |
| `is_active` | boolean not null default true | |

Различие тарифов «Управление» и «Управление Премиум» (FR-024) выражается именно
здесь: у премиума проверки объекта чаще, добавляются пересмотр ставки и работа с УК.

### ~ tasks

| Колонка | Тип | Описание |
|---|---|---|
| `engagement_id` | uuid references management_engagements(id) | К какому объекту в управлении |
| `regulation_code` | text | По какому правилу создана; пусто у ручных задач |

Уникальный частичный индекс `(engagement_id, regulation_code, due_date) where
regulation_code is not null` — защита от дублей при повторном прогоне крона.

---

## 7. Заявки на бытовые услуги

### + service_requests

| Колонка | Тип | Описание |
|---|---|---|
| `id` | uuid pk | |
| `organization_id` | uuid not null | |
| `engagement_id` | uuid references management_engagements(id) | |
| `property_id` | uuid not null references properties(id) | |
| `contact_id` | uuid not null references contacts(id) | Заявитель — арендатор |
| `category` | text not null | `cleaning` · `plumbing` · `electrical` · `appliance` · `other` |
| `description` | text not null | |
| `photo_urls` | text[] | |
| `status` | text not null default `'new'` | `new` · `accepted` · `in_progress` · `done` · `rejected` |
| `task_id` | uuid references tasks(id) | Порождённая задача ответственному |
| `transaction_id` | uuid references accounting_transactions(id) | Расход по выполненной заявке |
| `created_at` | timestamptz not null default now() | |
| `closed_at` | timestamptz | |

**Переходы**: `new → accepted → in_progress → done`; из `new` и `accepted` возможен
`rejected` с причиной. Каждый переход виден арендатору в кабинете (FR-040).

---

## 8. Доступ в личные кабинеты

### + portal_access

| Колонка | Тип | Описание |
|---|---|---|
| `id` | uuid pk | |
| `organization_id` | uuid not null | |
| `contact_id` | uuid not null references contacts(id) | |
| `role` | text not null | `owner` \| `tenant` |
| `property_id` | uuid references properties(id) | Объект, к которому даётся доступ |
| `engagement_id` | uuid references management_engagements(id) | |
| `contract_id` | uuid references contracts(id) | Договор найма — для арендатора |
| `phone` | text not null | Номер для входа, нормализованный |
| `granted_at` | timestamptz not null default now() | |
| `revoked_at` | timestamptz | Отзыв доступа (FR-039) |
| `last_login_at` | timestamptz | |

### + portal_otp

| Колонка | Тип | Описание |
|---|---|---|
| `id` | uuid pk | |
| `phone` | text not null | |
| `code_hash` | text not null | Код хранится **только хешем** |
| `channel` | text not null | `telegram` \| `sms` |
| `expires_at` | timestamptz not null | Минуты, не часы |
| `attempts` | int not null default 0 | |
| `consumed_at` | timestamptz | |

**RLS**: обе таблицы — единственное место, где изоляция строится не только на
`get_user_org_id()`. Сотрудники организации видят их по обычному правилу; внешний
посетитель не читает их вовсе — проверка идёт в серверном коде по подписанной сессии,
а данные кабинета выбираются сервисным слоем с явным ограничением по `portal_access`.
Обоснование отступления — в [plan.md](./plan.md#отступление-требующее-обоснования).

---

## 9. Порядок миграций

Каждая — отдельным файлом через `apply_migration`, с перегенерацией типов после
каждой. Ни одна не удаляет таблицы, колонки и данные.

| № | Файл | Что делает | Очередь |
|---|---|---|---|
| 1 | `..._service_plans.sql` | Таблица тарифов, RLS, стартовые четыре позиции | 1 |
| 2 | `..._deals_directions.sql` | Колонки `stage_progress`, `needs_review`, `plan_id`; перенос значений `deal_type`; новые CHECK на `deal_type` и `status` | 1 |
| 3 | `..._contracts_plan_terms.sql` | `plan_id`, `plan_rate`, `settlement_scheme`, `owner_fixed_amount`, `owner_payout_day`; индекс `(property_id, start_date desc)` | 1 |
| 4 | `..._management_engagements.sql` | Таблица обслуживания, RLS, частичный уникальный индекс; заведение записи для существующего объекта в управлении | 2 |
| 5 | `..._property_handovers.sql` | Акт приёма, RLS | 2 |
| 6 | `..._meter_readings_source.sql` | `meter_readings.source` | 2 |
| 7 | `..._accounting_settlement.sql` | `engagement_id`, `borne_by`, `accounting_categories.is_system`, системные категории | 2 |
| 8 | `..._management_regulations.sql` | Шаблон регламента, RLS, `tasks.engagement_id`, `tasks.regulation_code`, уникальный индекс от дублей | 2 |
| 9 | `..._service_requests.sql` | Заявки на услуги, RLS | 3 |
| 10 | `..._portal_access.sql` | `portal_access`, `portal_otp`, RLS | 3 |

**Миграция 2 — критическая**, потому что переписывает CHECK на живой колонке. Порядок
внутри файла: сначала снять старый констрейнт, затем перенести данные, затем поставить
новый. Обратный порядок падает на существующих строках.
