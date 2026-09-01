-- ═══════════════════════════════════════════════════════════════════════════
-- Единая лента коммуникаций: звонки, мессенджеры, письма
-- ═══════════════════════════════════════════════════════════════════════════
-- В карточке клиента невозможно было увидеть, когда с ним в последний раз
-- общались: звонков система не знала вообще, письма жили в email_log,
-- сообщения — нигде. lead_activities покрывала только лидов и заполнялась
-- вручную.
--
-- Одна таблица на все каналы, а не таблица на канал: лента показывается
-- единым списком, и любой новый канал (SMS, Авито) добавляется значением
-- в channel, без миграции схемы и правки всех выборок.

create table if not exists public."communications" (
  "id" uuid not null default gen_random_uuid() primary key,
  "organization_id" uuid not null references public.organizations(id) on delete cascade,

  "channel" text not null
    check (channel = any (array['call'::text, 'email'::text, 'whatsapp'::text,
                                'telegram'::text, 'sms'::text, 'note'::text,
                                'meeting'::text, 'avito'::text])),
  "direction" text not null default 'outbound'
    check (direction = any (array['inbound'::text, 'outbound'::text, 'internal'::text])),
  "status" text,

  "occurred_at" timestamptz not null default now(),
  "duration_sec" integer,
  "subject" text,
  "body" text,
  "recording_url" text,

  -- Кто с кем говорил. Номера храним как есть от провайдера и в нормальном виде:
  -- по нормализованному ищем контакт, «как есть» нужен для разбора инцидентов.
  "from_number" text,
  "to_number" text,
  "counterparty_phone" text,

  -- Связи. Все опциональны: входящий звонок с неизвестного номера тоже должен
  -- сохраниться — иначе он просто потеряется.
  "contact_id" uuid references public.contacts(id) on delete set null,
  "lead_id" uuid references public.leads(id) on delete set null,
  "deal_id" uuid references public.deals(id) on delete set null,
  "property_id" uuid references public.properties(id) on delete set null,
  "user_id" uuid,

  -- Дедупликация вебхуков: провайдеры шлют одно событие несколько раз
  -- и требуют идемпотентности на стороне приёмника.
  "provider" text,
  "external_id" text,

  "created_at" timestamptz not null default now()
);

create unique index if not exists idx_communications_external
  on public.communications(provider, external_id)
  where provider is not null and external_id is not null;

create index if not exists idx_communications_contact
  on public.communications(contact_id, occurred_at desc) where contact_id is not null;
create index if not exists idx_communications_lead
  on public.communications(lead_id, occurred_at desc) where lead_id is not null;
create index if not exists idx_communications_deal
  on public.communications(deal_id, occurred_at desc) where deal_id is not null;
create index if not exists idx_communications_org_time
  on public.communications(organization_id, occurred_at desc);
create index if not exists idx_communications_phone
  on public.communications(organization_id, counterparty_phone)
  where counterparty_phone is not null;

alter table public.communications enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies
    where policyname = 'org members can view communications' and tablename = 'communications') then
    create policy "org members can view communications" on public.communications
      for select to authenticated using (organization_id = public.get_user_org_id());
  end if;

  if not exists (select 1 from pg_policies
    where policyname = 'org members can insert communications' and tablename = 'communications') then
    create policy "org members can insert communications" on public.communications
      for insert to authenticated with check (organization_id = public.get_user_org_id());
  end if;

  if not exists (select 1 from pg_policies
    where policyname = 'org members can update communications' and tablename = 'communications') then
    create policy "org members can update communications" on public.communications
      for update to authenticated
      using (organization_id = public.get_user_org_id())
      with check (organization_id = public.get_user_org_id());
  end if;

  if not exists (select 1 from pg_policies
    where policyname = 'org members can delete communications' and tablename = 'communications') then
    create policy "org members can delete communications" on public.communications
      for delete to authenticated using (organization_id = public.get_user_org_id());
  end if;
end $$;

-- ─── Настройки интеграций каналов ───────────────────────────────────────────
-- Учётные данные телефонии и WhatsApp у каждой организации свои, поэтому
-- хранятся в БД, а не в переменных окружения (в отличие от почты, где
-- отправитель общий для всего SaaS).
create table if not exists public."channel_integrations" (
  "id" uuid not null default gen_random_uuid() primary key,
  "organization_id" uuid not null references public.organizations(id) on delete cascade,
  -- 'payments' здесь же, а не отдельной таблицей: у эквайринга ровно та же
  -- форма настроек — провайдер, учётные данные и секрет вебхука.
  "kind" text not null check (kind = any (array['telephony'::text, 'whatsapp'::text, 'payments'::text])),
  "provider" text not null,
  "is_active" boolean not null default true,
  -- Секреты провайдера. RLS закрывает таблицу от чужих организаций, а внутри
  -- организации доступ к настройкам и так только у админа.
  "credentials" jsonb not null default '{}'::jsonb,
  -- Секрет для проверки входящих вебхуков этой организации.
  "webhook_secret" text,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  unique (organization_id, kind)
);

create index if not exists idx_channel_integrations_secret
  on public.channel_integrations(webhook_secret) where webhook_secret is not null;

alter table public.channel_integrations enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies
    where policyname = 'org members manage channel integrations' and tablename = 'channel_integrations') then
    create policy "org members manage channel integrations" on public.channel_integrations
      for all to authenticated
      using (organization_id = public.get_user_org_id())
      with check (organization_id = public.get_user_org_id());
  end if;
end $$;

-- ─── Внутренний номер сотрудника ────────────────────────────────────────────
-- АТС присылает в вебхуке добавочный номер оператора. Без сопоставления
-- «добавочный → сотрудник» звонок попадает в ленту без автора, и непонятно,
-- кто именно разговаривал с клиентом.
alter table public.users add column if not exists "phone_extension" text;

create index if not exists idx_users_phone_extension
  on public.users(organization_id, phone_extension) where phone_extension is not null;
