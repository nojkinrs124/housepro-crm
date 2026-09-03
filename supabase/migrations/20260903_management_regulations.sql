-- Регламент обслуживания: что и с какой периодичностью делается по объекту
-- в управлении.
--
-- Сами события материализуются в существующую таблицу tasks: она уже связана с
-- объектом, имеет срок, статус, исполнителя и приоритет, уже показывается в
-- календаре, в разделе задач и в дайджесте. «Снять показания до 5 числа» — это
-- и есть задача, и заводить под неё отдельную таблицу значило бы делать заново
-- календарь и напоминания.
--
-- Здесь хранится только ШАБЛОН: правило привязано к тарифу, и именно им
-- различаются «Управление» и «Управление Премиум» — у премиума проверки чаще и
-- добавляются пересмотр ставки и работа с управляющей компанией.
create table if not exists public.management_regulations (
  "id" uuid primary key default gen_random_uuid(),
  "organization_id" uuid not null references public.organizations(id) on delete cascade,
  "plan_id" uuid references public.service_plans(id) on delete cascade,
  "code" text not null,
  "title" text not null,
  "description" text,
  -- monthly | quarterly | semiannual | annual | on_event
  -- on_event — привязка не к календарю, а к дате из данных (окончание договора найма)
  "period" text not null,
  "day_of_month" integer,
  -- За сколько дней до срока создавать задачу: показания снимают заранее,
  -- а о конце договора думают за месяц.
  "lead_days" integer not null default 0,
  "priority" text not null default 'medium',
  "is_active" boolean not null default true,
  "sort_order" integer not null default 0,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  constraint management_regulations_period_check check (period = any (array[
    'monthly'::text, 'quarterly'::text, 'semiannual'::text, 'annual'::text, 'on_event'::text
  ])),
  constraint management_regulations_day_check check (
    day_of_month is null or (day_of_month >= 1 and day_of_month <= 28)
  ),
  constraint management_regulations_lead_check check (lead_days >= 0 and lead_days <= 90),
  constraint management_regulations_priority_check check (priority = any (array[
    'low'::text, 'medium'::text, 'high'::text
  ]))
);

create unique index if not exists idx_management_regulations_code
  on public.management_regulations (organization_id, plan_id, code);

create index if not exists idx_management_regulations_plan
  on public.management_regulations (plan_id, is_active, sort_order);

alter table public.management_regulations enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies
    where policyname = 'org members manage regulations' and tablename = 'management_regulations') then
    create policy "org members manage regulations" on public.management_regulations
      for all to authenticated
      using (organization_id = public.get_user_org_id())
      with check (organization_id = public.get_user_org_id());
  end if;
end $$;

-- ── Задачи: связь с обслуживанием и правилом ──
alter table public.tasks add column if not exists "engagement_id" uuid references public.management_engagements(id) on delete set null;
-- По какому правилу создана. Пусто у задач, заведённых руками.
alter table public.tasks add column if not exists "regulation_code" text;

-- Защита от дублей при повторном прогоне крона. Именно индексом, а не проверкой
-- в коде: крон может запуститься дважды, и «проверил-вставил» между двумя
-- запусками не спасает.
create unique index if not exists idx_tasks_regulation_unique
  on public.tasks (engagement_id, regulation_code, due_date)
  where regulation_code is not null and engagement_id is not null;

create index if not exists idx_tasks_engagement
  on public.tasks (engagement_id) where engagement_id is not null;

-- ── Наполнение регламентов по тарифам ──
-- Обычное «Управление»: показания, сбор оплаты, выплата собственнику,
-- проверка объекта раз в полгода, напоминание об окончании договора найма.
insert into public.management_regulations
  (organization_id, plan_id, code, title, description, period, day_of_month, lead_days, priority, sort_order)
select p.organization_id, p.id, v.code, v.title, v.description, v.period, v.day_of_month, v.lead_days, v.priority, v.sort_order
from public.service_plans p
cross join (values
  ('meter_reading',   'Снять показания счётчиков', 'Показания нужны для начисления коммунальных платежей и отчёта собственнику', 'monthly',    25, 3,  'medium', 10),
  ('rent_collection', 'Принять оплату от арендатора', null,                                                                       'monthly',     5, 2,  'high',   20),
  ('owner_payout',    'Перечислить собственнику',  'Сумма — из взаиморасчёта по объекту',                                          'monthly',    10, 1,  'high',   30),
  ('inspection',      'Проверить состояние квартиры', 'Осмотр объекта: сантехника, техника, следы протечек',                       'semiannual', 15, 7,  'medium', 40),
  ('contract_expiry', 'Договор найма заканчивается', 'Продлить с текущим арендатором или искать нового',                           'on_event',   null, 30, 'high',  50)
) as v(code, title, description, period, day_of_month, lead_days, priority, sort_order)
where p.code = 'management'
on conflict (organization_id, plan_id, code) do nothing;

-- «Управление Премиум»: то же самое, но проверки квартиры ежеквартально,
-- плюс пересмотр ставки и работа с управляющей компанией.
insert into public.management_regulations
  (organization_id, plan_id, code, title, description, period, day_of_month, lead_days, priority, sort_order)
select p.organization_id, p.id, v.code, v.title, v.description, v.period, v.day_of_month, v.lead_days, v.priority, v.sort_order
from public.service_plans p
cross join (values
  ('meter_reading',   'Снять показания счётчиков', 'Показания нужны для начисления коммунальных платежей и отчёта собственнику', 'monthly',    25, 3,  'medium', 10),
  ('rent_collection', 'Принять оплату от арендатора', null,                                                                       'monthly',     5, 2,  'high',   20),
  ('owner_payout',    'Перечислить собственнику',  'Сумма — из взаиморасчёта по объекту',                                          'monthly',    10, 1,  'high',   30),
  ('inspection',      'Проверить состояние квартиры', 'Осмотр объекта раз в квартал — по условиям премиального тарифа',            'quarterly',  15, 7,  'medium', 40),
  ('contract_expiry', 'Договор найма заканчивается', 'Продлить с текущим арендатором или искать нового',                           'on_event',   null, 30, 'high',  50),
  ('rate_review',     'Пересмотреть ставку аренды', 'Сверить с рынком и предложить собственнику новую ставку',                     'annual',      1, 14, 'medium', 60),
  ('uk_liaison',      'Сверка с управляющей компанией', 'Задолженность по ЖКУ, начисления, показания общедомовых приборов',        'quarterly',  20, 5,  'low',    70)
) as v(code, title, description, period, day_of_month, lead_days, priority, sort_order)
where p.code = 'management_premium'
on conflict (organization_id, plan_id, code) do nothing;
