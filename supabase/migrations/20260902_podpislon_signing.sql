-- ═══════════════════════════════════════════════════════════════════════════
-- Подписание договоров через внешний сервис ПЭП «Подпислон»
-- ═══════════════════════════════════════════════════════════════════════════
-- В CRM уже есть собственная простая электронная подпись (код на email,
-- 20260901_contract_signatures.sql). Она остаётся: это бесплатный путь для
-- случаев, когда агентству достаточно внутреннего доказательства.
--
-- «Подпислон» решает другую задачу: подписание идёт кодом из СМС на стороне
-- лицензированного оператора, который сам хранит протокол подписания и выдаёт
-- подписанный PDF. В спорной ситуации доказательство даёт третья сторона, а не
-- мы сами — поэтому оба способа живут рядом, а не заменяют друг друга.
--
-- Отдельную таблицу не заводим: запрос на подпись остаётся запросом на подпись,
-- меняется только исполнитель. Поле provider разделяет их, а внешние
-- идентификаторы нужны, чтобы связать вебхук сервиса с нашим договором.

-- ─── Учётные данные интеграции ──────────────────────────────────────────────
-- channel_integrations уже хранит ключи телефонии, WhatsApp и эквайринга.
-- У подписи ровно та же форма настроек: провайдер, ключ, секрет вебхука.
alter table public.channel_integrations drop constraint if exists channel_integrations_kind_check;
alter table public.channel_integrations add constraint channel_integrations_kind_check
  check (kind = any (array['telephony'::text, 'whatsapp'::text, 'payments'::text, 'signing'::text]));

-- ─── Запрос на подпись во внешнем сервисе ───────────────────────────────────
alter table public.contract_signatures
  add column if not exists "provider" text not null default 'internal',
  -- ID документа в сервисе (FILE_ID в вебхуках) и ID пакета (для переотправки ссылки).
  add column if not exists "external_id" text,
  add column if not exists "external_package_id" text,
  -- Персональная ссылка на подписание: показываем её менеджеру, чтобы он мог
  -- продублировать клиенту в мессенджер, если СМС не дошла.
  add column if not exists "sign_url" text,
  -- Сырой код статуса сервиса (10/15/20/30/35/40) — нужен для диагностики,
  -- наш status хранит уже нормализованное значение.
  add column if not exists "provider_status" text,
  -- Подписанный PDF, выгруженный из сервиса в наше хранилище.
  add column if not exists "signed_document_url" text,
  add column if not exists "opened_at" timestamptz,
  -- Редакция текста согласий (ПЭП + 152-ФЗ), подшитых к отправленному файлу.
  add column if not exists "consent_version" text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'contract_signatures_provider_check') then
    alter table public.contract_signatures add constraint contract_signatures_provider_check
      check (provider = any (array['internal'::text, 'podpislon'::text]));
  end if;
end $$;

-- Вебхук приходит с FILE_ID — по нему находим запись, поэтому индекс обязателен.
create index if not exists idx_contract_signatures_external
  on public.contract_signatures(provider, external_id)
  where external_id is not null;
