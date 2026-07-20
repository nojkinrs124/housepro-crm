-- ═══════════════════════════════════════════════════════════════════════════
-- BASELINE SNAPSHOT — состояние схемы Supabase на 2026-07-20
-- ═══════════════════════════════════════════════════════════════════════════
--
-- КОНТЕКСТ: до этого момента 53 из 55 миграций применялись через apply_migration
-- напрямую к remote-БД (список версий — в Supabase:list_migrations), но
-- соответствующие .sql-файлы никогда не коммитились в git. Восстановить
-- дословный текст исторических миграций невозможно (Supabase не хранит query),
-- поэтому этот файл — реконструкция ТЕКУЩЕГО фактического состояния схемы через
-- интроспекцию information_schema/pg_catalog, а не точная копия истории.
--
-- ЭТОТ ФАЙЛ НЕ ПРИМЕНЯЛСЯ К БД — схема уже существует. Все операторы обёрнуты
-- в IF NOT EXISTS/idempotent-конструкции ИСКЛЮЧИТЕЛЬНО для того, чтобы файл
-- можно было безопасно прогнать на чистой БД (напр. для локального dev-инстанса
-- или восстановления после катастрофы), не трогая существующую.
--
-- С ЭТОГО МОМЕНТА: каждое изменение схемы — через apply_migration +
-- обязательный коммит нового файла миграции сразу же (см. docs/WORKFLOW.md).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Расширения ──────────────────────────────────────────────────────────────
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;
create extension if not exists pg_cron;

