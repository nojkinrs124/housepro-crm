-- ═══════════════════════════════════════════════════════════════════════════
-- BASELINE SNAPSHOT (часть 2) — индексы, RLS, функции, триггеры, cron, storage
-- Реконструкция текущего состояния на 2026-07-20. См. заголовок части 1.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Индексы ─────────────────────────────────────────────────────────────────
create unique index if not exists accounting_categories_pkey on public.accounting_categories using btree (id);
create index if not exists idx_acc_categories_org_id on public.accounting_categories using btree (organization_id);
create index if not exists idx_accounting_categories_type on public.accounting_categories using btree (type);

create index if not exists idx_accounting_recurring_active on public.accounting_recurring_rules using btree (is_active);

create index if not exists idx_acc_transactions_org_id on public.accounting_transactions using btree (organization_id);
create index if not exists idx_accounting_txn_category on public.accounting_transactions using btree (category_id);
create index if not exists idx_accounting_txn_contract on public.accounting_transactions using btree (contract_id);
create index if not exists idx_accounting_txn_date on public.accounting_transactions using btree (date desc);
create index if not exists idx_accounting_txn_deal on public.accounting_transactions using btree (deal_id);
create index if not exists idx_accounting_txn_employee on public.accounting_transactions using btree (employee_id);
create index if not exists idx_accounting_txn_status on public.accounting_transactions using btree (status);
create index if not exists idx_accounting_txn_type on public.accounting_transactions using btree (type);

create index if not exists idx_api_keys_hash on public.api_keys using btree (key_hash);
create index if not exists idx_api_keys_org on public.api_keys using btree (organization_id);

create index if not exists idx_audit_logs_entity on public.audit_logs using btree (entity_type, entity_id);
create index if not exists idx_audit_logs_org_created on public.audit_logs using btree (organization_id, created_at desc);
create index if not exists idx_audit_logs_user on public.audit_logs using btree (user_id);

create index if not exists idx_bot_pending_actions_batch on public.bot_pending_actions using btree (batch_id, status);
create index if not exists idx_bot_pending_actions_chat_status on public.bot_pending_actions using btree (telegram_chat_id, status, created_at desc);

create index if not exists idx_clients_manager on public.clients using btree (manager_id);
create index if not exists idx_clients_phone on public.clients using btree (phone);
create index if not exists idx_clients_status on public.clients using btree (status);

create index if not exists idx_collection_items_col on public.collection_items using btree (collection_id);

create unique index if not exists company_settings_single_default on public.company_settings using btree (is_default) where (is_default = true);
create index if not exists idx_company_settings_org_id on public.company_settings using btree (organization_id);

create index if not exists idx_contact_representatives_contact_id on public.contact_representatives using btree (contact_id);

create index if not exists idx_contacts_full_name_trgm on public.contacts using gin (full_name gin_trgm_ops);
create index if not exists idx_contacts_org_id on public.contacts using btree (organization_id);
create index if not exists idx_contacts_phone on public.contacts using btree (phone);
create index if not exists idx_contacts_phone_trgm on public.contacts using gin (phone gin_trgm_ops);
create index if not exists idx_contacts_role on public.contacts using btree (role);
create index if not exists idx_contacts_status on public.contacts using btree (status);

create index if not exists idx_contracts_client on public.contracts using btree (client_id);
create index if not exists idx_contracts_client_contact on public.contracts using btree (client_contact_id);
create index if not exists idx_contracts_number on public.contracts using btree (contract_number);
create index if not exists idx_contracts_number_trgm on public.contracts using gin (contract_number gin_trgm_ops);
create index if not exists idx_contracts_org_id on public.contracts using btree (organization_id);
create index if not exists idx_contracts_owner_contact on public.contracts using btree (owner_contact_id);
create index if not exists idx_contracts_owner_id on public.contracts using btree (owner_id);
create index if not exists idx_contracts_status on public.contracts using btree (status);

