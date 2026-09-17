-- ═══════════════════════════════════════════════════════════════════════════
-- Telegram-бот: сценарий «Занести в CRM» и починка импорта из документов.
--
-- Что было (аудит 17.09.2026):
--   1) import_rental_contract писал в deals `deal_type = 'rent'` и
--      `status = 'contract'` — оба значения запрещены CHECK с миграции воронок
--      03.09.2026, функция падала на любом договоре;
--   2) три функции импорта ставили источник `telegram_document` (нет ни в одном
--      справочнике), `api` или NULL — в аналитике источников бот был невидим;
--   3) лид из документа создавался без `contact_id`, хотя колонка есть с 17.09;
--   4) дедупликация в import_rental_contract — по сырой строке телефона,
--      по паспорту не искал никто;
--   5) форма лида с 17.09 предлагает «Сдать» (`let`) и «Продать» (`sell`),
--      а CHECK на leads.deal_type их не пропускал — создание лида-собственника
--      в CRM падало.
--
-- Что стало: одна функция import_intake(kind, payload) на все четыре сценария
-- (арендатор, собственник, объект, договор) с общим upsert контакта по
-- нормализованному телефону ИЛИ серии+номеру паспорта; старые три функции —
-- тонкие обёртки над ней (публичный API /api/v1/import/* остаётся).
-- Сессии сбора документов и дедупликация update_id — в двух новых таблицах.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Словарь «чего хочет лид» — как в CRM-форме ─────────────────────────
alter table public.leads drop constraint if exists leads_deal_type_check;
alter table public.leads add constraint leads_deal_type_check
  check (deal_type = any (array[
    'rent'::text, 'sale'::text, 'let'::text, 'sell'::text,
    'subrent'::text, 'management'::text, 'commercial'::text
  ]));

-- Дефолты deals не совпадали с CHECK ('new'/'rent') — insert без явных значений
-- падал бы. Значения по умолчанию — первая стадия самого частого направления.
alter table public.deals alter column deal_type set default 'rent_agent';
alter table public.deals alter column status set default 'sourcing';

-- ─── 2. Бэкфилл источников бота ─────────────────────────────────────────────
update public.contacts set source = 'telegram' where source = 'telegram_document';
update public.leads    set source = 'telegram' where source in ('telegram_document', 'api');

-- ─── 3. Сессии сбора документов ─────────────────────────────────────────────
-- Одна активная сессия на пользователя бота: пока она открыта, фото/документы/
-- текст копятся сюда без вызова модели; модель вызывается один раз по «Готово».
create table if not exists public.bot_intake_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  telegram_chat_id text not null,
  telegram_user_id text not null,
  kind text not null default 'unknown'
    check (kind in ('unknown', 'tenant', 'owner', 'property', 'contract', 'receipt')),
  status text not null default 'collecting'
    check (status in ('collecting', 'extracting', 'extracted', 'done', 'cancelled', 'expired')),
  -- [{ path, mime, name, source: 'photo' | 'document', media_group_id? }]
  files jsonb not null default '[]'::jsonb,
  -- Подписи и текстовые сообщения, присланные в сессию (телефон, «снять 2к до 40»).
  notes text[] not null default '{}',
  -- Последний результат извлечения — то, что показано в карточке подтверждения.
  extracted jsonb,
  -- Сообщение-статус («📎 Принял: …» с кнопками), которое бот перерисовывает.
  status_message_id bigint,
  result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '3 hours')
);

create index if not exists idx_bot_intake_sessions_org on public.bot_intake_sessions(organization_id);
-- Ровно одна открытая сессия на пользователя: две страницы паспорта из одного
-- альбома приходят параллельными update и обе пытаются завести сессию.
create unique index if not exists uq_bot_intake_sessions_active
  on public.bot_intake_sessions(telegram_user_id)
  where status in ('collecting', 'extracting', 'extracted');

alter table public.bot_intake_sessions enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'bot_intake_sessions' and policyname = 'org_isolation') then
    create policy org_isolation on public.bot_intake_sessions
      for all to authenticated
      using (organization_id = public.get_user_org_id())
      with check (organization_id = public.get_user_org_id());
  end if;
end $$;

-- ─── 4. Дедупликация update от Telegram ─────────────────────────────────────
-- Telegram повторяет update, если не получил 200 за ~60 с; без этой таблицы
-- долгий ход модели заканчивался вторым таким же подтверждением.
create table if not exists public.bot_processed_updates (
  update_id bigint primary key,
  created_at timestamptz not null default now()
);
create index if not exists idx_bot_processed_updates_created on public.bot_processed_updates(created_at);
-- Только service role: политик нет намеренно.
alter table public.bot_processed_updates enable row level security;

-- ─── 5. Upsert контакта из документа ────────────────────────────────────────
-- Ищем живой контакт организации по нормализованному телефону, затем по
-- серии+номеру паспорта. Нашли — дополняем пустые поля (заполненное руками в
-- CRM не затираем) и расширяем роль до both, если она не совпала.
create or replace function public.intake_upsert_contact(
  p_org_id uuid, p_contact jsonb, p_role text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_id uuid;
  v_phone text;
  v_series text;
  v_number text;
  v_existed boolean := false;
  v_role text := case when p_role in ('client', 'owner', 'both') then p_role else 'client' end;
begin
  if coalesce(nullif(trim(p_contact->>'full_name'), ''), '') = '' then
    raise exception 'intake_upsert_contact: full_name обязателен';
  end if;

  v_phone  := nullif(trim(p_contact->>'phone'), '');
  v_series := nullif(regexp_replace(coalesce(p_contact->>'passport_series', ''), '\D', '', 'g'), '');
  v_number := nullif(regexp_replace(coalesce(p_contact->>'passport_number', ''), '\D', '', 'g'), '');

  if v_phone is not null and length(public.normalize_phone_digits(v_phone)) >= 10 then
    select id into v_id from public.contacts
    where organization_id = p_org_id and merged_into is null
      and public.normalize_phone_digits(phone) = public.normalize_phone_digits(v_phone)
    limit 1;
  end if;

  if v_id is null and v_series is not null and v_number is not null then
    select id into v_id from public.contacts
    where organization_id = p_org_id and merged_into is null
      and regexp_replace(coalesce(passport_series, ''), '\D', '', 'g') = v_series
      and regexp_replace(coalesce(passport_number, ''), '\D', '', 'g') = v_number
    limit 1;
  end if;

  if v_id is not null then
    v_existed := true;
    update public.contacts set
      phone                    = coalesce(phone, v_phone),
      email                    = coalesce(email, nullif(p_contact->>'email', '')),
      passport_series          = coalesce(passport_series, nullif(p_contact->>'passport_series', '')),
      passport_number          = coalesce(passport_number, nullif(p_contact->>'passport_number', '')),
      passport_issued_date     = coalesce(passport_issued_date, nullif(p_contact->>'passport_issued_date', '')::date),
      passport_issued_by       = coalesce(passport_issued_by, nullif(p_contact->>'passport_issued_by', '')),
      passport_department_code = coalesce(passport_department_code, nullif(p_contact->>'passport_department_code', '')),
      birth_date               = coalesce(birth_date, nullif(p_contact->>'birth_date', '')::date),
      country                  = coalesce(country, nullif(p_contact->>'country', '')),
      region                   = coalesce(region, nullif(p_contact->>'region', '')),
      city                     = coalesce(city, nullif(p_contact->>'city', '')),
      street                   = coalesce(street, nullif(p_contact->>'street', '')),
      house_number             = coalesce(house_number, nullif(p_contact->>'house_number', '')),
      building                 = coalesce(building, nullif(p_contact->>'building', '')),
      apartment                = coalesce(apartment, nullif(p_contact->>'apartment', '')),
      comment                  = coalesce(comment, nullif(p_contact->>'comment', '')),
      source                   = coalesce(source, 'telegram'),
      role                     = case when role = v_role or role = 'both' then role else 'both' end,
      updated_at               = now()
    where id = v_id;
  else
    insert into public.contacts (
      organization_id, full_name, phone, email, role, status, source, comment,
      passport_series, passport_number, passport_issued_date, passport_issued_by,
      passport_department_code, birth_date,
      country, region, city, street, house_number, building, apartment
    ) values (
      p_org_id, trim(p_contact->>'full_name'), v_phone, nullif(p_contact->>'email', ''),
      v_role, 'new', 'telegram', nullif(p_contact->>'comment', ''),
      nullif(p_contact->>'passport_series', ''), nullif(p_contact->>'passport_number', ''),
      nullif(p_contact->>'passport_issued_date', '')::date, nullif(p_contact->>'passport_issued_by', ''),
      nullif(p_contact->>'passport_department_code', ''), nullif(p_contact->>'birth_date', '')::date,
      nullif(p_contact->>'country', ''), nullif(p_contact->>'region', ''), nullif(p_contact->>'city', ''),
      nullif(p_contact->>'street', ''), nullif(p_contact->>'house_number', ''),
      nullif(p_contact->>'building', ''), nullif(p_contact->>'apartment', '')
    ) returning id into v_id;
  end if;

  return jsonb_build_object('id', v_id, 'existed', v_existed);
end;
$$;

-- ─── 6. Единый импорт ───────────────────────────────────────────────────────
-- p_kind: tenant | owner | property | contract.
-- p_payload: { contact, tenant, property, lead, deal, create_lead, create_deal }.
--   tenant   — contact (client) + лид + сделка «Подбор для арендатора» (inquiry)
--   owner    — contact (owner) [+ объект] + лид (let/sell) + сделка направления
--              deal.direction (по умолчанию rent_agent), стадия sourcing
--   property — объект (дедуп по кадастровому номеру) [+ правообладатель]
--   contract — contact (owner) + tenant (client) + объект (rented) + сделка
--              rent_agent на стадии «Проверка и договор найма»
-- Всё в одной транзакции; источник у контактов, лида и сделки — 'telegram'.
create or replace function public.import_intake(
  p_org_id uuid, p_kind text, p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_contact jsonb := p_payload->'contact';
  v_tenant jsonb := p_payload->'tenant';
  v_property jsonb := p_payload->'property';
  v_lead jsonb := coalesce(p_payload->'lead', '{}'::jsonb);
  v_deal jsonb := coalesce(p_payload->'deal', '{}'::jsonb);
  v_create_lead boolean := coalesce((p_payload->>'create_lead')::boolean, p_kind in ('tenant', 'owner'));
  v_create_deal boolean := coalesce((p_payload->>'create_deal')::boolean, p_kind in ('tenant', 'owner', 'contract'));
  v_contact_role text;
  v_contact_res jsonb;
  v_tenant_res jsonb;
  v_contact_id uuid;
  v_tenant_id uuid;
  v_property_id uuid;
  v_property_existed boolean := false;
  v_cadastral text;
  v_lead_id uuid;
  v_deal_id uuid;
  v_direction text;
  v_stage text;
  v_property_deal_type text;
begin
  if p_kind not in ('tenant', 'owner', 'property', 'contract') then
    raise exception 'import_intake: неизвестный kind %', p_kind;
  end if;

  -- Направление сделки и стадия входа.
  v_direction := case
    when p_kind = 'tenant' then 'tenant_search'
    when p_kind = 'contract' then coalesce(nullif(v_deal->>'direction', ''), 'rent_agent')
    else coalesce(nullif(v_deal->>'direction', ''), 'rent_agent')
  end;
  if v_direction not in ('rent_agent', 'management', 'sale', 'tenant_search') then
    raise exception 'import_intake: неизвестное направление %', v_direction;
  end if;
  v_stage := coalesce(nullif(v_deal->>'status', ''), case
    when v_direction = 'tenant_search' then 'inquiry'
    when p_kind = 'contract' then 'tenant_check'
    else 'sourcing'
  end);

  -- Назначение объекта — из направления: у properties свой словарь.
  v_property_deal_type := coalesce(nullif(v_property->>'deal_type', ''), case
    when v_direction = 'management' then 'management'
    when v_direction = 'sale' then 'sale'
    else 'rent'
  end);

  -- ── Контакты ──
  v_contact_role := case when p_kind = 'tenant' then 'client' else 'owner' end;
  if v_contact is not null and coalesce(nullif(trim(v_contact->>'full_name'), ''), '') <> '' then
    v_contact_res := public.intake_upsert_contact(p_org_id, v_contact, coalesce(nullif(v_contact->>'role', ''), v_contact_role));
    v_contact_id := (v_contact_res->>'id')::uuid;
  elsif p_kind in ('tenant', 'owner', 'contract') then
    raise exception 'import_intake: не хватает ФИО %', case when p_kind = 'tenant' then 'арендатора' else 'собственника' end;
  end if;

  if p_kind = 'contract' then
    if v_tenant is null or coalesce(nullif(trim(v_tenant->>'full_name'), ''), '') = '' then
      raise exception 'import_intake: не хватает ФИО арендатора';
    end if;
    v_tenant_res := public.intake_upsert_contact(p_org_id, v_tenant, 'client');
    v_tenant_id := (v_tenant_res->>'id')::uuid;
  end if;

  -- ── Объект ──
  if v_property is not null and coalesce(nullif(trim(v_property->>'address'), ''), '') <> '' then
    v_cadastral := nullif(trim(v_property->>'cadastral_number'), '');
    if v_cadastral is not null then
      select id into v_property_id from public.properties
      where organization_id = p_org_id and cadastral_number = v_cadastral
      limit 1;
    end if;

    if v_property_id is not null then
      v_property_existed := true;
      update public.properties set
        area            = coalesce(area, nullif(v_property->>'area', '')::numeric),
        living_area     = coalesce(living_area, nullif(v_property->>'living_area', '')::numeric),
        land_area       = coalesce(land_area, nullif(v_property->>'land_area', '')::numeric),
        rooms           = coalesce(rooms, nullif(v_property->>'rooms', '')::int),
        floor           = coalesce(floor, nullif(v_property->>'floor', '')::int),
        total_floors    = coalesce(total_floors, nullif(v_property->>'total_floors', '')::int),
        year_built      = coalesce(year_built, nullif(v_property->>'year_built', '')::int),
        ownership_basis = coalesce(ownership_basis, nullif(v_property->>'ownership_basis', '')),
        encumbrances    = coalesce(encumbrances, nullif(v_property->>'encumbrances', '')),
        district        = coalesce(district, nullif(v_property->>'district', '')),
        description     = coalesce(description, nullif(v_property->>'description', '')),
        price           = coalesce(price, nullif(v_property->>'price', '')::numeric),
        deposit         = coalesce(deposit, nullif(v_property->>'deposit', '')::numeric),
        owner_id        = coalesce(owner_id, v_contact_id),
        updated_at      = timezone('utc', now())
      where id = v_property_id;
    else
      insert into public.properties (
        organization_id, title, property_type, deal_type, address, district,
        area, living_area, land_area, rooms, floor, total_floors, year_built,
        cadastral_number, ownership_basis, encumbrances, description,
        price, deposit, owner_id, status
      ) values (
        p_org_id,
        coalesce(nullif(trim(v_property->>'title'), ''), trim(v_property->>'address')),
        coalesce(nullif(v_property->>'property_type', ''), 'apartment'),
        v_property_deal_type,
        trim(v_property->>'address'), nullif(v_property->>'district', ''),
        nullif(v_property->>'area', '')::numeric, nullif(v_property->>'living_area', '')::numeric,
        nullif(v_property->>'land_area', '')::numeric, nullif(v_property->>'rooms', '')::int,
        nullif(v_property->>'floor', '')::int, nullif(v_property->>'total_floors', '')::int,
        nullif(v_property->>'year_built', '')::int,
        v_cadastral, nullif(v_property->>'ownership_basis', ''), nullif(v_property->>'encumbrances', ''),
        nullif(v_property->>'description', ''), nullif(v_property->>'price', '')::numeric,
        nullif(v_property->>'deposit', '')::numeric,
        v_contact_id,
        coalesce(nullif(v_property->>'status', ''), case when p_kind = 'contract' then 'rented' else 'available' end)
      ) returning id into v_property_id;
    end if;
  elsif p_kind in ('property', 'contract') then
    raise exception 'import_intake: не хватает адреса объекта';
  end if;

  -- ── Сделка ──
  if v_create_deal then
    insert into public.deals (
      organization_id, deal_type, status, property_id,
      owner_contact_id, client_contact_id, amount, notes, source, needs_review
    ) values (
      p_org_id, v_direction, v_stage, v_property_id,
      case when p_kind = 'tenant' then null else v_contact_id end,
      case when p_kind = 'tenant' then v_contact_id when p_kind = 'contract' then v_tenant_id else null end,
      nullif(v_deal->>'amount', '')::numeric, nullif(v_deal->>'notes', ''),
      'telegram', true
    ) returning id into v_deal_id;
  end if;

  -- ── Лид ──
  -- Лид — след первого обращения для аналитики. Когда сделка уже заведена,
  -- лид сразу «конвертирован», чтобы не висеть на доске второй копией клиента.
  if v_create_lead and v_contact_id is not null then
    insert into public.leads (
      organization_id, contact_id, full_name, phone, email, source, status,
      deal_type, property_type, district, rooms,
      budget_min, budget_max, area_min, area_max, comment, property_id
    ) values (
      p_org_id, v_contact_id,
      trim(v_contact->>'full_name'), nullif(trim(v_contact->>'phone'), ''), nullif(v_contact->>'email', ''),
      'telegram',
      case when v_deal_id is not null then 'converted' else 'new' end,
      coalesce(nullif(v_lead->>'deal_type', ''), case when p_kind = 'tenant' then 'rent' else 'let' end),
      nullif(v_lead->>'property_type', ''), nullif(v_lead->>'district', ''), nullif(v_lead->>'rooms', '')::int,
      nullif(v_lead->>'budget_min', '')::numeric, nullif(v_lead->>'budget_max', '')::numeric,
      nullif(v_lead->>'area_min', '')::numeric, nullif(v_lead->>'area_max', '')::numeric,
      nullif(v_lead->>'comment', ''), v_property_id
    ) returning id into v_lead_id;

    if v_deal_id is not null then
      update public.deals set lead_id = v_lead_id where id = v_deal_id;
    end if;
  end if;

  return jsonb_build_object(
    'contact_id', v_contact_id,
    'contact_existed', coalesce((v_contact_res->>'existed')::boolean, false),
    'tenant_id', v_tenant_id,
    'tenant_existed', coalesce((v_tenant_res->>'existed')::boolean, false),
    'property_id', v_property_id,
    'property_existed', v_property_existed,
    'lead_id', v_lead_id,
    'deal_id', v_deal_id,
    'direction', case when v_deal_id is not null then v_direction end,
    'stage', case when v_deal_id is not null then v_stage end
  );
end;
$$;

-- ─── 7. Старые функции — обёртки над import_intake ──────────────────────────
-- Публичный API /api/v1/import/* продолжает работать с прежними телами запросов.
create or replace function public.import_rental_contract(
  p_org_id uuid, p_owner jsonb, p_tenant jsonb, p_property jsonb, p_deal jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_res jsonb;
  v_direction text;
begin
  -- Внешние клиенты API присылают deal_type словарём объектов (rent/sale/…),
  -- а сделке нужно направление.
  v_direction := case coalesce(p_deal->>'deal_type', p_property->>'deal_type')
    when 'management' then 'management'
    when 'sale' then 'sale'
    else 'rent_agent'
  end;
  v_res := public.import_intake(p_org_id, 'contract', jsonb_build_object(
    'contact', p_owner,
    'tenant', p_tenant,
    'property', p_property,
    'deal', jsonb_build_object(
      'direction', v_direction,
      'status', nullif(p_deal->>'status', ''),
      'amount', p_deal->>'amount',
      'notes', p_deal->>'notes'
    )
  ));
  return jsonb_build_object(
    'owner_id', v_res->>'contact_id', 'tenant_id', v_res->>'tenant_id',
    'property_id', v_res->>'property_id', 'deal_id', v_res->>'deal_id'
  );
end;
$$;

create or replace function public.import_client_request(
  p_org_id uuid, p_contact jsonb, p_lead jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_res jsonb;
  v_kind text := case when p_contact->>'role' = 'owner' then 'owner' else 'tenant' end;
begin
  v_res := public.import_intake(p_org_id, v_kind, jsonb_build_object(
    'contact', p_contact, 'lead', coalesce(p_lead, '{}'::jsonb),
    'create_lead', true, 'create_deal', false
  ));
  return jsonb_build_object(
    'contact_id', v_res->>'contact_id',
    'contact_existed', (v_res->>'contact_existed')::boolean,
    'lead_id', v_res->>'lead_id'
  );
end;
$$;

create or replace function public.import_property_extract(
  p_org_id uuid, p_property jsonb, p_owner jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_res jsonb;
begin
  v_res := public.import_intake(p_org_id, 'property', jsonb_build_object(
    'property', p_property, 'contact', p_owner, 'create_lead', false, 'create_deal', false
  ));
  return jsonb_build_object(
    'property_id', v_res->>'property_id',
    'property_existed', (v_res->>'property_existed')::boolean,
    'owner_id', v_res->>'contact_id'
  );
end;
$$;

-- Все функции — только для service role (как и прежние import_*).
revoke execute on function public.intake_upsert_contact(uuid, jsonb, text) from public, anon, authenticated;
revoke execute on function public.import_intake(uuid, text, jsonb) from public, anon, authenticated;
revoke execute on function public.import_rental_contract(uuid, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.import_client_request(uuid, jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.import_property_extract(uuid, jsonb, jsonb) from public, anon, authenticated;