-- ─── Таблицы ─────────────────────────────────────────────────────────────
create table if not exists public."organizations" (
  "id" uuid not null default gen_random_uuid(),
  "name" text not null,
  "slug" text not null,
  "plan" text not null default 'free'::text check (plan = ANY (ARRAY['free'::text, 'pro'::text, 'enterprise'::text])),
  "stripe_customer_id" text,
  "stripe_subscription_id" text,
  "subscription_status" text default 'inactive'::text,
  "trial_ends_at" timestamptz,
  "is_active" boolean not null default true,
  "created_at" timestamptz default now(),
  "updated_at" timestamptz default now(),
  "onboarding_completed" boolean not null default false
);
create table if not exists public."users" (
  "id" uuid not null,
  "email" text not null,
  "full_name" text not null default ''::text,
  "role" text not null default 'agent'::text,
  "phone" text,
  "avatar_url" text,
  "is_active" boolean default true,
  "created_at" timestamptz default now(),
  "settings" jsonb default '{}'::jsonb,
  "last_sign_in_at" timestamptz,
  "organization_id" uuid
);
create table if not exists public."organization_members" (
  "organization_id" uuid not null,
  "user_id" uuid not null,
  "role" text not null default 'agent'::text check (role = ANY (ARRAY['admin'::text, 'manager'::text, 'agent'::text, 'accountant'::text])),
  "is_active" boolean not null default true,
  "created_at" timestamptz default now()
);
-- LEGACY — не использовать для новых фич, см. CLAUDE.md
create table if not exists public."owners" (
  "id" uuid not null default gen_random_uuid(),
  "full_name" text not null,
  "phone" text,
  "passport" text,
  "comment" text,
  "created_at" timestamptz default now()
);
-- LEGACY — не использовать для новых фич, см. CLAUDE.md
create table if not exists public."clients" (
  "id" uuid not null default gen_random_uuid(),
  "full_name" text not null,
  "phone" text,
  "telegram" text,
  "whatsapp" text,
  "passport" text,
  "birth_date" date,
  "comment" text,
  "source" text,
  "status" text not null default 'new'::text check (status = ANY (ARRAY['new'::text, 'in_progress'::text, 'active'::text, 'closed'::text, 'vip'::text, 'blacklist'::text])),
  "manager_id" uuid,
  "created_at" timestamptz default now()
);
create table if not exists public."contacts" (
  "id" uuid not null default gen_random_uuid(),
  "full_name" text not null,
  "phone" text,
  "telegram" text,
  "whatsapp" text,
  "email" text,
  "passport_series" text,
  "passport_number" text,
  "passport_issued_date" date,
  "passport_issued_by" text,
  "passport_department_code" text,
  "passport" text,
  "birth_date" date,
  "role" text not null default 'client'::text check (role = ANY (ARRAY['client'::text, 'owner'::text, 'both'::text])),
  "country" text,
  "region" text,
  "city" text,
  "street" text,
  "house_number" text,
  "building" text,
  "apartment" text,
  "comment" text,
  "source" text,
  "status" text default 'new'::text check (status = ANY (ARRAY['new'::text, 'active'::text, 'vip'::text, 'inactive'::text])),
  "created_at" timestamptz default timezone('utc'::text, now()),
  "updated_at" timestamptz default timezone('utc'::text, now()),
  "client_type" text not null default 'individual'::text check (client_type = ANY (ARRAY['individual'::text, 'legal_entity'::text])),
  "company_name" text,
  "inn" text,
  "kpp" text,
  "ogrn" text,
  "legal_address" text,
  "bank_name" text,
  "bank_account" text,
  "corr_account" text,
  "bik" text,
  "organization_id" uuid not null
);
create table if not exists public."contact_representatives" (
  "id" uuid not null default gen_random_uuid(),
  "contact_id" uuid not null,
  "full_name" text not null,
  "position" text,
  "phone" text,
  "email" text,
  "basis_type" text default 'power_of_attorney'::text check (basis_type = ANY (ARRAY['charter'::text, 'power_of_attorney'::text, 'other'::text])),
  "basis_details" text,
  "is_primary" boolean default false,
  "created_at" timestamptz default now()
);
create table if not exists public."properties" (
  "id" uuid not null default gen_random_uuid(),
  "title" text not null,
  "property_type" text not null check (property_type = ANY (ARRAY['apartment'::text, 'house'::text, 'commercial'::text, 'office'::text, 'warehouse'::text, 'land'::text])),
  "deal_type" text not null check (deal_type = ANY (ARRAY['rent'::text, 'sale'::text, 'management'::text, 'subrent'::text])),
  "address" text not null,
  "district" text,
  "price" numeric,
  "deposit" numeric,
  "area" numeric,
  "rooms" integer,
  "floor" integer,
  "description" text,
  "owner_id" uuid,
  "manager_id" uuid,
  "status" text not null default 'available'::text check (status = ANY (ARRAY['available'::text, 'reserved'::text, 'rented'::text, 'sold'::text, 'inactive'::text])),
  "created_at" timestamptz default now(),
  "living_area" numeric,
  "kitchen_area" numeric,
  "total_floors" integer,
  "ceiling_height" numeric,
  "house_type" text,
  "wall_material" text,
  "year_built" integer,
  "has_elevator" boolean,
  "has_parking" boolean,
  "has_internet" boolean,
  "has_tv" boolean,
  "heating_type" text,
  "water_supply_type" text,
  "management_fee" numeric,
  "utilities_included" text,
  "photo_urls" text[],
  "video_url" text,
  "updated_at" timestamptz default timezone('utc'::text, now()),
  "organization_id" uuid not null,
  "ownership_basis" text
);
create table if not exists public."contracts" (
  "id" uuid not null default gen_random_uuid(),
  "contract_number" text,
  "contract_type" text not null check (contract_type = ANY (ARRAY['rent_apartment'::text, 'rent_commercial'::text, 'sale'::text, 'agency_owner'::text, 'agency_client'::text, 'agency_legal_entity'::text, 'property_management'::text, 'sublease'::text])),
  "client_id" uuid,
  "property_id" uuid,
  "manager_id" uuid,
  "start_date" date,
  "end_date" date,
  "amount" numeric,
  "deposit" numeric,
  "notes" text,
  "status" text not null default 'draft'::text check (status = ANY (ARRAY['draft'::text, 'generated'::text, 'signed'::text, 'completed'::text, 'cancelled'::text])),
  "generated_docx_url" text,
  "generated_pdf_url" text,
  "created_at" timestamptz default now(),
  "owner_id" uuid,
  "client_contact_id" uuid,
  "owner_contact_id" uuid,
  "client_representative_id" uuid,
  "owner_representative_id" uuid,
  "base_contract_id" uuid,
  "company_profile_id" uuid,
  "organization_id" uuid not null,
  "contract_type_data" jsonb not null default '{}'::jsonb
);
create table if not exists public."contract_versions" (
  "id" uuid not null default gen_random_uuid(),
  "contract_id" uuid,
  "version" integer not null default 1,
  "docx_url" text,
  "pdf_url" text,
  "created_by" uuid,
  "created_at" timestamptz default now(),
  "version_data" jsonb,
  "note" text
);
create table if not exists public."files" (
  "id" uuid not null default gen_random_uuid(),
  "file_name" text,
  "file_url" text,
  "file_type" text,
  "contract_id" uuid,
  "client_id" uuid,
  "property_id" uuid,
  "uploaded_by" uuid,
  "created_at" timestamptz default now(),
  "organization_id" uuid
);
create table if not exists public."tasks" (
  "id" uuid not null default gen_random_uuid(),
  "title" text not null,
  "description" text,
  "assigned_to" uuid,
  "created_by" uuid,
  "status" text not null default 'todo'::text check (status = ANY (ARRAY['todo'::text, 'in_progress'::text, 'done'::text, 'cancelled'::text])),
  "priority" text not null default 'medium'::text check (priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])),
  "deadline" timestamptz,
  "created_at" timestamptz default now(),
  "lead_id" uuid,
  "client_id" uuid,
  "owner_id" uuid,
  "deal_id" uuid,
  "property_id" uuid,
  "contract_id" uuid,
  "payment_id" uuid,
  "due_date" timestamptz,
  "organization_id" uuid not null
);
create table if not exists public."payments" (
  "id" uuid not null default gen_random_uuid(),
  "contract_id" uuid,
  "amount" numeric not null,
  "payment_type" text default 'rent'::text,
  "payment_status" text default 'pending'::text check (payment_status = ANY (ARRAY['pending'::text, 'paid'::text, 'partial'::text, 'overdue'::text, 'cancelled'::text])),
  "payment_date" timestamptz,
  "notes" text,
  "created_at" timestamptz default now(),
  "due_date" date,
  "created_by" uuid,
  "organization_id" uuid
);
-- Старый лог; для новых фич использовать audit_logs
create table if not exists public."logs" (
  "id" uuid not null default gen_random_uuid(),
  "user_id" uuid,
  "action" text not null,
  "entity_type" text,
  "entity_id" uuid,
  "old_data" jsonb,
  "new_data" jsonb,
  "created_at" timestamptz default now(),
  "organization_id" uuid
);
create table if not exists public."document_templates" (
  "id" uuid not null default gen_random_uuid(),
  "name" text not null,
  "template_type" text not null,
  "file_url" text not null,
  "created_by" uuid,
  "created_at" timestamptz default now(),
  "storage_path" text,
  "organization_id" uuid
);
create table if not exists public."leads" (
  "id" uuid not null default gen_random_uuid(),
  "full_name" text,
  "phone" text,
  "telegram" text,
  "whatsapp" text,
  "source" text,
  "status" text not null default 'new'::text check (status = ANY (ARRAY['new'::text, 'contacted'::text, 'meeting'::text, 'searching'::text, 'showing'::text, 'converted'::text, 'closed'::text])),
  "assigned_to" uuid,
  "property_id" uuid,
  "comment" text,
  "created_at" timestamptz default now(),
  "email" text,
  "budget_min" numeric,
  "budget_max" numeric,
  "deal_type" text check (deal_type = ANY (ARRAY['rent'::text, 'sale'::text, 'management'::text, 'subrent'::text, 'commercial'::text])),
  "property_type" text check (property_type = ANY (ARRAY['apartment'::text, 'house'::text, 'commercial'::text, 'office'::text, 'warehouse'::text, 'land'::text])),
  "rooms" integer,
  "area_min" numeric,
  "area_max" numeric,
  "district" text,
  "next_contact_at" timestamptz,
  "updated_at" timestamptz default now(),
  "organization_id" uuid not null
);
create table if not exists public."lead_activities" (
  "id" uuid not null default gen_random_uuid(),
  "lead_id" uuid not null,
  "user_id" uuid,
  "type" text not null check (type = ANY (ARRAY['call'::text, 'message'::text, 'meeting'::text, 'showing'::text, 'note'::text, 'email'::text])),
  "content" text,
  "result" text,
  "scheduled_at" timestamptz,
  "created_at" timestamptz default now(),
  "organization_id" uuid
);
create table if not exists public."deals" (
  "id" uuid not null default gen_random_uuid(),
  "client_id" uuid,
  "property_id" uuid,
  "manager_id" uuid,
  "lead_id" uuid,
  "status" text not null default 'new'::text check (status = ANY (ARRAY['new'::text, 'showing'::text, 'negotiation'::text, 'contract'::text, 'payment'::text, 'completed'::text, 'cancelled'::text])),
  "deal_type" text not null default 'rent'::text check (deal_type = ANY (ARRAY['rent'::text, 'sale'::text, 'management'::text, 'commercial'::text, 'subrent'::text])),
  "commission" numeric,
  "amount" numeric,
  "notes" text,
  "created_at" timestamptz default now(),
  "owner_id" uuid,
  "owner_contact_id" uuid,
  "client_contact_id" uuid,
  "client_representative_id" uuid,
  "owner_representative_id" uuid,
  "organization_id" uuid not null
);
create table if not exists public."deal_comments" (
  "id" uuid not null default gen_random_uuid(),
  "deal_id" uuid not null,
  "author_id" uuid not null,
  "body" text not null check (char_length(body) > 0 AND char_length(body) <= 2000),
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  "organization_id" uuid
);
-- Профили компании/лиц, от имени которых готовятся документы (физ. лицо / ИП / ООО). Может быть несколько, один отмечен is_default.
create table if not exists public."company_settings" (
  "id" uuid not null default gen_random_uuid(),
  "name" text,
  "inn" text,
  "ogrn" text,
  "address" text,
  "phone" text,
  "email" text,
  "logo_url" text,
  "created_at" timestamptz default timezone('utc'::text, now()),
  "updated_at" timestamptz default timezone('utc'::text, now()),
  "kpp" text,
  "bik" text,
  "bank_name" text,
  "bank_account" text,
  "corr_account" text,
  "website" text,
  "description" text,
  "legal_form" text not null default 'ip'::text check (legal_form = ANY (ARRAY['individual'::text, 'ip'::text, 'ooo'::text])),
  "is_default" boolean not null default false,
  "signatory_name" text,
  "signatory_position" text,
  "signatory_basis" text,
  "passport_series" text,
  "passport_number" text,
  "passport_issued_date" date,
  "passport_issued_by" text,
  "passport_department_code" text,
  "organization_id" uuid
);
create table if not exists public."notifications" (
  "id" uuid not null default gen_random_uuid(),
  "user_id" uuid,
  "type" text not null check (type = ANY (ARRAY['overdue_payment'::text, 'overdue_task'::text, 'new_lead'::text, 'deal_status'::text, 'contract_expiry'::text])),
  "title" text not null,
  "body" text,
  "entity_type" text,
  "entity_id" uuid,
  "is_read" boolean default false,
  "created_at" timestamptz default now(),
  "organization_id" uuid
);
create table if not exists public."accounting_categories" (
  "id" uuid not null default gen_random_uuid(),
  "name" text not null,
  "type" text not null check (type = ANY (ARRAY['income'::text, 'expense'::text])),
  "color" text not null default '#64748B'::text,
  "icon" text not null default 'tag'::text,
  "is_system" boolean not null default false,
  "sort_order" integer not null default 0,
  "created_at" timestamptz default now(),
  "created_by" uuid,
  "organization_id" uuid not null
);
create table if not exists public."accounting_recurring_rules" (
  "id" uuid not null default gen_random_uuid(),
  "name" text not null,
  "type" text not null check (type = ANY (ARRAY['income'::text, 'expense'::text])),
  "amount" numeric not null check (amount > 0::numeric),
  "category_id" uuid,
  "frequency" text not null check (frequency = ANY (ARRAY['daily'::text, 'weekly'::text, 'monthly'::text, 'yearly'::text])),
  "day_of_month" integer check (day_of_month >= 1 AND day_of_month <= 31),
  "start_date" date not null,
  "end_date" date,
  "employee_id" uuid,
  "notes" text,
  "is_active" boolean not null default true,
  "last_generated_date" date,
  "created_at" timestamptz default now(),
  "created_by" uuid,
  "organization_id" uuid
);
create table if not exists public."accounting_transactions" (
  "id" uuid not null default gen_random_uuid(),
  "type" text not null check (type = ANY (ARRAY['income'::text, 'expense'::text])),
  "amount" numeric not null check (amount > 0::numeric),
  "category_id" uuid,
  "date" date not null,
  "description" text,
  "status" text not null default 'completed'::text check (status = ANY (ARRAY['planned'::text, 'completed'::text, 'cancelled'::text])),
  "payment_method" text check (payment_method = ANY (ARRAY['cash'::text, 'bank'::text, 'card'::text, 'other'::text])),
  "due_date" date,
  "contract_id" uuid,
  "deal_id" uuid,
  "contact_id" uuid,
  "employee_id" uuid,
  "recurring_rule_id" uuid,
  "legacy_payment_id" uuid,
  "created_at" timestamptz default now(),
  "created_by" uuid,
  "organization_id" uuid not null
);
create table if not exists public."audit_logs" (
  "id" uuid not null default gen_random_uuid(),
  "organization_id" uuid not null,
  "user_id" uuid,
  "action" text not null,
  "entity_type" text not null,
  "entity_id" uuid,
  "entity_label" text,
  "changes" jsonb,
  "created_at" timestamptz default now()
);
create table if not exists public."showings" (
  "id" uuid not null default gen_random_uuid(),
  "organization_id" uuid not null,
  "property_id" uuid,
  "lead_id" uuid,
  "deal_id" uuid,
  "contact_id" uuid,
  "agent_id" uuid,
  "scheduled_at" timestamptz not null,
  "duration_min" integer default 30,
  "status" text not null default 'planned'::text check (status = ANY (ARRAY['planned'::text, 'completed'::text, 'cancelled'::text, 'no_show'::text])),
  "result" text,
  "feedback" text,
  "next_step" text,
  "created_by" uuid,
  "created_at" timestamptz default now(),
  "updated_at" timestamptz default now()
);
create table if not exists public."property_collections" (
  "id" uuid not null default gen_random_uuid(),
  "organization_id" uuid not null,
  "lead_id" uuid,
  "title" text not null,
  "share_token" text default encode(extensions.gen_random_bytes(12), 'hex'::text),
  "is_public" boolean default false,
  "created_by" uuid,
  "created_at" timestamptz default now()
);
create table if not exists public."collection_items" (
  "collection_id" uuid not null,
  "property_id" uuid not null,
  "sort_order" integer default 0,
  "agent_note" text,
  "added_at" timestamptz default now()
);
create table if not exists public."api_keys" (
  "id" uuid not null default gen_random_uuid(),
  "organization_id" uuid not null,
  "name" text not null,
  "key_hash" text not null,
  "key_prefix" text not null,
  "scopes" text[] not null default '{read}'::text[],
  "last_used_at" timestamptz,
  "expires_at" timestamptz,
  "is_active" boolean default true,
  "created_by" uuid,
  "created_at" timestamptz default now()
);
create table if not exists public."webhook_endpoints" (
  "id" uuid not null default gen_random_uuid(),
  "organization_id" uuid not null,
  "url" text not null,
  "secret" text not null,
  "events" text[] not null default '{}'::text[],
  "is_active" boolean default true,
  "created_by" uuid,
  "created_at" timestamptz default now()
);
create table if not exists public."bot_pending_actions" (
  "id" uuid not null default gen_random_uuid(),
  "organization_id" uuid not null,
  "telegram_chat_id" text not null,
  "telegram_user_id" text,
  "action_type" text not null,
  "payload" jsonb not null,
  "summary_text" text not null,
  "status" text not null default 'pending'::text,
  "created_at" timestamptz not null default now(),
  "expires_at" timestamptz not null default (now() + '00:15:00'::interval),
  "batch_id" uuid not null default gen_random_uuid()
);
create table if not exists public."bot_conversations" (
  "telegram_chat_id" text not null,
  "organization_id" uuid not null,
  "messages" jsonb not null default '[]'::jsonb,
  "updated_at" timestamptz not null default now()
);
create table if not exists public."bot_allowed_users" (
  "telegram_user_id" text not null,
  "organization_id" uuid not null,
  "label" text,
  "created_at" timestamptz not null default now()
);
-- ─── Sequences ───────────────────────────────────────────────────────────
create sequence if not exists public.contract_number_seq;

