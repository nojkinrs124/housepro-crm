-- ═══════════════════════════════════════════════════════════════════════════
-- GAP RECONSTRUCTION — изменения схемы прода за 2026-07-20 … 2026-08-31,
-- файлы которых не попали в репозиторий.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- КОНТЕКСТ: после baseline-снапшота (00000000000000/…01) на проде через
-- apply_migration прошёл 21 файл, которых нет в supabase/migrations/:
--   channel_bot_settings_* (07.22–07.26), widen_awaiting_intent_for_schedule_ui,
--   phase4_cleanup_rubric_constraints_and_dead_columns, phase4b_awaiting_intent_…,
--   revoke_anon_authenticated_execute_on_internal_functions,
--   create_avito_integration, seed_avito_settings_default_org,
--   add_deal_id_to_contracts, fix_overdue_payments_check_and_dedupe_notifications,
--   add_avito_feed_contact_phone_fn, add_property_photos_delete_policy,
--   add_site_publish_to_properties, anon_select_published_properties,
--   create_public_company_contacts_view, normalize_existing_phone_numbers,
--   deal_card_fields_and_registry_columns, accounting_category_colors_to_kabinet_palette.
-- Дословный текст не восстановить (Supabase не хранит query), поэтому файл —
-- реконструкция по information_schema/pg_catalog прода (2026-09-16), в порядке
-- «колонки → констрейнты → индексы → функции → политики → view → storage».
--
-- ЭТОТ ФАЙЛ НЕ ПРИМЕНЯЛСЯ К ПРОДУ — там всё уже есть. Все операторы идемпотентны,
-- чтобы репозиторий снова воспроизводил прод-схему на чистой базе
-- (локальный Supabase, dev-ветка, восстановление после катастрофы).
-- Версия 20260831235959 выбрана так, чтобы файл шёл после 20260828082031 и до
-- первой сентябрьской миграции, которая на эти объекты опирается.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Колонки ────────────────────────────────────────────────────────────────

-- contacts.manager_id (deal_card_fields_and_registry_columns)
alter table public.contacts add column if not exists manager_id uuid;

-- contracts.deal_id (add_deal_id_to_contracts)
alter table public.contracts add column if not exists deal_id uuid;

-- files.deal_id
alter table public.files add column if not exists deal_id uuid;

-- deals: номер в реестре + поля карточки (deal_card_fields_and_registry_columns)
create sequence if not exists public.deals_number_seq;
alter table public.deals add column if not exists deal_number integer default nextval('public.deals_number_seq'::regclass);
alter sequence public.deals_number_seq owned by public.deals.deal_number;
alter table public.deals add column if not exists advance_amount numeric;
alter table public.deals add column if not exists bank_approval_date date;
alter table public.deals add column if not exists bank_name text;
alter table public.deals add column if not exists bargain_amount numeric;
alter table public.deals add column if not exists down_payment numeric;
alter table public.deals add column if not exists expected_close_date date;
alter table public.deals add column if not exists payment_method text;
alter table public.deals add column if not exists source text;
alter table public.deals add column if not exists updated_at timestamptz default now();

-- properties: Avito (create_avito_integration), сайт (add_site_publish_to_properties),
-- реестровые поля (deal_card_fields_and_registry_columns)
alter table public.properties add column if not exists avito_ad_id text;
alter table public.properties add column if not exists avito_error text;
alter table public.properties add column if not exists avito_publish boolean not null default false;
alter table public.properties add column if not exists avito_status text;
alter table public.properties add column if not exists avito_synced_at timestamptz;
alter table public.properties add column if not exists cadastral_number text;
alter table public.properties add column if not exists encumbrances text;
alter table public.properties add column if not exists land_area numeric;
alter table public.properties add column if not exists site_publish boolean not null default false;