create index if not exists idx_deal_comments_created_at on public.deal_comments using btree (created_at desc);
create index if not exists idx_deal_comments_deal_id on public.deal_comments using btree (deal_id);
create index if not exists idx_deal_comments_org_id on public.deal_comments using btree (organization_id);

create index if not exists idx_deals_client on public.deals using btree (client_id);
create index if not exists idx_deals_client_contact on public.deals using btree (client_contact_id);
create index if not exists idx_deals_org_id on public.deals using btree (organization_id);
create index if not exists idx_deals_owner_contact on public.deals using btree (owner_contact_id);
create index if not exists idx_deals_owner_id on public.deals using btree (owner_id);
create index if not exists idx_deals_status on public.deals using btree (status);

create index if not exists idx_doc_templates_org_id on public.document_templates using btree (organization_id);

create index if not exists idx_files_org_id on public.files using btree (organization_id);

create index if not exists idx_lead_activities_lead on public.lead_activities using btree (lead_id);
create index if not exists idx_lead_activities_org_id on public.lead_activities using btree (organization_id);

create index if not exists idx_leads_assigned on public.leads using btree (assigned_to);
create index if not exists idx_leads_created on public.leads using btree (created_at desc);
create index if not exists idx_leads_full_name_trgm on public.leads using gin (full_name gin_trgm_ops);
create index if not exists idx_leads_org_id on public.leads using btree (organization_id);
create index if not exists idx_leads_phone on public.leads using btree (phone);
create index if not exists idx_leads_phone_trgm on public.leads using gin (phone gin_trgm_ops);
create index if not exists idx_leads_status on public.leads using btree (status);

create index if not exists idx_logs_created on public.logs using btree (created_at);
create index if not exists idx_logs_user on public.logs using btree (user_id);

create index if not exists idx_notifications_created on public.notifications using btree (created_at desc);
create index if not exists idx_notifications_org_id on public.notifications using btree (organization_id);
create index if not exists idx_notifications_user on public.notifications using btree (user_id, is_read);

create index if not exists idx_org_members_user_id on public.organization_members using btree (user_id);

create index if not exists idx_organizations_slug on public.organizations using btree (slug);

create index if not exists idx_payments_contract_id on public.payments using btree (contract_id);
create index if not exists idx_payments_due_date on public.payments using btree (due_date);
create index if not exists idx_payments_org_id on public.payments using btree (organization_id);
create index if not exists idx_payments_status on public.payments using btree (payment_status);

create index if not exists idx_properties_address on public.properties using btree (address);
create index if not exists idx_properties_address_trgm on public.properties using gin (address gin_trgm_ops);
create index if not exists idx_properties_deal_type on public.properties using btree (deal_type);
create index if not exists idx_properties_org_id on public.properties using btree (organization_id);
create index if not exists idx_properties_status on public.properties using btree (status);
create index if not exists idx_properties_title_trgm on public.properties using gin (title gin_trgm_ops);

create index if not exists idx_collections_org on public.property_collections using btree (organization_id);
create index if not exists idx_collections_token on public.property_collections using btree (share_token);

create index if not exists idx_showings_agent_date on public.showings using btree (agent_id, scheduled_at);
create index if not exists idx_showings_lead on public.showings using btree (lead_id);
create index if not exists idx_showings_org_id on public.showings using btree (organization_id);
create index if not exists idx_showings_property on public.showings using btree (property_id);

create index if not exists idx_tasks_assigned on public.tasks using btree (assigned_to);
create index if not exists idx_tasks_org_id on public.tasks using btree (organization_id);
create index if not exists idx_tasks_status on public.tasks using btree (status);
create index if not exists idx_tasks_title_trgm on public.tasks using gin (title gin_trgm_ops);

create index if not exists idx_users_org_id on public.users using btree (organization_id);

create index if not exists idx_webhook_endpoints_org on public.webhook_endpoints using btree (organization_id);

