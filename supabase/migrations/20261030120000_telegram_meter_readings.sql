-- ═══════════════════════════════════════════════════════════════════════════
-- Показания счётчиков из Telegram: контур прибора, провенанс сообщения,
-- фотографии и append-only исправления.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Агент присылает показания в группу Telegram (топик объекта). Боту нужно
-- сопоставить свободный текст («ХВС кухня», «ГВС ванная») с конкретным
-- прибором объекта. Одного `kind` мало: воды на кухне и в ванной — два разных
-- счётчика одного вида. Поэтому у прибора появляется свободный `contour` —
-- подпись, как её называет человек, и бот ищет прибор по точному совпадению
-- контура и вида, ничего не заводя сам.
--
-- Источник показания расширяется значением `telegram`, а вместе с ним в строку
-- кладётся провенанс сообщения (чат, топик, сообщение, автор) — без него нельзя
-- ни отличить повторную доставку апдейта, ни ответить, кто именно прислал цифру.
--
-- Исправление показания — append-only: исходная строка не переписывается, новая
-- ссылается на неё через `corrects_reading_id` и несёт причину. Логическим
-- (действующим) считается показание, которое никто не исправлял; начисление и
-- расход считаются по нему.

-- ─── 1. Контур прибора ──────────────────────────────────────────────────────
alter table public.utility_meters add column if not exists "contour" text;

-- Поиск прибора по контуру и виду в рамках объекта — основной запрос бота.
create index if not exists idx_utility_meters_contour
  on public.utility_meters (property_id, kind, contour) where is_active;

-- ─── 2. Провенанс показания и фотографии ────────────────────────────────────
alter table public.meter_readings add column if not exists "source_chat_id" bigint;
alter table public.meter_readings add column if not exists "source_thread_id" bigint;
alter table public.meter_readings add column if not exists "source_message_id" bigint;
alter table public.meter_readings add column if not exists "source_user_id" bigint;
alter table public.meter_readings add column if not exists "source_user_name" text;
alter table public.meter_readings add column if not exists "photo_urls" text[];

-- ─── 3. Источник: добавляем telegram ────────────────────────────────────────
alter table public.meter_readings drop constraint if exists meter_readings_source_check;
alter table public.meter_readings add constraint meter_readings_source_check
  check (source = any (array['manager'::text, 'tenant'::text, 'telegram'::text]));

-- ─── 4. Идемпотентность повторной доставки апдейта ──────────────────────────
-- Telegram может доставить один и тот же апдейт повторно. Ключ — сообщение +
-- прибор: в одном сообщении несколько приборов, поэтому `meter_id` входит в
-- ключ, а не заменяется им.
create unique index if not exists idx_meter_readings_telegram_dedupe
  on public.meter_readings (source_chat_id, source_message_id, meter_id)
  where source = 'telegram' and source_message_id is not null;

-- ─── 5. Append-only исправления ─────────────────────────────────────────────
-- Исходная строка остаётся как есть; новая ссылается на неё и хранит причину.
-- `on delete set null` — удаление исходной строки не должно уносить исправление.
alter table public.meter_readings add column if not exists "corrects_reading_id" uuid
  references public.meter_readings(id) on delete set null;
alter table public.meter_readings add column if not exists "correction_reason" text;

-- Определение «какие показания исправлены» — по обратной ссылке, без UPDATE
-- исходной строки (append-only).
create index if not exists idx_meter_readings_corrects
  on public.meter_readings (corrects_reading_id) where corrects_reading_id is not null;