-- channel_bot_settings: мёртвые колонки сняты на проде
-- (phase4_cleanup_rubric_constraints_and_dead_columns) — расписание живёт в
-- channel_schedule/channel_rubrics.
alter table public.channel_bot_settings drop column if exists draft_send_hour;
alter table public.channel_bot_settings drop column if exists schedule_json;

-- ─── avito_settings (create_avito_integration) ──────────────────────────────

create table if not exists public.avito_settings (
  id uuid not null default gen_random_uuid(),
  organization_id uuid not null,
  client_id text,
  client_secret text,
  access_token text,
  token_expires_at timestamptz,
  avito_user_id text,
  contact_phone text,
  feed_token text not null default encode(gen_random_bytes(16), 'hex'),
  is_enabled boolean not null default true,
  last_synced_at timestamptz,
  last_sync_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'avito_settings_pkey' and connamespace = 'public'::regnamespace) then
    alter table public.avito_settings add constraint avito_settings_pkey primary key (id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'avito_settings_feed_token_key' and connamespace = 'public'::regnamespace) then
    alter table public.avito_settings add constraint avito_settings_feed_token_key unique (feed_token);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'avito_settings_organization_id_key' and connamespace = 'public'::regnamespace) then
    alter table public.avito_settings add constraint avito_settings_organization_id_key unique (organization_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'avito_settings_organization_id_fkey' and connamespace = 'public'::regnamespace) then
    alter table public.avito_settings add constraint avito_settings_organization_id_fkey foreign key (organization_id) references public.organizations(id) on delete cascade;
  end if;
end $$;

alter table public.avito_settings enable row level security;

drop policy if exists "org members access avito settings" on public.avito_settings;
create policy "org members access avito settings" on public.avito_settings
  for all to authenticated
  using (organization_id = public.get_user_org_id())
  with check (organization_id = public.get_user_org_id());

-- Функции публичного фида Avito (create_avito_integration, add_avito_feed_contact_phone_fn).
-- SECURITY DEFINER: фид читается анонимно по токену, RLS обходится намеренно.
create or replace function public.get_avito_feed_properties(p_token text)
returns setof public.properties
language sql
stable security definer
set search_path to 'public'
as $function$
  SELECT p.*
  FROM properties p
  JOIN avito_settings s ON s.organization_id = p.organization_id
  WHERE s.feed_token = p_token
    AND s.is_enabled = true
    AND p.avito_publish = true
    AND p.status = 'available'
$function$;

create or replace function public.get_avito_feed_contact_phone(p_token text)
returns text
language sql
stable security definer
set search_path to 'public'
as $function$
  SELECT contact_phone FROM avito_settings WHERE feed_token = p_token AND is_enabled = true
$function$;

-- ─── Внешние ключи новых колонок ───────────────────────────────────────────

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'contacts_manager_id_fkey' and connamespace = 'public'::regnamespace) then
    alter table public.contacts add constraint contacts_manager_id_fkey foreign key (manager_id) references public.users(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'contracts_deal_id_fkey' and connamespace = 'public'::regnamespace) then
    alter table public.contracts add constraint contracts_deal_id_fkey foreign key (deal_id) references public.deals(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'files_deal_id_fkey' and connamespace = 'public'::regnamespace) then
    alter table public.files add constraint files_deal_id_fkey foreign key (deal_id) references public.deals(id) on delete cascade;
  end if;
end $$;

-- ─── Индексы ────────────────────────────────────────────────────────────────

create index if not exists idx_contacts_manager_id on public.contacts using btree (manager_id);
create index if not exists idx_contracts_deal_id on public.contracts using btree (deal_id);
create index if not exists idx_files_deal_id on public.files using btree (deal_id);
create unique index if not exists idx_deals_number on public.deals using btree (deal_number);
create index if not exists idx_properties_avito_publish on public.properties using btree (organization_id, avito_publish) where (avito_publish = true);
create index if not exists idx_properties_site_publish on public.properties using btree (organization_id, created_at desc) where (site_publish = true);
create index if not exists idx_properties_cadastral_number on public.properties using btree (organization_id, cadastral_number) where (cadastral_number is not null);