-- ─── RLS: включить на всех таблицах ────────────────────────────────────────
do $$
declare r record;
begin
  for r in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', r.tablename);
  end loop;
end $$;

-- ─── Функции ─────────────────────────────────────────────────────────────────

create or replace function public.get_user_org_id()
returns uuid
language sql
stable security definer
as $$
  select organization_id
  from organization_members
  where user_id = auth.uid() and is_active = true
  limit 1
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.users (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.generate_contract_number()
returns trigger
language plpgsql
as $$
begin
  if new.contract_number is null then
    new.contract_number := 'HP-' || to_char(now(),'YYYY') || '-' ||
      lpad(nextval('contract_number_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;

create or replace function public.check_expiring_contracts()
returns void
language plpgsql
security definer
as $$
declare
  rec record;
begin
  for rec in
    select c.id, c.contract_number, c.end_date, c.manager_id
    from public.contracts c
    where c.status = 'signed'
      and c.end_date between now() and now() + interval '14 days'
      and c.manager_id is not null
  loop
    insert into public.notifications (user_id, type, title, body, entity_type, entity_id)
    values (
      rec.manager_id,
      'contract_expiry',
      'Договор истекает',
      'Договор ' || coalesce(rec.contract_number, '#' || rec.id::text) || ' истекает ' || rec.end_date::date,
      'contract',
      rec.id
    )
    on conflict do nothing;
  end loop;
end;
$$;

create or replace function public.check_overdue_payments()
returns void
language plpgsql
security definer
as $$
declare
  rec record;
begin
  update public.payments
  set payment_status = 'overdue'
  where payment_status in ('pending', 'partial')
    and due_date < now()
    and due_date is not null;

  for rec in
    select p.id, p.amount, p.due_date, c.manager_id, ct.contract_number
    from public.payments p
    left join public.contracts ct on ct.id = p.contract_id
    left join public.users c on c.id = ct.manager_id
    where p.payment_status = 'overdue'
      and p.due_date >= now() - interval '1 day'
      and c.manager_id is not null
  loop
    insert into public.notifications (user_id, type, title, body, entity_type, entity_id)
    values (
      rec.manager_id,
      'overdue_payment',
      'Просроченный платёж',
      'Платёж ' || coalesce(rec.contract_number, '') || ' на сумму ' || rec.amount || ' ₽ просрочен с ' || rec.due_date::date,
      'payment',
      rec.id
    )
    on conflict do nothing;
  end loop;
end;
$$;

-- NB: не используется в cron.job на 20.07.2026 (см. cron.job ниже — только
-- check_expiring_contracts запланирован через pg_cron, просрочка платежей идёт
-- через Edge Function check-overdue). Похоже на мёртвый/неактивный код — не
-- удалять без проверки, но и не считать активным механизмом.
create or replace function public.mark_overdue_payments()
returns void
language plpgsql
as $$
begin
  update payments
  set payment_status = 'overdue'
  where payment_status = 'pending'
    and due_date is not null
    and due_date < current_date;
end;
$$;

create or replace function public.import_rental_contract(
  p_org_id uuid, p_owner jsonb, p_tenant jsonb, p_property jsonb, p_deal jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_owner_id uuid;
  v_tenant_id uuid;
  v_property_id uuid;
  v_deal_id uuid;
begin
  if p_owner ? 'phone' and p_owner->>'phone' is not null then
    select id into v_owner_id from public.contacts
      where organization_id = p_org_id and phone = p_owner->>'phone' limit 1;
  end if;
  if v_owner_id is null then
    insert into public.contacts (organization_id, full_name, phone, email, role,
      passport_series, passport_number, passport_issued_date, passport_issued_by,
      passport_department_code, country, region, city, street, house_number, building, apartment)
    values (p_org_id, p_owner->>'full_name', p_owner->>'phone', p_owner->>'email', 'owner',
      p_owner->>'passport_series', p_owner->>'passport_number',
      nullif(p_owner->>'passport_issued_date','')::date, p_owner->>'passport_issued_by',
      p_owner->>'passport_department_code', p_owner->>'country', p_owner->>'region',
      p_owner->>'city', p_owner->>'street', p_owner->>'house_number',
      p_owner->>'building', p_owner->>'apartment')
    returning id into v_owner_id;
  end if;

  if p_tenant ? 'phone' and p_tenant->>'phone' is not null then
    select id into v_tenant_id from public.contacts
      where organization_id = p_org_id and phone = p_tenant->>'phone' limit 1;
  end if;
  if v_tenant_id is null then
    insert into public.contacts (organization_id, full_name, phone, email, role,
      passport_series, passport_number, passport_issued_date, passport_issued_by,
      passport_department_code, country, region, city, street, house_number, building, apartment)
    values (p_org_id, p_tenant->>'full_name', p_tenant->>'phone', p_tenant->>'email', 'client',
      p_tenant->>'passport_series', p_tenant->>'passport_number',
      nullif(p_tenant->>'passport_issued_date','')::date, p_tenant->>'passport_issued_by',
      p_tenant->>'passport_department_code', p_tenant->>'country', p_tenant->>'region',
      p_tenant->>'city', p_tenant->>'street', p_tenant->>'house_number',
      p_tenant->>'building', p_tenant->>'apartment')
    returning id into v_tenant_id;
  end if;

  insert into public.properties (organization_id, title, property_type, deal_type, address,
    district, price, deposit, area, rooms, floor, owner_id, status)
  values (p_org_id, p_property->>'title', p_property->>'property_type', p_property->>'deal_type',
    p_property->>'address', p_property->>'district',
    nullif(p_property->>'price','')::numeric, nullif(p_property->>'deposit','')::numeric,
    nullif(p_property->>'area','')::numeric, nullif(p_property->>'rooms','')::int,
    nullif(p_property->>'floor','')::int, v_owner_id, coalesce(p_property->>'status','rented'))
  returning id into v_property_id;

  insert into public.deals (organization_id, property_id, owner_contact_id, client_contact_id,
    deal_type, status, amount, notes)
  values (p_org_id, v_property_id, v_owner_id, v_tenant_id,
    coalesce(p_deal->>'deal_type', p_property->>'deal_type'),
    coalesce(p_deal->>'status', 'contract'),
    nullif(p_deal->>'amount','')::numeric, p_deal->>'notes')
  returning id into v_deal_id;

  return jsonb_build_object(
    'owner_id', v_owner_id, 'tenant_id', v_tenant_id,
    'property_id', v_property_id, 'deal_id', v_deal_id
  );
end;
$$;

-- ─── Триггеры ────────────────────────────────────────────────────────────────
drop trigger if exists set_contract_number on public.contracts;
create trigger set_contract_number before insert on public.contracts
  for each row execute function public.generate_contract_number();

-- Триггер на auth.users создаётся отдельно вручную через Supabase Dashboard/CLI,
-- т.к. apply_migration не имеет прав на схему auth в части триггеров в некоторых
-- конфигурациях. Если создаётся с нуля:
-- create trigger on_auth_user_created after insert on auth.users
--   for each row execute function public.handle_new_user();

-- ─── RLS policies ────────────────────────────────────────────────────────────
-- org_id-изоляция через get_user_org_id() — стандартный паттерн для всех
-- multi-tenant таблиц. НЕ делать subquery к той же таблице (см. CLAUDE.md).

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='organizations' and policyname='Members can view their org') then
    create policy "Members can view their org" on public.organizations for select to authenticated
      using (id in (select organization_members.organization_id from organization_members where organization_members.user_id = auth.uid() and organization_members.is_active = true));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='organization_members' and policyname='Members can view org membership') then
    create policy "Members can view org membership" on public.organization_members for select
      using (user_id = auth.uid() or organization_id = get_user_org_id());
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='users' and policyname='Auth users can view all profiles') then
    create policy "Auth users can view all profiles" on public.users for select using (auth.uid() is not null);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='users' and policyname='System can insert users') then
    create policy "System can insert users" on public.users for insert with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='users' and policyname='Users can update own profile') then
    create policy "Users can update own profile" on public.users for update using (id = auth.uid());
  end if;
