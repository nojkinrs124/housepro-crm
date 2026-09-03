-- Акт приёма объекта в управление.
--
-- Без него нельзя ни предъявить претензию по имуществу, ни посчитать расход по
-- счётчикам с начала обслуживания: не от чего отсчитывать. Поэтому приёмка не
-- считается завершённой, пока нет начальных показаний и описи (FR-020) —
-- проверку делает Server Action, потому что он умеет объяснить, чего не хватает.
create table if not exists public.property_handovers (
  "id" uuid primary key default gen_random_uuid(),
  "organization_id" uuid not null references public.organizations(id) on delete cascade,
  "engagement_id" uuid not null references public.management_engagements(id) on delete cascade,
  -- [{title, condition, note}] — опись имущества
  "inventory" jsonb not null default '[]'::jsonb,
  "condition_note" text,
  "keys_count" integer,
  -- [{title, note}] — переданные документы
  "documents" jsonb not null default '[]'::jsonb,
  "photo_urls" text[],
  "completed_at" timestamptz,
  "created_by" uuid references public.users(id) on delete set null,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  constraint property_handovers_keys_check check (keys_count is null or keys_count >= 0)
);

-- Один акт на обслуживание: приёмка происходит один раз, при входе объекта.
create unique index if not exists idx_property_handovers_engagement
  on public.property_handovers (engagement_id);

alter table public.property_handovers enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies
    where policyname = 'org members manage handovers' and tablename = 'property_handovers') then
    create policy "org members manage handovers" on public.property_handovers
      for all to authenticated
      using (organization_id = public.get_user_org_id())
      with check (organization_id = public.get_user_org_id());
  end if;
end $$;

-- Источник показания: менеджер снял сам или арендатор внёс из кабинета.
-- Нужно, чтобы отличать данные, за которые отвечает агентство, от данных,
-- которые прислал жилец (FR-021, FR-042).
alter table public.meter_readings add column if not exists "source" text not null default 'manager';

alter table public.meter_readings drop constraint if exists meter_readings_source_check;
alter table public.meter_readings add constraint meter_readings_source_check
  check (source = any (array['manager'::text, 'tenant'::text]));

-- Показания по счётчику за период и определение предыдущего значения —
-- основной запрос модуля счётчиков.
create index if not exists idx_meter_readings_meter_date
  on public.meter_readings (meter_id, reading_date desc);

-- Счётчики объекта в управлении запрашиваются на каждой карточке.
create index if not exists idx_utility_meters_property
  on public.utility_meters (property_id) where is_active;

-- Акт приёма для обслуживаний, заведённых миграцией.
--
-- Пустой акт создаётся вместе с обслуживанием — но только когда объект
-- принимают через интерфейс. Перенесённые объекты приехали без него, и
-- страница акта отдавала 404: заполнять было нечего. Нашлось смоук-тестом,
-- который начал заходить на страницы с реальными идентификаторами.
insert into public.property_handovers (organization_id, engagement_id)
select me.organization_id, me.id
from public.management_engagements me
where not exists (
  select 1 from public.property_handovers h where h.engagement_id = me.id
);