-- ─── deals.updated_at через триггер ────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  new.updated_at = now();
  return new;
end $function$;

drop trigger if exists trg_deals_updated_at on public.deals;
create trigger trg_deals_updated_at
  before update on public.deals
  for each row execute function public.set_updated_at();

-- ─── Публичный сайт (anon_select_published_properties, create_public_company_contacts_view) ──

drop policy if exists "anon can view published properties" on public.properties;
create policy "anon can view published properties" on public.properties
  for select to anon
  using (
    site_publish = true
    or exists (
      select 1
      from public.collection_items ci
      join public.property_collections pc on pc.id = ci.collection_id
      where ci.property_id = properties.id and pc.is_public = true
    )
  );

-- security_invoker=false намеренно: сайт читает реквизиты компании анонимно,
-- RLS company_settings через view не применяется. Наружу — только 8 полей.
create or replace view public.public_company_contacts as
  select name, legal_form, inn, ogrn, phone, email, address, website
  from public.company_settings cs
  where is_default = true;

-- ─── Имена политик — как на проде ─────────────────────────────────────────
-- Семантика одинаковая, отличаются только имена (в snapshot они были даны
-- по шаблону «org members can access <table>»). Выравниваем, чтобы
-- сверка схемы прод ↔ репозиторий не давала ложных расхождений.

do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='accounting_recurring_rules' and policyname='org members can access accounting_recurring_rules') then
    alter policy "org members can access accounting_recurring_rules" on public.accounting_recurring_rules rename to "org members can access accounting_recurring";
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='api_keys' and policyname='org members can access api_keys') then
    alter policy "org members can access api_keys" on public.api_keys rename to "org admins manage api keys";
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='webhook_endpoints' and policyname='org members can access webhook_endpoints') then
    alter policy "org members can access webhook_endpoints" on public.webhook_endpoints rename to "org admins manage webhooks";
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='showings' and policyname='org members can access showings') then
    alter policy "org members can access showings" on public.showings rename to "org showings access";
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='property_collections' and policyname='org members can access property_collections') then
    alter policy "org members can access property_collections" on public.property_collections rename to "org collections access";
  end if;
end $$;

-- ─── Storage: бакет аватаров (create_avatars_bucket, 2026-05-29 — до baseline,
-- который storage не покрывал) ────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists "Avatars are publicly viewable" on storage.objects;
create policy "Avatars are publicly viewable" on storage.objects
  for select to public using (bucket_id = 'avatars');

drop policy if exists "Users can upload their own avatar" on storage.objects;
create policy "Users can upload their own avatar" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can update their own avatar" on storage.objects;
create policy "Users can update their own avatar" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ─── Бот канала: CHECK awaiting_intent расширен, rubric_check снят ────────
-- (widen_awaiting_intent_for_schedule_ui, phase4_cleanup_rubric_constraints_and_dead_columns,
--  phase4b_awaiting_intent_generic_input_rubric)

alter table public.channel_bot_settings drop constraint if exists channel_bot_settings_awaiting_intent_check;
alter table public.channel_bot_settings add constraint channel_bot_settings_awaiting_intent_check check (
  awaiting_intent is null
  or awaiting_intent = any (array['case'::text, 'post'::text, 'add_bot_user'::text, 'add_slot'::text, 'add_rubric'::text])
  or awaiting_intent like 'edit_rubric:%'
  or awaiting_intent like 'edit_rubric_image:%'
  or awaiting_intent like 'input_rubric:%'
);

alter table public.channel_posts drop constraint if exists channel_posts_rubric_check;

-- ─── Индекс списка контактов по свежести (deal_card_fields_and_registry_columns) ──

create index if not exists idx_contacts_updated_at on public.contacts using btree (updated_at desc);