end $$;

-- Стандартные org-изоляционные политики (ALL, authenticated, org_id = get_user_org_id())
do $$
declare
  tbl text;
  tables text[] := array[
    'accounting_categories','accounting_recurring_rules','accounting_transactions',
    'api_keys','company_settings','contracts','deal_comments','deals',
    'document_templates','files','lead_activities','leads','logs','payments',
    'property_collections','showings','tasks','webhook_endpoints'
  ];
begin
  foreach tbl in array tables loop
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=tbl and cmd='ALL') then
      execute format(
        'create policy %I on public.%I for all to authenticated using (organization_id = get_user_org_id()) with check (organization_id = get_user_org_id())',
        'org members can access ' || tbl, tbl
      );
    end if;
  end loop;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='bot_allowed_users' and policyname='org_isolation') then
    create policy "org_isolation" on public.bot_allowed_users for all using (organization_id = get_user_org_id()) with check (organization_id = get_user_org_id());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='bot_conversations' and policyname='org_isolation') then
    create policy "org_isolation" on public.bot_conversations for all using (organization_id = get_user_org_id()) with check (organization_id = get_user_org_id());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='bot_pending_actions' and policyname='org_isolation') then
    create policy "org_isolation" on public.bot_pending_actions for all using (organization_id = get_user_org_id()) with check (organization_id = get_user_org_id());
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='audit_logs' and policyname='org members can view audit logs') then
    create policy "org members can view audit logs" on public.audit_logs for select to authenticated using (organization_id = get_user_org_id());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='audit_logs' and policyname='service can insert audit logs') then
    create policy "service can insert audit logs" on public.audit_logs for insert to authenticated with check (organization_id = get_user_org_id());
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='contacts' and policyname='org members can view contacts') then
    create policy "org members can view contacts" on public.contacts for select to authenticated using (organization_id = get_user_org_id());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='contacts' and policyname='org members can insert contacts') then
    create policy "org members can insert contacts" on public.contacts for insert to authenticated with check (organization_id = get_user_org_id());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='contacts' and policyname='org members can update contacts') then
    create policy "org members can update contacts" on public.contacts for update to authenticated using (organization_id = get_user_org_id()) with check (organization_id = get_user_org_id());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='contacts' and policyname='org admins can delete contacts') then
    create policy "org admins can delete contacts" on public.contacts for delete to authenticated using (organization_id = get_user_org_id());
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='contact_representatives' and policyname='org members can access contact_representatives') then
    create policy "org members can access contact_representatives" on public.contact_representatives for all to authenticated
      using (exists (select 1 from contacts c where c.id = contact_representatives.contact_id and c.organization_id = get_user_org_id()));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='contract_versions' and policyname='org members can access contract_versions') then
    create policy "org members can access contract_versions" on public.contract_versions for all to authenticated
      using (exists (select 1 from contracts c where c.id = contract_versions.contract_id and c.organization_id = get_user_org_id()));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='properties' and policyname='org members can access properties') then
    create policy "org members can access properties" on public.properties for all to authenticated
      using (organization_id = get_user_org_id()) with check (organization_id = get_user_org_id());
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='notifications' and policyname='org members insert notifications') then
    create policy "org members insert notifications" on public.notifications for insert to authenticated with check (organization_id = get_user_org_id());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='notifications' and policyname='org members see own notifications') then
    create policy "org members see own notifications" on public.notifications for select to authenticated using (organization_id = get_user_org_id() and user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='notifications' and policyname='org members update own notifications') then
    create policy "org members update own notifications" on public.notifications for update to authenticated using (organization_id = get_user_org_id() and user_id = auth.uid());
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='collection_items' and policyname='org collection items access') then
    create policy "org collection items access" on public.collection_items for all to authenticated
      using (exists (select 1 from property_collections pc where pc.id = collection_items.collection_id and pc.organization_id = get_user_org_id()));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='collection_items' and policyname='public can view public collection items') then
    create policy "public can view public collection items" on public.collection_items for select to anon
      using (exists (select 1 from property_collections pc where pc.id = collection_items.collection_id and pc.is_public = true));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='property_collections' and policyname='public can view public collections') then
    create policy "public can view public collections" on public.property_collections for select to anon using (is_public = true);
  end if;
