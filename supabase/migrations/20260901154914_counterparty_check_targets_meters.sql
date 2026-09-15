-- ═══════════════════════════════════════════════════════════════════════════
-- Проверка контрагента, планы сотрудников, счётчики и индексация аренды
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Снимок проверки контрагента ─────────────────────────────────────────
-- Перед подписанием договора с юрлицом важно знать, что оно действующее.
-- Храним снимок ответа ЕГРЮЛ на момент проверки, а не только флаг: если
-- контрагент позже ликвидируется, должно быть видно, что на дату сделки он
-- был действующим — это и есть смысл «должной осмотрительности».
alter table public.contacts add column if not exists "counterparty_check" jsonb;
alter table public.contacts add column if not exists "counterparty_checked_at" timestamptz;

-- ─── 2. Планы сотрудников ───────────────────────────────────────────────────
-- KPI на карточке сотрудника показывал только факт. Без плана факт не с чем
-- сравнить, и мотивация не считается.
create table if not exists public."employee_targets" (
  "id" uuid not null default gen_random_uuid() primary key,
  "organization_id" uuid not null references public.organizations(id) on delete cascade,
  "user_id" uuid not null,
  -- Первое число месяца, к которому относится план.
  "period_month" date not null,
  "deals_target" integer,
  "revenue_target" numeric,
  "commission_target" numeric,
  "note" text,
  "created_by" uuid,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  unique (organization_id, user_id, period_month)
);

create index if not exists idx_employee_targets_period
  on public.employee_targets(organization_id, period_month desc);

alter table public.employee_targets enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies
    where policyname = 'org members manage employee targets' and tablename = 'employee_targets') then
    create policy "org members manage employee targets" on public.employee_targets
      for all to authenticated
      using (organization_id = public.get_user_org_id())
      with check (organization_id = public.get_user_org_id());
  end if;
end $$;

-- ─── 3. Счётчики и показания ────────────────────────────────────────────────
-- В аренде коммуналка по счётчикам — рутинная ежемесячная работа, которая
-- велась в переписке и таблицах. Показания привязаны к объекту, а не к
-- договору: счётчик переживает смену арендатора.
create table if not exists public."utility_meters" (
  "id" uuid not null default gen_random_uuid() primary key,
  "organization_id" uuid not null references public.organizations(id) on delete cascade,
  "property_id" uuid not null references public.properties(id) on delete cascade,
  "kind" text not null
    check (kind = any (array['electricity'::text, 'cold_water'::text, 'hot_water'::text,
                             'gas'::text, 'heating'::text, 'other'::text])),
  "title" text,
  "serial_number" text,
  "unit" text not null default 'кВт·ч',
  -- Тариф за единицу; пустой означает «считаем только расход, сумму вводим руками».
  "tariff" numeric,
  "is_active" boolean not null default true,
  "created_at" timestamptz not null default now()
);

create index if not exists idx_utility_meters_property
  on public.utility_meters(property_id) where is_active;

create table if not exists public."meter_readings" (
  "id" uuid not null default gen_random_uuid() primary key,
  "organization_id" uuid not null references public.organizations(id) on delete cascade,
  "meter_id" uuid not null references public.utility_meters(id) on delete cascade,
  "reading_date" date not null default current_date,
  "value" numeric not null,
  -- Расход и сумма считаются при вводе относительно предыдущего показания
  -- и сохраняются: тариф со временем меняется, а пересчитывать историю нельзя.
  "consumption" numeric,
  "amount" numeric,
  "note" text,
  "created_by" uuid,
  "created_at" timestamptz not null default now()
);

create index if not exists idx_meter_readings_meter
  on public.meter_readings(meter_id, reading_date desc);

alter table public.utility_meters enable row level security;
alter table public.meter_readings enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies
    where policyname = 'org members manage meters' and tablename = 'utility_meters') then
    create policy "org members manage meters" on public.utility_meters
      for all to authenticated
      using (organization_id = public.get_user_org_id())
      with check (organization_id = public.get_user_org_id());
  end if;

  if not exists (select 1 from pg_policies
    where policyname = 'org members manage readings' and tablename = 'meter_readings') then
    create policy "org members manage readings" on public.meter_readings
      for all to authenticated
      using (organization_id = public.get_user_org_id())
      with check (organization_id = public.get_user_org_id());
  end if;
end $$;

-- ─── 4. Индексация аренды ───────────────────────────────────────────────────
-- Годовое повышение ставки прописано почти в каждом длинном договоре, но
-- в графике платежей его приходилось считать руками.
alter table public.contracts add column if not exists "indexation_percent" numeric;
alter table public.contracts add column if not exists "indexation_period_months" integer default 12;
