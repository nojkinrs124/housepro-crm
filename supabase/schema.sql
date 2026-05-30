-- ============================================================
-- HousePro CRM — Полная схема базы данных для Supabase
-- Выполни этот SQL в Supabase → SQL Editor
-- ============================================================

-- 1. USERS TABLE
-- Профили сотрудников (связаны с auth.users)
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text not null default '',
  role text not null default 'agent' check (role in ('admin', 'manager', 'agent', 'accountant')),
  phone text,
  avatar_url text,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc', now())
);

-- Автосоздание профиля при регистрации
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. OWNERS TABLE
-- Собственники объектов (отдельно от клиентов)
create table if not exists public.owners (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  passport text,
  comment text,
  created_at timestamp with time zone default timezone('utc', now())
);

-- 3. CLIENTS TABLE
-- База клиентов агентства
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  telegram text,
  whatsapp text,
  passport text,
  birth_date date,
  comment text,
  source text,
  status text not null default 'new' check (
    status in ('new', 'in_progress', 'active', 'closed', 'vip', 'blacklist')
  ),
  manager_id uuid references public.users(id) on delete set null,
  created_at timestamp with time zone default timezone('utc', now())
);

-- 4. PROPERTIES TABLE
-- Объекты недвижимости
create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  property_type text not null check (
    property_type in ('apartment', 'house', 'commercial', 'office', 'warehouse', 'land')
  ),
  deal_type text not null check (
    deal_type in ('rent', 'sale', 'management', 'subrent')
  ),
  address text not null,
  district text,
  price numeric,
  deposit numeric,
  area numeric,
  rooms integer,
  floor integer,
  description text,
  owner_id uuid references public.owners(id) on delete set null,
  manager_id uuid references public.users(id) on delete set null,
  status text not null default 'available' check (
    status in ('available', 'reserved', 'rented', 'sold', 'inactive')
  ),
  created_at timestamp with time zone default timezone('utc', now())
);

-- 5. CONTRACTS TABLE
-- Договоры — главная таблица CRM
create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  contract_number text unique,
  contract_type text not null check (
    contract_type in (
      'rent_apartment', 'rent_commercial', 'sale_apartment',
      'sale_house', 'property_management', 'sublease', 'agency_contract'
    )
  ),
  client_id uuid references public.clients(id) on delete set null,
  property_id uuid references public.properties(id) on delete set null,
  manager_id uuid references public.users(id) on delete set null,
  start_date date,
  end_date date,
  amount numeric,
  deposit numeric,
  status text not null default 'draft' check (
    status in ('draft', 'generated', 'signed', 'completed', 'cancelled')
  ),
  generated_docx_url text,
  generated_pdf_url text,
  notes text,
  created_at timestamp with time zone default timezone('utc', now())
);

-- Автогенерация номера договора
create or replace function generate_contract_number()
returns trigger as $$
begin
  if new.contract_number is null then
    new.contract_number := 'HP-' || to_char(now(), 'YYYY') || '-' ||
      lpad(nextval('contract_number_seq')::text, 4, '0');
  end if;
  return new;
end;
$$ language plpgsql;

create sequence if not exists contract_number_seq start 1;

drop trigger if exists set_contract_number on public.contracts;
create trigger set_contract_number
  before insert on public.contracts
  for each row execute procedure generate_contract_number();

-- 6. FILES TABLE
-- Хранение ссылок на файлы в Supabase Storage
create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  file_name text,
  file_url text,
  file_type text,
  contract_id uuid references public.contracts(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  property_id uuid references public.properties(id) on delete cascade,
  uploaded_by uuid references public.users(id) on delete set null,
  created_at timestamp with time zone default timezone('utc', now())
);

-- 6.5 LEADS TABLE
-- Потенциальные клиенты (лиды)
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  full_name text,
  phone text,
  telegram text,
  whatsapp text,
  source text,
  comment text,
  status text not null default 'new' check (
    status in ('new', 'contacted', 'interested', 'converted', 'rejected')
  ),
  assigned_to uuid references public.users(id) on delete set null,
  created_at timestamp with time zone default timezone('utc', now())
);