end $$;

-- LEGACY-таблицы clients/owners — не org-изолированы (созданы до multi-tenancy),
-- оставлены как есть, новые фичи их не используют (см. CLAUDE.md).
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='clients' and policyname='Auth view clients') then
    create policy "Auth view clients" on public.clients for select using (auth.uid() is not null);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='clients' and policyname='Auth insert clients') then
    create policy "Auth insert clients" on public.clients for insert with check (auth.uid() is not null);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='clients' and policyname='Auth update clients') then
    create policy "Auth update clients" on public.clients for update using (auth.uid() is not null);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='clients' and policyname='Admin delete clients') then
    create policy "Admin delete clients" on public.clients for delete
      using (exists (select 1 from users where users.id = auth.uid() and users.role = any (array['admin','manager'])));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='owners' and policyname='Auth manage owners') then
    create policy "Auth manage owners" on public.owners for all using (auth.uid() is not null);
  end if;
end $$;

-- ─── pg_cron задачи ──────────────────────────────────────────────────────────
select cron.schedule('check-expiring-contracts', '5 6 * * *', $$select public.check_expiring_contracts()$$)
where not exists (select 1 from cron.job where jobname = 'check-expiring-contracts');

-- check-overdue-daily-telegram вызывает Edge Function по HTTP — URL проекта
-- зашит в определении задачи, пересоздавать вручную при переносе на другой
-- Supabase-проект.