-- ─── Primary keys ────────────────────────────────────────────────────────
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'organizations_pkey') then
    alter table public."organizations" add constraint "organizations_pkey" primary key ("id");
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'users_pkey') then
    alter table public."users" add constraint "users_pkey" primary key ("id");
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'organization_members_pkey') then
    alter table public."organization_members" add constraint "organization_members_pkey" primary key ("organization_id", "user_id");
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'owners_pkey') then
    alter table public."owners" add constraint "owners_pkey" primary key ("id");
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'clients_pkey') then
    alter table public."clients" add constraint "clients_pkey" primary key ("id");
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'contacts_pkey') then
    alter table public."contacts" add constraint "contacts_pkey" primary key ("id");
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'contact_representatives_pkey') then
    alter table public."contact_representatives" add constraint "contact_representatives_pkey" primary key ("id");
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'properties_pkey') then
    alter table public."properties" add constraint "properties_pkey" primary key ("id");
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'contracts_pkey') then
    alter table public."contracts" add constraint "contracts_pkey" primary key ("id");
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'contract_versions_pkey') then
    alter table public."contract_versions" add constraint "contract_versions_pkey" primary key ("id");
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'files_pkey') then
    alter table public."files" add constraint "files_pkey" primary key ("id");
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'tasks_pkey') then
    alter table public."tasks" add constraint "tasks_pkey" primary key ("id");
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'payments_pkey') then
    alter table public."payments" add constraint "payments_pkey" primary key ("id");
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'logs_pkey') then
    alter table public."logs" add constraint "logs_pkey" primary key ("id");
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'document_templates_pkey') then
    alter table public."document_templates" add constraint "document_templates_pkey" primary key ("id");
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'leads_pkey') then
    alter table public."leads" add constraint "leads_pkey" primary key ("id");
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'lead_activities_pkey') then
    alter table public."lead_activities" add constraint "lead_activities_pkey" primary key ("id");
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'deals_pkey') then
    alter table public."deals" add constraint "deals_pkey" primary key ("id");
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'deal_comments_pkey') then
    alter table public."deal_comments" add constraint "deal_comments_pkey" primary key ("id");
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'company_settings_pkey') then
    alter table public."company_settings" add constraint "company_settings_pkey" primary key ("id");
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'notifications_pkey') then
    alter table public."notifications" add constraint "notifications_pkey" primary key ("id");
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'accounting_categories_pkey') then
    alter table public."accounting_categories" add constraint "accounting_categories_pkey" primary key ("id");
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'accounting_recurring_rules_pkey') then
    alter table public."accounting_recurring_rules" add constraint "accounting_recurring_rules_pkey" primary key ("id");
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'accounting_transactions_pkey') then
    alter table public."accounting_transactions" add constraint "accounting_transactions_pkey" primary key ("id");
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'audit_logs_pkey') then
    alter table public."audit_logs" add constraint "audit_logs_pkey" primary key ("id");
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'showings_pkey') then
    alter table public."showings" add constraint "showings_pkey" primary key ("id");
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'property_collections_pkey') then
    alter table public."property_collections" add constraint "property_collections_pkey" primary key ("id");
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'collection_items_pkey') then
    alter table public."collection_items" add constraint "collection_items_pkey" primary key ("collection_id", "property_id");
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'api_keys_pkey') then
    alter table public."api_keys" add constraint "api_keys_pkey" primary key ("id");
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'webhook_endpoints_pkey') then
    alter table public."webhook_endpoints" add constraint "webhook_endpoints_pkey" primary key ("id");
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'bot_pending_actions_pkey') then
    alter table public."bot_pending_actions" add constraint "bot_pending_actions_pkey" primary key ("id");
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'bot_conversations_pkey') then
    alter table public."bot_conversations" add constraint "bot_conversations_pkey" primary key ("telegram_chat_id");
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'bot_allowed_users_pkey') then
    alter table public."bot_allowed_users" add constraint "bot_allowed_users_pkey" primary key ("telegram_user_id");
  end if;