-- 7. TASKS TABLE
-- Задачи для сотрудников
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  assigned_to uuid references public.users(id) on delete set null,
  created_by uuid references public.users(id) on delete set null,
  status text not null default 'todo' check (
    status in ('todo', 'in_progress', 'done', 'cancelled')
  ),
  priority text not null default 'medium' check (
    priority in ('low', 'medium', 'high')
  ),
  deadline timestamp with time zone,
  created_at timestamp with time zone default timezone('utc', now())
);

-- 7.5 DEALS TABLE
-- Сделки (трансакции)
create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  owner_id uuid references public.owners(id) on delete set null,
  property_id uuid references public.properties(id) on delete set null,
  deal_type text not null check (
    deal_type in ('rent', 'sale', 'management', 'subrent')
  ),
  amount numeric,
  commission numeric,
  notes text,
  status text not null default 'new' check (
    status in ('new', 'in_progress', 'completed', 'cancelled')
  ),
  manager_id uuid references public.users(id) on delete set null,
  created_at timestamp with time zone default timezone('utc', now())
);

-- 8. PAYMENTS TABLE
-- Платежи по договорам
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid references public.contracts(id) on delete cascade,
  amount numeric not null,
  payment_type text,
  payment_status text default 'pending' check (
    payment_status in ('pending', 'paid', 'overdue', 'cancelled')
  ),
  payment_date timestamp with time zone,
  notes text,
  created_at timestamp with time zone default timezone('utc', now())
);

-- 9. LOGS TABLE
-- История действий сотрудников
create table if not exists public.logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamp with time zone default timezone('utc', now())
);

-- 10. DOCUMENT TEMPLATES TABLE
-- DOCX шаблоны договоров
create table if not exists public.document_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  template_type text not null,
  file_url text not null,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamp with time zone default timezone('utc', now())
);

-- 11. CONTRACT VERSIONS TABLE
-- История версий договоров (для отслеживания изменений DOCX)
create table if not exists public.contract_versions (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid references public.contracts(id) on delete cascade not null,
  version integer not null,
  docx_url text,
  pdf_url text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamp with time zone default timezone('utc', now()),
  unique(contract_id, version)
);

create index if not exists idx_contract_versions_contract on public.contract_versions(contract_id);
create index if not exists idx_contract_versions_created on public.contract_versions(created_at);

-- ============================================================
-- ИНДЕКСЫ для производительности
-- ============================================================

