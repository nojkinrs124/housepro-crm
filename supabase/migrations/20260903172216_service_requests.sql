-- Заявки арендатора на бытовые услуги: клининг, электрик, сантехник.
--
-- Отдельная таблица, а не сразу задача, потому что у заявки две аудитории:
-- арендатор видит её статус в кабинете, менеджер ведёт задачу в CRM. Поля и
-- статусы задачи не годятся для показа наружу — смешать их значило бы
-- показывать жильцу внутреннюю кухню агентства.
--
-- Справочника подрядчиков нет намеренно (решение Р2): исполнителя ответственный
-- находит сам. Если объектов станет много — это отдельная будущая работа.
create table if not exists public.service_requests (
  "id" uuid primary key default gen_random_uuid(),
  "organization_id" uuid not null references public.organizations(id) on delete cascade,
  "engagement_id" uuid references public.management_engagements(id) on delete set null,
  "property_id" uuid not null references public.properties(id) on delete cascade,
  "contact_id" uuid not null references public.contacts(id) on delete cascade,
  "category" text not null,
  "description" text not null,
  "photo_urls" text[],
  "status" text not null default 'new',
  "reject_reason" text,
  -- Задача ответственному: заявка попадает в общий поток работы, а не живёт
  -- отдельным списком, про который забывают.
  "task_id" uuid references public.tasks(id) on delete set null,
  -- Расход по выполненной заявке — он же попадёт в отчёт собственнику.
  "transaction_id" uuid references public.accounting_transactions(id) on delete set null,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  "closed_at" timestamptz,
  constraint service_requests_category_check check (category = any (array[
    'cleaning'::text, 'plumbing'::text, 'electrical'::text, 'appliance'::text, 'other'::text
  ])),
  constraint service_requests_status_check check (status = any (array[
    'new'::text, 'accepted'::text, 'in_progress'::text, 'done'::text, 'rejected'::text
  ])),
  -- Отказ без причины — это молчание в лицо жильцу, а не решение.
  constraint service_requests_reject_reason_check check (
    status <> 'rejected' or reject_reason is not null
  )
);

create index if not exists idx_service_requests_property
  on public.service_requests (property_id, created_at desc);

create index if not exists idx_service_requests_open
  on public.service_requests (organization_id, status, created_at desc);

create index if not exists idx_service_requests_contact
  on public.service_requests (contact_id, created_at desc);

alter table public.service_requests enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies
    where policyname = 'org members manage service requests' and tablename = 'service_requests') then
    create policy "org members manage service requests" on public.service_requests
      for all to authenticated
      using (organization_id = public.get_user_org_id())
      with check (organization_id = public.get_user_org_id());
  end if;
end $$;