end $$;

-- ─── Unique constraints ──────────────────────────────────────────────────
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'organizations_slug_key') then
    alter table public."organizations" add constraint "organizations_slug_key" unique ("slug");
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'users_email_key') then
    alter table public."users" add constraint "users_email_key" unique ("email");
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'contracts_contract_number_key') then
    alter table public."contracts" add constraint "contracts_contract_number_key" unique ("contract_number");
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'property_collections_share_token_key') then
    alter table public."property_collections" add constraint "property_collections_share_token_key" unique ("share_token");
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'api_keys_key_hash_key') then
    alter table public."api_keys" add constraint "api_keys_key_hash_key" unique ("key_hash");
  end if;
end $$;

-- ─── Foreign keys ────────────────────────────────────────────────────────
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'users_id_fkey') then
    alter table public."users" add constraint "users_id_fkey" foreign key ("id") references auth.users(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'users_organization_id_fkey') then
    alter table public."users" add constraint "users_organization_id_fkey" foreign key ("organization_id") references public.organizations(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'organization_members_organization_id_fkey') then
    alter table public."organization_members" add constraint "organization_members_organization_id_fkey" foreign key ("organization_id") references public.organizations(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'organization_members_user_id_fkey') then
    alter table public."organization_members" add constraint "organization_members_user_id_fkey" foreign key ("user_id") references auth.users(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'clients_manager_id_fkey') then
    alter table public."clients" add constraint "clients_manager_id_fkey" foreign key ("manager_id") references public.users(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'contacts_organization_id_fkey') then
    alter table public."contacts" add constraint "contacts_organization_id_fkey" foreign key ("organization_id") references public.organizations(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'contact_representatives_contact_id_fkey') then
    alter table public."contact_representatives" add constraint "contact_representatives_contact_id_fkey" foreign key ("contact_id") references public.contacts(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'properties_owner_id_fkey') then
    alter table public."properties" add constraint "properties_owner_id_fkey" foreign key ("owner_id") references public.owners(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'properties_manager_id_fkey') then
    alter table public."properties" add constraint "properties_manager_id_fkey" foreign key ("manager_id") references public.users(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'properties_organization_id_fkey') then
    alter table public."properties" add constraint "properties_organization_id_fkey" foreign key ("organization_id") references public.organizations(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'contracts_owner_contact_id_fkey') then
    alter table public."contracts" add constraint "contracts_owner_contact_id_fkey" foreign key ("owner_contact_id") references public.contacts(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'contracts_organization_id_fkey') then
    alter table public."contracts" add constraint "contracts_organization_id_fkey" foreign key ("organization_id") references public.organizations(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'contracts_company_profile_id_fkey') then
    alter table public."contracts" add constraint "contracts_company_profile_id_fkey" foreign key ("company_profile_id") references public.company_settings(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'contracts_base_contract_id_fkey') then
    alter table public."contracts" add constraint "contracts_base_contract_id_fkey" foreign key ("base_contract_id") references public.contracts(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'contracts_owner_representative_id_fkey') then
    alter table public."contracts" add constraint "contracts_owner_representative_id_fkey" foreign key ("owner_representative_id") references public.contact_representatives(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'contracts_client_representative_id_fkey') then
    alter table public."contracts" add constraint "contracts_client_representative_id_fkey" foreign key ("client_representative_id") references public.contact_representatives(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'contracts_client_contact_id_fkey') then
    alter table public."contracts" add constraint "contracts_client_contact_id_fkey" foreign key ("client_contact_id") references public.contacts(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'contracts_owner_id_fkey') then
    alter table public."contracts" add constraint "contracts_owner_id_fkey" foreign key ("owner_id") references public.owners(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'contracts_manager_id_fkey') then
    alter table public."contracts" add constraint "contracts_manager_id_fkey" foreign key ("manager_id") references public.users(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'contracts_property_id_fkey') then
    alter table public."contracts" add constraint "contracts_property_id_fkey" foreign key ("property_id") references public.properties(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'contracts_client_id_fkey') then
    alter table public."contracts" add constraint "contracts_client_id_fkey" foreign key ("client_id") references public.clients(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'contract_versions_contract_id_fkey') then
    alter table public."contract_versions" add constraint "contract_versions_contract_id_fkey" foreign key ("contract_id") references public.contracts(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'contract_versions_created_by_fkey') then
    alter table public."contract_versions" add constraint "contract_versions_created_by_fkey" foreign key ("created_by") references public.users(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'files_organization_id_fkey') then
    alter table public."files" add constraint "files_organization_id_fkey" foreign key ("organization_id") references public.organizations(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'files_uploaded_by_fkey') then
    alter table public."files" add constraint "files_uploaded_by_fkey" foreign key ("uploaded_by") references public.users(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'files_property_id_fkey') then
    alter table public."files" add constraint "files_property_id_fkey" foreign key ("property_id") references public.properties(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'files_client_id_fkey') then
    alter table public."files" add constraint "files_client_id_fkey" foreign key ("client_id") references public.clients(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'files_contract_id_fkey') then
    alter table public."files" add constraint "files_contract_id_fkey" foreign key ("contract_id") references public.contracts(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'tasks_owner_id_fkey') then
    alter table public."tasks" add constraint "tasks_owner_id_fkey" foreign key ("owner_id") references public.owners(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'tasks_assigned_to_fkey') then
    alter table public."tasks" add constraint "tasks_assigned_to_fkey" foreign key ("assigned_to") references public.users(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'tasks_organization_id_fkey') then
    alter table public."tasks" add constraint "tasks_organization_id_fkey" foreign key ("organization_id") references public.organizations(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'tasks_lead_id_fkey') then
    alter table public."tasks" add constraint "tasks_lead_id_fkey" foreign key ("lead_id") references public.leads(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'tasks_created_by_fkey') then
    alter table public."tasks" add constraint "tasks_created_by_fkey" foreign key ("created_by") references public.users(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'tasks_client_id_fkey') then
    alter table public."tasks" add constraint "tasks_client_id_fkey" foreign key ("client_id") references public.clients(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'tasks_payment_id_fkey') then
    alter table public."tasks" add constraint "tasks_payment_id_fkey" foreign key ("payment_id") references public.payments(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'tasks_contract_id_fkey') then
    alter table public."tasks" add constraint "tasks_contract_id_fkey" foreign key ("contract_id") references public.contracts(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'tasks_property_id_fkey') then
    alter table public."tasks" add constraint "tasks_property_id_fkey" foreign key ("property_id") references public.properties(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'tasks_deal_id_fkey') then
    alter table public."tasks" add constraint "tasks_deal_id_fkey" foreign key ("deal_id") references public.deals(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'payments_organization_id_fkey') then
    alter table public."payments" add constraint "payments_organization_id_fkey" foreign key ("organization_id") references public.organizations(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'payments_contract_id_fkey') then
    alter table public."payments" add constraint "payments_contract_id_fkey" foreign key ("contract_id") references public.contracts(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'payments_created_by_fkey') then
    alter table public."payments" add constraint "payments_created_by_fkey" foreign key ("created_by") references public.users(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'logs_user_id_fkey') then
    alter table public."logs" add constraint "logs_user_id_fkey" foreign key ("user_id") references public.users(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'logs_organization_id_fkey') then
    alter table public."logs" add constraint "logs_organization_id_fkey" foreign key ("organization_id") references public.organizations(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'document_templates_organization_id_fkey') then
    alter table public."document_templates" add constraint "document_templates_organization_id_fkey" foreign key ("organization_id") references public.organizations(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'document_templates_created_by_fkey') then
    alter table public."document_templates" add constraint "document_templates_created_by_fkey" foreign key ("created_by") references public.users(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'leads_assigned_to_fkey') then
    alter table public."leads" add constraint "leads_assigned_to_fkey" foreign key ("assigned_to") references public.users(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'leads_property_id_fkey') then
    alter table public."leads" add constraint "leads_property_id_fkey" foreign key ("property_id") references public.properties(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'leads_organization_id_fkey') then
    alter table public."leads" add constraint "leads_organization_id_fkey" foreign key ("organization_id") references public.organizations(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'lead_activities_user_id_fkey') then
    alter table public."lead_activities" add constraint "lead_activities_user_id_fkey" foreign key ("user_id") references public.users(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'lead_activities_organization_id_fkey') then
    alter table public."lead_activities" add constraint "lead_activities_organization_id_fkey" foreign key ("organization_id") references public.organizations(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'lead_activities_lead_id_fkey') then
    alter table public."lead_activities" add constraint "lead_activities_lead_id_fkey" foreign key ("lead_id") references public.leads(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'deals_owner_id_fkey') then
    alter table public."deals" add constraint "deals_owner_id_fkey" foreign key ("owner_id") references public.owners(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'deals_manager_id_fkey') then
    alter table public."deals" add constraint "deals_manager_id_fkey" foreign key ("manager_id") references public.users(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'deals_property_id_fkey') then
    alter table public."deals" add constraint "deals_property_id_fkey" foreign key ("property_id") references public.properties(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'deals_client_id_fkey') then
    alter table public."deals" add constraint "deals_client_id_fkey" foreign key ("client_id") references public.clients(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'deals_owner_representative_id_fkey') then
    alter table public."deals" add constraint "deals_owner_representative_id_fkey" foreign key ("owner_representative_id") references public.contact_representatives(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'deals_lead_id_fkey') then
    alter table public."deals" add constraint "deals_lead_id_fkey" foreign key ("lead_id") references public.leads(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'deals_organization_id_fkey') then
    alter table public."deals" add constraint "deals_organization_id_fkey" foreign key ("organization_id") references public.organizations(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'deals_client_contact_id_fkey') then
    alter table public."deals" add constraint "deals_client_contact_id_fkey" foreign key ("client_contact_id") references public.contacts(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'deals_client_representative_id_fkey') then
    alter table public."deals" add constraint "deals_client_representative_id_fkey" foreign key ("client_representative_id") references public.contact_representatives(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'deals_owner_contact_id_fkey') then
    alter table public."deals" add constraint "deals_owner_contact_id_fkey" foreign key ("owner_contact_id") references public.contacts(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'deal_comments_deal_id_fkey') then
    alter table public."deal_comments" add constraint "deal_comments_deal_id_fkey" foreign key ("deal_id") references public.deals(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'deal_comments_organization_id_fkey') then
    alter table public."deal_comments" add constraint "deal_comments_organization_id_fkey" foreign key ("organization_id") references public.organizations(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'deal_comments_author_id_fkey') then
    alter table public."deal_comments" add constraint "deal_comments_author_id_fkey" foreign key ("author_id") references public.users(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'company_settings_organization_id_fkey') then
    alter table public."company_settings" add constraint "company_settings_organization_id_fkey" foreign key ("organization_id") references public.organizations(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'notifications_user_id_fkey') then
    alter table public."notifications" add constraint "notifications_user_id_fkey" foreign key ("user_id") references public.users(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'notifications_organization_id_fkey') then
    alter table public."notifications" add constraint "notifications_organization_id_fkey" foreign key ("organization_id") references public.organizations(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'accounting_categories_created_by_fkey') then
    alter table public."accounting_categories" add constraint "accounting_categories_created_by_fkey" foreign key ("created_by") references auth.users(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'accounting_categories_organization_id_fkey') then
    alter table public."accounting_categories" add constraint "accounting_categories_organization_id_fkey" foreign key ("organization_id") references public.organizations(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'accounting_recurring_rules_organization_id_fkey') then
    alter table public."accounting_recurring_rules" add constraint "accounting_recurring_rules_organization_id_fkey" foreign key ("organization_id") references public.organizations(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'accounting_recurring_rules_employee_id_fkey') then
    alter table public."accounting_recurring_rules" add constraint "accounting_recurring_rules_employee_id_fkey" foreign key ("employee_id") references public.users(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'accounting_recurring_rules_category_id_fkey') then
    alter table public."accounting_recurring_rules" add constraint "accounting_recurring_rules_category_id_fkey" foreign key ("category_id") references public.accounting_categories(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'accounting_recurring_rules_created_by_fkey') then
    alter table public."accounting_recurring_rules" add constraint "accounting_recurring_rules_created_by_fkey" foreign key ("created_by") references auth.users(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'accounting_transactions_category_id_fkey') then
    alter table public."accounting_transactions" add constraint "accounting_transactions_category_id_fkey" foreign key ("category_id") references public.accounting_categories(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'accounting_transactions_contact_id_fkey') then
    alter table public."accounting_transactions" add constraint "accounting_transactions_contact_id_fkey" foreign key ("contact_id") references public.contacts(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'accounting_transactions_contract_id_fkey') then
    alter table public."accounting_transactions" add constraint "accounting_transactions_contract_id_fkey" foreign key ("contract_id") references public.contracts(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'accounting_transactions_deal_id_fkey') then
    alter table public."accounting_transactions" add constraint "accounting_transactions_deal_id_fkey" foreign key ("deal_id") references public.deals(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'accounting_transactions_employee_id_fkey') then
    alter table public."accounting_transactions" add constraint "accounting_transactions_employee_id_fkey" foreign key ("employee_id") references public.users(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'accounting_transactions_recurring_rule_id_fkey') then
    alter table public."accounting_transactions" add constraint "accounting_transactions_recurring_rule_id_fkey" foreign key ("recurring_rule_id") references public.accounting_recurring_rules(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'accounting_transactions_created_by_fkey') then
    alter table public."accounting_transactions" add constraint "accounting_transactions_created_by_fkey" foreign key ("created_by") references auth.users(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'accounting_transactions_organization_id_fkey') then
    alter table public."accounting_transactions" add constraint "accounting_transactions_organization_id_fkey" foreign key ("organization_id") references public.organizations(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'audit_logs_organization_id_fkey') then
    alter table public."audit_logs" add constraint "audit_logs_organization_id_fkey" foreign key ("organization_id") references public.organizations(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'audit_logs_user_id_fkey') then
    alter table public."audit_logs" add constraint "audit_logs_user_id_fkey" foreign key ("user_id") references auth.users(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'showings_property_id_fkey') then
    alter table public."showings" add constraint "showings_property_id_fkey" foreign key ("property_id") references public.properties(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'showings_lead_id_fkey') then
    alter table public."showings" add constraint "showings_lead_id_fkey" foreign key ("lead_id") references public.leads(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'showings_deal_id_fkey') then
    alter table public."showings" add constraint "showings_deal_id_fkey" foreign key ("deal_id") references public.deals(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'showings_created_by_fkey') then
    alter table public."showings" add constraint "showings_created_by_fkey" foreign key ("created_by") references auth.users(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'showings_agent_id_fkey') then
    alter table public."showings" add constraint "showings_agent_id_fkey" foreign key ("agent_id") references auth.users(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'showings_contact_id_fkey') then
    alter table public."showings" add constraint "showings_contact_id_fkey" foreign key ("contact_id") references public.contacts(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'showings_organization_id_fkey') then
    alter table public."showings" add constraint "showings_organization_id_fkey" foreign key ("organization_id") references public.organizations(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'property_collections_organization_id_fkey') then
    alter table public."property_collections" add constraint "property_collections_organization_id_fkey" foreign key ("organization_id") references public.organizations(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'property_collections_created_by_fkey') then
    alter table public."property_collections" add constraint "property_collections_created_by_fkey" foreign key ("created_by") references auth.users(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'property_collections_lead_id_fkey') then
    alter table public."property_collections" add constraint "property_collections_lead_id_fkey" foreign key ("lead_id") references public.leads(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'collection_items_property_id_fkey') then
    alter table public."collection_items" add constraint "collection_items_property_id_fkey" foreign key ("property_id") references public.properties(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'collection_items_collection_id_fkey') then
    alter table public."collection_items" add constraint "collection_items_collection_id_fkey" foreign key ("collection_id") references public.property_collections(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'api_keys_created_by_fkey') then
    alter table public."api_keys" add constraint "api_keys_created_by_fkey" foreign key ("created_by") references auth.users(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'api_keys_organization_id_fkey') then
    alter table public."api_keys" add constraint "api_keys_organization_id_fkey" foreign key ("organization_id") references public.organizations(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'webhook_endpoints_created_by_fkey') then
    alter table public."webhook_endpoints" add constraint "webhook_endpoints_created_by_fkey" foreign key ("created_by") references auth.users(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'webhook_endpoints_organization_id_fkey') then
    alter table public."webhook_endpoints" add constraint "webhook_endpoints_organization_id_fkey" foreign key ("organization_id") references public.organizations(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'bot_pending_actions_organization_id_fkey') then
    alter table public."bot_pending_actions" add constraint "bot_pending_actions_organization_id_fkey" foreign key ("organization_id") references public.organizations(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'bot_conversations_organization_id_fkey') then
    alter table public."bot_conversations" add constraint "bot_conversations_organization_id_fkey" foreign key ("organization_id") references public.organizations(id);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'bot_allowed_users_organization_id_fkey') then
    alter table public."bot_allowed_users" add constraint "bot_allowed_users_organization_id_fkey" foreign key ("organization_id") references public.organizations(id);
  end if;
end $$;
