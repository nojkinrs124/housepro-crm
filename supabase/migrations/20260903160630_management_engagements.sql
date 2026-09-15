-- Объект в управлении как долгоживущая сущность.
--
-- Управление — не сделка: оно не заканчивается заселением, а с него начинается
-- и длится годами, переживая смену арендаторов. Раньше раздел «Управление» был
-- витриной, которая каждый раз выводила список из properties.deal_type и типа
-- договора — своей сущности не существовало, и вешать на неё регламент,
-- счётчики и взаиморасчёт было некуда.
--
-- Условия расчёта (собственник, схема, ставка) обнуляемы намеренно. В боевых
-- данных два объекта в управлении, и у обоих properties.owner_id пуст: NOT NULL
-- заставил бы либо выдумать собственника, либо выбросить запись. Обязательность
-- проверяет Server Action при заведении, а незаполненное показывает карточка —
-- тот же принцип, что и в блоке «Чего не хватает».
create table if not exists public.management_engagements (
  "id" uuid primary key default gen_random_uuid(),
  "organization_id" uuid not null references public.organizations(id) on delete cascade,
  "property_id" uuid not null references public.properties(id) on delete cascade,
  "owner_contact_id" uuid references public.contacts(id) on delete set null,
  "contract_id" uuid references public.contracts(id) on delete set null,
  "plan_id" uuid references public.service_plans(id) on delete set null,
  -- percent — агентство удерживает процент от платежа арендатора
  -- fixed   — агентство платит собственнику фиксированную сумму, разницу оставляет себе
  "settlement_scheme" text,
  "rate" numeric,
  "owner_fixed_amount" numeric,
  "owner_payout_day" integer,
  -- Копия лимита мелкого ремонта из тарифа на момент старта: тариф могут
  -- поправить, а условия действующего обслуживания меняться не должны.
  "repair_limit" numeric,
  "started_at" date not null default current_date,
  "ended_at" date,
  "status" text not null default 'onboarding',
  "deal_id" uuid references public.deals(id) on delete set null,
  "notes" text,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  constraint management_engagements_status_check check (status = any (array[
    'onboarding'::text, 'active'::text, 'paused'::text, 'ended'::text
  ])),
  constraint management_engagements_scheme_check check (
    settlement_scheme is null or settlement_scheme = any (array['percent'::text, 'fixed'::text])
  ),
  constraint management_engagements_payout_day_check check (
    owner_payout_day is null or (owner_payout_day >= 1 and owner_payout_day <= 28)
  ),
  -- Схема и её параметры должны быть согласованы: фиксированная выплата без
  -- суммы и дня — обслуживание, по которому нельзя посчитать обязательство.
  constraint management_engagements_scheme_fields_check check (
    settlement_scheme is null
    or (settlement_scheme = 'percent' and owner_fixed_amount is null and owner_payout_day is null)
    or (settlement_scheme = 'fixed' and owner_fixed_amount is not null and owner_payout_day is not null)
  ),
  constraint management_engagements_period_check check (ended_at is null or ended_at >= started_at)
);

-- Один объект — одно действующее обслуживание. Второе означало бы два
-- взаиморасчёта по одной квартире.
create unique index if not exists idx_management_engagements_active_property
  on public.management_engagements (property_id) where ended_at is null;

create index if not exists idx_management_engagements_list
  on public.management_engagements (organization_id, status, started_at desc);

create index if not exists idx_management_engagements_owner
  on public.management_engagements (owner_contact_id) where owner_contact_id is not null;

alter table public.management_engagements enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies
    where policyname = 'org members manage engagements' and tablename = 'management_engagements') then
    create policy "org members manage engagements" on public.management_engagements
      for all to authenticated
      using (organization_id = public.get_user_org_id())
      with check (organization_id = public.get_user_org_id());
  end if;
end $$;

-- ── Перенос существующих объектов в управлении ──
-- Два пути попадания, оба учитываются: тип сделки «управление» у объекта либо
-- оформленный договор управления. Второй важнее — тип у объекта могли не
-- переставить, а договор уже действует.
--
-- Статус 'onboarding', а не 'active': условия расчёта не заполнены (собственник
-- не привязан, схема не выбрана), и притворяться, что обслуживание налажено,
-- значило бы соврать в отчётах. Карточка покажет, что дозаполнить.
--
-- repair_limit НЕ заполняется из properties.management_fee: это разные
-- величины — вознаграждение агентства в месяц и лимит ремонта за его счёт.
-- Прежнее вознаграждение уходит в примечание, чтобы не потерялось.
insert into public.management_engagements
  (organization_id, property_id, owner_contact_id, contract_id, started_at, status, notes)
select
  p.organization_id,
  p.id,
  p.owner_id,
  c.id,
  coalesce(c.start_date, p.created_at::date, current_date),
  'onboarding',
  'Перенесено при переходе на новую модель управления 03.09.2026. Дозаполнить: собственник, тариф, схема расчёта.' ||
  case
    when p.management_fee is not null
      -- Приведение к тексту, а не to_char: маска 'FM999999990.99' оставляет
      -- у целых сумм висящую точку («4000. ₽/мес»), а текст читает человек.
      then ' В карточке объекта было указано вознаграждение ' ||
           p.management_fee::text || ' ₽/мес.'
    else ''
  end
from public.properties p
left join lateral (
  select ct.id, ct.start_date
  from public.contracts ct
  where ct.property_id = p.id and ct.contract_type in ('property_management', 'sublease')
  order by ct.start_date desc nulls last, ct.created_at desc
  limit 1
) c on true
where (p.deal_type = 'management' or c.id is not null)
  and not exists (
    select 1 from public.management_engagements me
    where me.property_id = p.id and me.ended_at is null
  );
