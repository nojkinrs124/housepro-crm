-- Фаза 3 аудита (3.2): вебхуки отправлялись fire-and-forget — без await, без
-- журнала доставок, без ретраев, без ключа идемпотентности. В serverless
-- (Vercel) функция может завершиться раньше, чем fetch() долетит — событие
-- просто пропадает, и это никак не видно ни в UI, ни в логах.
--
-- journal: каждая попытка доставки события на конечную точку фиксируется.
-- idempotency_key — дедупликация на стороне получателя (повтор той же
-- доставки после ретрая не создаёт на их стороне вторую операцию).

create table if not exists public.webhook_deliveries (
  id uuid not null default gen_random_uuid(),
  organization_id uuid not null,
  endpoint_id uuid not null,
  event text not null,
  idempotency_key uuid not null default gen_random_uuid(),
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'delivered', 'failed')),
  attempts int not null default 0,
  last_error text,
  next_attempt_at timestamptz not null default now(),
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.webhook_deliveries
  add constraint webhook_deliveries_pkey primary key (id);

alter table public.webhook_deliveries
  add constraint webhook_deliveries_organization_id_fkey
  foreign key (organization_id) references public.organizations(id) on delete cascade;

alter table public.webhook_deliveries
  add constraint webhook_deliveries_endpoint_id_fkey
  foreign key (endpoint_id) references public.webhook_endpoints(id) on delete cascade;

create index if not exists idx_webhook_deliveries_pending
  on public.webhook_deliveries (status, next_attempt_at) where status = 'pending';

create index if not exists idx_webhook_deliveries_org
  on public.webhook_deliveries (organization_id, created_at desc);

alter table public.webhook_deliveries enable row level security;

create policy "org admins read webhook deliveries"
  on public.webhook_deliveries for select to authenticated
  using (
    organization_id = get_user_org_id()
    and exists (
      select 1 from public.organization_members m
      where m.organization_id = public.webhook_deliveries.organization_id
        and m.user_id = auth.uid()
        and m.role = 'admin'
    )
  );

-- Запись и обновление доставок — только из серверного кода (service_role),
-- не через PostgREST с сессией пользователя.