create index if not exists idx_clients_phone on public.clients(phone);
create index if not exists idx_clients_manager on public.clients(manager_id);
create index if not exists idx_clients_status on public.clients(status);
create index if not exists idx_properties_address on public.properties(address);
create index if not exists idx_properties_status on public.properties(status);
create index if not exists idx_properties_deal_type on public.properties(deal_type);
create index if not exists idx_contracts_number on public.contracts(contract_number);
create index if not exists idx_contracts_client on public.contracts(client_id);
create index if not exists idx_contracts_status on public.contracts(status);
create index if not exists idx_tasks_assigned on public.tasks(assigned_to);
create index if not exists idx_tasks_status on public.tasks(status);
create index if not exists idx_logs_user on public.logs(user_id);
create index if not exists idx_logs_created on public.logs(created_at);
create index if not exists idx_leads_phone on public.leads(phone);
create index if not exists idx_leads_status on public.leads(status);
create index if not exists idx_leads_assigned on public.leads(assigned_to);
create index if not exists idx_deals_client on public.deals(client_id);
create index if not exists idx_deals_property on public.deals(property_id);
create index if not exists idx_deals_status on public.deals(status);
create index if not exists idx_deals_manager on public.deals(manager_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

alter table public.users enable row level security;
alter table public.clients enable row level security;
alter table public.owners enable row level security;
alter table public.properties enable row level security;
alter table public.contracts enable row level security;
alter table public.files enable row level security;
alter table public.leads enable row level security;
alter table public.tasks enable row level security;
alter table public.payments enable row level security;
alter table public.logs enable row level security;
alter table public.document_templates enable row level security;
alter table public.contract_versions enable row level security;

-- USERS policies
create policy "Users can view own profile" on public.users
  for select using (id = auth.uid());

create policy "Admins can view all users" on public.users
  for select using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

create policy "Users can update own profile" on public.users
  for update using (id = auth.uid());

-- CLIENTS policies
create policy "Authenticated users can view clients" on public.clients
  for select using (auth.uid() is not null);

create policy "Authenticated users can insert clients" on public.clients
  for insert with check (auth.uid() is not null);

create policy "Users can update clients" on public.clients
  for update using (auth.uid() is not null);

create policy "Admins can delete clients" on public.clients
  for delete using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

-- OWNERS policies
create policy "Authenticated users can manage owners" on public.owners
  for all using (auth.uid() is not null);

-- PROPERTIES policies
create policy "Authenticated users can view properties" on public.properties
  for select using (auth.uid() is not null);

create policy "Authenticated users can insert properties" on public.properties
  for insert with check (auth.uid() is not null);

create policy "Users can update properties" on public.properties
  for update using (auth.uid() is not null);

create policy "Admins can delete properties" on public.properties
  for delete using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

-- CONTRACTS policies
create policy "Authenticated users can view contracts" on public.contracts
  for select using (auth.uid() is not null);

create policy "Authenticated users can manage contracts" on public.contracts
  for all using (auth.uid() is not null);

-- FILES policies
create policy "Authenticated users can manage files" on public.files
  for all using (auth.uid() is not null);

-- LEADS policies
create policy "Authenticated users can view leads" on public.leads
  for select using (auth.uid() is not null);

create policy "Authenticated users can insert leads" on public.leads
  for insert with check (auth.uid() is not null);

create policy "Authenticated users can update leads" on public.leads
  for update using (auth.uid() is not null);

create policy "Admins can delete leads" on public.leads
  for delete using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

-- DEALS policies
create policy "Authenticated users can view deals" on public.deals
  for select using (auth.uid() is not null);

create policy "Authenticated users can insert deals" on public.deals
  for insert with check (auth.uid() is not null);

create policy "Authenticated users can update deals" on public.deals
  for update using (auth.uid() is not null);

create policy "Admins can delete deals" on public.deals
  for delete using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

-- TASKS policies
create policy "Authenticated users can view tasks" on public.tasks
  for select using (auth.uid() is not null);

create policy "Authenticated users can manage tasks" on public.tasks
  for all using (auth.uid() is not null);

-- PAYMENTS policies
create policy "Authenticated users can view payments" on public.payments
  for select using (auth.uid() is not null);

create policy "Authenticated users can manage payments" on public.payments
  for all using (auth.uid() is not null);

-- LOGS policies
create policy "Authenticated users can view logs" on public.logs
  for select using (auth.uid() is not null);

create policy "System can insert logs" on public.logs
  for insert with check (auth.uid() is not null);

-- DOCUMENT TEMPLATES policies
create policy "Authenticated users can view templates" on public.document_templates
  for select using (auth.uid() is not null);

create policy "Admins can manage templates" on public.document_templates
  for all using (
    exists (select 1 from public.users where id = auth.uid() and role in ('admin', 'manager'))
  );

-- CONTRACT VERSIONS policies
create policy "Authenticated users can view contract versions" on public.contract_versions
  for select using (auth.uid() is not null);

create policy "Authenticated users can insert contract versions" on public.contract_versions
  for insert with check (auth.uid() is not null);

-- ============================================================
-- STORAGE BUCKETS (выполни после создания бакетов в UI)
-- ============================================================

-- В Supabase Dashboard → Storage создай бакеты:
-- contracts    (private)
-- property-photos (public)
-- documents    (private)
-- document-templates (private)
-- passports    (private)
-- avatars      (public)