-- ─── Storage buckets ─────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('contracts', 'contracts', false, 52428800, array['application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/pdf','application/msword']),
  ('document-templates', 'document-templates', false, 52428800, array['application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('property-photos', 'property-photos', true, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
-- buckets 'files' и 'avatars' уже описаны в существующих migrations/*.sql

-- ─── Storage policies ────────────────────────────────────────────────────────
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='Anyone can read property photos') then
    create policy "Anyone can read property photos" on storage.objects for select using (bucket_id = 'property-photos');
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='Auth users can upload property photos') then
    create policy "Auth users can upload property photos" on storage.objects for insert with check (bucket_id = 'property-photos' and auth.uid() is not null);
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='Auth users can read contracts') then
    create policy "Auth users can read contracts" on storage.objects for select using (bucket_id = 'contracts' and auth.uid() is not null);
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='Auth users can upload contracts') then
    create policy "Auth users can upload contracts" on storage.objects for insert with check (bucket_id = 'contracts' and auth.uid() is not null);
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='Auth users can read templates') then
    create policy "Auth users can read templates" on storage.objects for select using (bucket_id = 'document-templates' and auth.uid() is not null);
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='Auth users can upload templates') then
    create policy "Auth users can upload templates" on storage.objects for insert with check (bucket_id = 'document-templates' and auth.uid() is not null);
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='Authenticated users can read templates') then
    create policy "Authenticated users can read templates" on storage.objects for select to authenticated using (bucket_id = 'document-templates');
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='Authenticated users can upload templates') then
    create policy "Authenticated users can upload templates" on storage.objects for insert to authenticated with check (bucket_id = 'document-templates');
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='Authenticated users can delete templates') then
    create policy "Authenticated users can delete templates" on storage.objects for delete to authenticated using (bucket_id = 'document-templates');
  end if;
end $$;
-- Политики для buckets 'files' и 'avatars' — см. существующие migrations/*.sql
