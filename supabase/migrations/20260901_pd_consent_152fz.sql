-- ═══════════════════════════════════════════════════════════════════════════
-- Согласие на обработку персональных данных (152-ФЗ)
-- ═══════════════════════════════════════════════════════════════════════════
-- Агентство обрабатывает ПДн физлиц (вплоть до паспортов — есть бакет passports),
-- а факт получения согласия нигде не фиксировался: форма на сайте лишь писала
-- «нажимая кнопку, вы соглашаетесь». При проверке или споре доказать согласие
-- нечем — нужна отметка времени, версия текста и источник.
--
-- Храним не сам текст согласия, а его версию: политика меняется, и важно знать,
-- с какой редакцией согласился конкретный человек.

alter table public.leads    add column if not exists "consent_pd_at" timestamptz;
alter table public.leads    add column if not exists "consent_pd_version" text;
alter table public.leads    add column if not exists "consent_source" text;

alter table public.contacts add column if not exists "consent_pd_at" timestamptz;
alter table public.contacts add column if not exists "consent_pd_version" text;
alter table public.contacts add column if not exists "consent_source" text;

-- Отзыв согласия: по закону субъект вправе его отозвать, и после этого данные
-- нельзя использовать для рассылок. Крон писем обязан это учитывать.
alter table public.leads    add column if not exists "consent_revoked_at" timestamptz;
alter table public.contacts add column if not exists "consent_revoked_at" timestamptz;

create index if not exists idx_contacts_consent
  on public.contacts(organization_id, consent_pd_at)
  where consent_pd_at is not null;
