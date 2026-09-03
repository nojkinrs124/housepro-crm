-- Тарифы агентства как справочник.
--
-- До сих пор тарифы существовали только на сайте (/uslugi), а в CRM их не было:
-- размер комиссии нигде не считался, а разница между «Управлением» и
-- «Управлением Премиум» была только на словах.
--
-- Ставка тарифа копируется в договор при подписании (contracts.plan_rate) и
-- дальше не зависит от правок справочника — иначе изменение цены задним числом
-- переписало бы расчёты по уже заключённым договорам.
create table if not exists public.service_plans (
  "id" uuid primary key default gen_random_uuid(),
  "organization_id" uuid not null references public.organizations(id) on delete cascade,
  "code" text not null,
  "title" text not null,
  -- deal_percent    — разовый процент от суммы сделки
  -- monthly_percent — ежемесячный процент от платежа арендатора
  -- owner_fixed     — фиксированная выплата собственнику, разница остаётся агентству
  -- flat_fee        — фиксированная сумма вознаграждения
  -- negotiated      — договорная, фиксируется в договоре
  "charge_type" text not null,
  "rate" numeric,
  "repair_limit" numeric,
  "obligations" jsonb not null default '[]'::jsonb,
  "directions" text[] not null default '{}'::text[],
  "is_active" boolean not null default true,
  "sort_order" integer not null default 0,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  constraint service_plans_charge_type_check check (charge_type = any (array[
    'deal_percent'::text, 'monthly_percent'::text, 'owner_fixed'::text,
    'flat_fee'::text, 'negotiated'::text
  ])),
  -- Процентная ставка вне 0..100 — это опечатка, а не тариф.
  constraint service_plans_rate_check check (
    rate is null
    or (charge_type in ('deal_percent', 'monthly_percent') and rate >= 0 and rate <= 100)
    or charge_type not in ('deal_percent', 'monthly_percent')
  )
);

-- Код тарифа уникален внутри организации, а не глобально.
create unique index if not exists idx_service_plans_code
  on public.service_plans (organization_id, code);

create index if not exists idx_service_plans_list
  on public.service_plans (organization_id, is_active, sort_order);

alter table public.service_plans enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies
    where policyname = 'org members manage service plans' and tablename = 'service_plans') then
    create policy "org members manage service plans" on public.service_plans
      for all to authenticated
      using (organization_id = public.get_user_org_id())
      with check (organization_id = public.get_user_org_id());
  end if;
end $$;

-- Стартовые тарифы по публичным условиям агентства (housepro24.vercel.app/uslugi).
-- Заводятся каждой существующей организации; повторный прогон миграции ничего
-- не дублирует и не затирает уже изменённые ставки.
insert into public.service_plans
  (organization_id, code, title, charge_type, rate, repair_limit, obligations, directions, sort_order)
select o.id, v.code, v.title, v.charge_type, v.rate, v.repair_limit, v.obligations::jsonb, v.directions, v.sort_order
from public.organizations o
cross join (values
  ('agent', 'Агент по недвижимости', 'deal_percent', 25::numeric, null::numeric,
   '[{"code":"search","title":"Поиск арендаторов"},{"code":"check","title":"Проверка арендаторов"},{"code":"docs","title":"Подготовка документов"},{"code":"move_in","title":"Заселение"}]',
   array['rent_agent'], 10),
  ('management', 'Управление', 'monthly_percent', 10::numeric, 5000::numeric,
   '[{"code":"tenant_change","title":"Смена арендаторов"},{"code":"inspection","title":"Проверки квартиры"},{"code":"cleaning","title":"Уборка"},{"code":"repair","title":"Мелкий ремонт до 5000 ₽"},{"code":"reporting","title":"Отчётность собственнику"},{"code":"issues","title":"Решение проблем"}]',
   array['management'], 20),
  ('management_premium', 'Управление Премиум', 'monthly_percent', 15::numeric, 5000::numeric,
   '[{"code":"tenant_change","title":"Смена арендаторов"},{"code":"inspection","title":"Проверки квартиры"},{"code":"cleaning","title":"Уборка"},{"code":"repair","title":"Мелкий ремонт до 5000 ₽"},{"code":"reporting","title":"Отчётность собственнику"},{"code":"issues","title":"Решение проблем"},{"code":"insurance","title":"Страховка"},{"code":"uk","title":"Работа с управляющей компанией"},{"code":"support_247","title":"Выезды 24/7"},{"code":"manager","title":"Персональный менеджер"},{"code":"rate_review","title":"Пересмотр ставок"}]',
   array['management'], 30),
  ('tenant_search', 'Подбор для арендатора', 'negotiated', null::numeric, null::numeric,
   '[{"code":"search","title":"Поиск вариантов"},{"code":"viewings","title":"Организация просмотров"},{"code":"docs","title":"Подготовка договора найма"}]',
   array['tenant_search'], 40)
) as v(code, title, charge_type, rate, repair_limit, obligations, directions, sort_order)
on conflict (organization_id, code) do nothing;