-- ─── Уведомления о просрочке и истечении — версии с дедупликацией ──────────
-- (fix_overdue_payments_check_and_dedupe_notifications). Старая
-- check_overdue_payments из baseline работала по замороженной таблице payments;
-- боевая — по accounting_transactions и не плодит повторных уведомлений.

create or replace function public.check_overdue_payments()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  rec record;
begin
  for rec in
    select
      t.id,
      t.amount,
      t.due_date,
      t.organization_id,
      coalesce(c.manager_id, t.created_by) as notify_user_id,
      c.contract_number
    from public.accounting_transactions t
    left join public.contracts c on c.id = t.contract_id
    where t.type = 'income'
      and t.status = 'planned'
      and t.due_date is not null
      and t.due_date < current_date
      and coalesce(c.manager_id, t.created_by) is not null
  loop
    if not exists (
      select 1 from public.notifications n
      where n.type = 'overdue_payment'
        and n.entity_type = 'accounting_transaction'
        and n.entity_id = rec.id
        and n.is_read = false
    ) then
      insert into public.notifications (user_id, type, title, body, entity_type, entity_id, organization_id)
      values (
        rec.notify_user_id,
        'overdue_payment',
        'Платёж просрочен',
        'Платёж на ' || to_char(rec.amount, 'FM999G999G999') || ' ₽'
          || coalesce(' по договору ' || rec.contract_number, '')
          || ' просрочен (ожидался ' || rec.due_date::date || ')',
        'accounting_transaction',
        rec.id,
        rec.organization_id
      );
    end if;
  end loop;
end;
$function$;

create or replace function public.check_expiring_contracts()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  rec record;
begin
  for rec in
    select c.id, c.contract_number, c.end_date, c.manager_id, c.organization_id
    from public.contracts c
    where c.status = 'signed'
      and c.end_date between now() and now() + interval '14 days'
      and c.manager_id is not null
  loop
    if not exists (
      select 1 from public.notifications n
      where n.type = 'contract_expiry'
        and n.entity_type = 'contract'
        and n.entity_id = rec.id
        and n.is_read = false
    ) then
      insert into public.notifications (user_id, type, title, body, entity_type, entity_id, organization_id)
      values (
        rec.manager_id,
        'contract_expiry',
        'Договор истекает',
        'Договор ' || coalesce(rec.contract_number, '#' || rec.id::text) || ' истекает ' || rec.end_date::date,
        'contract',
        rec.id,
        rec.organization_id
      );
    end if;
  end loop;
end;
$function$;

-- ─── Триггер профиля при регистрации ───────────────────────────────────────
-- В baseline оставлен комментарием («создаётся вручную через Dashboard»), на проде
-- он есть. Без него auth-пользователь не получает строку в public.users и не
-- может войти в CRM. apply_migration на проде может не иметь прав на схему auth —
-- поэтому ошибка прав глотается, локально CLI работает суперпользователем.
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'on_auth_user_created' and tgrelid = 'auth.users'::regclass) then
    create trigger on_auth_user_created after insert on auth.users
      for each row execute function public.handle_new_user();
  end if;
exception when insufficient_privilege then
  raise notice 'on_auth_user_created: нет прав на auth.users, триггер нужно создать вручную';
end $$;

-- ─── Что НЕ воспроизводится намеренно ──────────────────────────────────────
-- cron.job «check-overdue-daily-telegram» (06:00, net.http_post на Edge Function
-- check-overdue боевого проекта). В локальной/dev-базе такой job стучался бы
-- в прод — не создаём. На проде он есть, см. docs/INTEGRATIONS.md.
-- Расширения hypopg / index_advisor — инструменты Supabase Dashboard, к схеме
-- приложения не относятся.
-- Индексы payments_contract_id_idx / payments_due_date_idx / payments_status_idx —
-- точные дубли idx_payments_* на замороженной таблице payments. Не воспроизводим,
-- кандидаты на удаление на проде (db-junk).
