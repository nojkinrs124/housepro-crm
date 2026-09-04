-- ═══════════════════════════════════════════════════════════════════════════
-- Импорт из документов, присланных боту: заявка (контакт + лид) и выписка
-- ЕГРН / свидетельство о праве собственности (объект + правообладатель).
--
-- Зачем отдельные функции, а не два вызова create_contact/create_lead подряд:
--   1) одна транзакция — не бывает «контакт создался, лид нет»;
--   2) дедупликация по нормализованному телефону и по кадастровому номеру —
--      один и тот же документ, присланный дважды, не плодит карточки;
--   3) одно подтверждение в Telegram вместо двух.
-- Образец — import_rental_contract (baseline), но дедуп здесь честный:
-- normalize_phone_digits, а не сравнение сырой строки телефона.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Заявка от человека: контакт + лид ──────────────────────────────────────
create or replace function public.import_client_request(
  p_org_id uuid, p_contact jsonb, p_lead jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_contact_id uuid;
  v_lead_id uuid;
  v_phone text;
  v_existed boolean := false;
begin
  if coalesce(nullif(trim(p_contact->>'full_name'), ''), '') = '' then
    raise exception 'import_client_request: full_name обязателен';
  end if;

  v_phone := nullif(trim(p_contact->>'phone'), '');

  if v_phone is not null then
    select id into v_contact_id
    from public.contacts
    where organization_id = p_org_id
      and merged_into is null
      and public.normalize_phone_digits(phone) = public.normalize_phone_digits(v_phone)
    limit 1;
  end if;

  if v_contact_id is not null then
    v_existed := true;
    -- Дополняем пустые поля тем, что нашлось в документе. Заполненное не затираем:
    -- в CRM данные могли быть уточнены руками, документ — не источник истины.
    update public.contacts set
      email                    = coalesce(email, nullif(p_contact->>'email','')),
      passport_series          = coalesce(passport_series, nullif(p_contact->>'passport_series','')),
      passport_number          = coalesce(passport_number, nullif(p_contact->>'passport_number','')),
      passport_issued_date     = coalesce(passport_issued_date, nullif(p_contact->>'passport_issued_date','')::date),
      passport_issued_by       = coalesce(passport_issued_by, nullif(p_contact->>'passport_issued_by','')),
      passport_department_code = coalesce(passport_department_code, nullif(p_contact->>'passport_department_code','')),
      birth_date               = coalesce(birth_date, nullif(p_contact->>'birth_date','')::date),
      country                  = coalesce(country, nullif(p_contact->>'country','')),
      region                   = coalesce(region, nullif(p_contact->>'region','')),
      city                     = coalesce(city, nullif(p_contact->>'city','')),
      street                   = coalesce(street, nullif(p_contact->>'street','')),
      house_number             = coalesce(house_number, nullif(p_contact->>'house_number','')),
      building                 = coalesce(building, nullif(p_contact->>'building','')),
      apartment                = coalesce(apartment, nullif(p_contact->>'apartment','')),
      -- Собственник, пришедший как клиент, становится «both», а не переписывается в client.
      role                     = case when role = 'owner' then 'both' else role end,
      updated_at               = now()
    where id = v_contact_id;
  else
    insert into public.contacts (
      organization_id, full_name, phone, email, role, source,
      passport_series, passport_number, passport_issued_date, passport_issued_by,
      passport_department_code, birth_date,
      country, region, city, street, house_number, building, apartment
    )
    values (
      p_org_id, trim(p_contact->>'full_name'), v_phone, nullif(p_contact->>'email',''),
      coalesce(nullif(p_contact->>'role',''), 'client'),
      coalesce(nullif(p_contact->>'source',''), 'telegram_document'),
      nullif(p_contact->>'passport_series',''), nullif(p_contact->>'passport_number',''),
      nullif(p_contact->>'passport_issued_date','')::date, nullif(p_contact->>'passport_issued_by',''),
      nullif(p_contact->>'passport_department_code',''), nullif(p_contact->>'birth_date','')::date,
      nullif(p_contact->>'country',''), nullif(p_contact->>'region',''), nullif(p_contact->>'city',''),
      nullif(p_contact->>'street',''), nullif(p_contact->>'house_number',''),
      nullif(p_contact->>'building',''), nullif(p_contact->>'apartment','')
    )
    returning id into v_contact_id;
  end if;

  insert into public.leads (
    organization_id, full_name, phone, email, source, status,
    deal_type, property_type, district, rooms,
    budget_min, budget_max, area_min, area_max, comment
  )
  values (
    p_org_id,
    coalesce(nullif(p_lead->>'full_name',''), trim(p_contact->>'full_name')),
    coalesce(nullif(p_lead->>'phone',''), v_phone),
    coalesce(nullif(p_lead->>'email',''), nullif(p_contact->>'email','')),
    coalesce(nullif(p_lead->>'source',''), 'telegram_document'),
    coalesce(nullif(p_lead->>'status',''), 'new'),
    nullif(p_lead->>'deal_type',''), nullif(p_lead->>'property_type',''),
    nullif(p_lead->>'district',''), nullif(p_lead->>'rooms','')::int,
    nullif(p_lead->>'budget_min','')::numeric, nullif(p_lead->>'budget_max','')::numeric,
    nullif(p_lead->>'area_min','')::numeric, nullif(p_lead->>'area_max','')::numeric,
    nullif(p_lead->>'comment','')
  )
  returning id into v_lead_id;

  return jsonb_build_object(
    'contact_id', v_contact_id,
    'contact_existed', v_existed,
    'lead_id', v_lead_id
  );
end;
$$;

-- ─── Выписка ЕГРН / свидетельство: объект + правообладатель ─────────────────
create or replace function public.import_property_extract(
  p_org_id uuid, p_property jsonb, p_owner jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_owner_id uuid;
  v_property_id uuid;
  v_owner_phone text;
  v_cadastral text;
  v_property_existed boolean := false;
begin
  if coalesce(nullif(trim(p_property->>'address'), ''), '') = '' then
    raise exception 'import_property_extract: address обязателен';
  end if;

  -- Правообладатель — необязателен: в свидетельстве он есть всегда, в выписке
  -- об основных характеристиках раздела о правах может не быть вовсе.
  if p_owner is not null and coalesce(nullif(trim(p_owner->>'full_name'), ''), '') <> '' then
    v_owner_phone := nullif(trim(p_owner->>'phone'), '');
    if v_owner_phone is not null then
      select id into v_owner_id
      from public.contacts
      where organization_id = p_org_id
        and merged_into is null
        and public.normalize_phone_digits(phone) = public.normalize_phone_digits(v_owner_phone)
      limit 1;
    end if;

    if v_owner_id is not null then
      update public.contacts set
        role       = case when role = 'client' then 'both' else role end,
        updated_at = now()
      where id = v_owner_id;
    else
      insert into public.contacts (
        organization_id, full_name, phone, email, role, source,
        passport_series, passport_number, passport_issued_date, passport_issued_by,
        passport_department_code, birth_date
      )
      values (
        p_org_id, trim(p_owner->>'full_name'), v_owner_phone, nullif(p_owner->>'email',''),
        'owner', coalesce(nullif(p_owner->>'source',''), 'telegram_document'),
        nullif(p_owner->>'passport_series',''), nullif(p_owner->>'passport_number',''),
        nullif(p_owner->>'passport_issued_date','')::date, nullif(p_owner->>'passport_issued_by',''),
        nullif(p_owner->>'passport_department_code',''), nullif(p_owner->>'birth_date','')::date
      )
      returning id into v_owner_id;
    end if;
  end if;

  -- Кадастровый номер — естественный ключ объекта: одна и та же выписка,
  -- присланная дважды, не должна создавать вторую карточку.
  v_cadastral := nullif(trim(p_property->>'cadastral_number'), '');
  if v_cadastral is not null then
    select id into v_property_id
    from public.properties
    where organization_id = p_org_id and cadastral_number = v_cadastral
    limit 1;
  end if;

  if v_property_id is not null then
    v_property_existed := true;
    update public.properties set
      area            = coalesce(area, nullif(p_property->>'area','')::numeric),
      living_area     = coalesce(living_area, nullif(p_property->>'living_area','')::numeric),
      land_area       = coalesce(land_area, nullif(p_property->>'land_area','')::numeric),
      rooms           = coalesce(rooms, nullif(p_property->>'rooms','')::int),
      floor           = coalesce(floor, nullif(p_property->>'floor','')::int),
      total_floors    = coalesce(total_floors, nullif(p_property->>'total_floors','')::int),
      year_built      = coalesce(year_built, nullif(p_property->>'year_built','')::int),
      ownership_basis = coalesce(ownership_basis, nullif(p_property->>'ownership_basis','')),
      encumbrances    = coalesce(encumbrances, nullif(p_property->>'encumbrances','')),
      district        = coalesce(district, nullif(p_property->>'district','')),
      description     = coalesce(description, nullif(p_property->>'description','')),
      owner_id        = coalesce(owner_id, v_owner_id),
      updated_at      = timezone('utc', now())
    where id = v_property_id;
  else
    insert into public.properties (
      organization_id, title, property_type, deal_type, address, district,
      area, living_area, land_area, rooms, floor, total_floors, year_built,
      cadastral_number, ownership_basis, encumbrances, description,
      price, owner_id, status
    )
    values (
      p_org_id,
      coalesce(nullif(trim(p_property->>'title'), ''), trim(p_property->>'address')),
      coalesce(nullif(p_property->>'property_type',''), 'apartment'),
      -- В выписке ЕГРН нет ни аренды, ни продажи: это документ о праве, а не о
      -- намерении. 'sale' — рабочий дефолт, который агент меняет руками; своего
      -- значения «неизвестно» в CHECK на properties.deal_type нет.
      coalesce(nullif(p_property->>'deal_type',''), 'sale'),
      trim(p_property->>'address'), nullif(p_property->>'district',''),
      nullif(p_property->>'area','')::numeric, nullif(p_property->>'living_area','')::numeric,
      nullif(p_property->>'land_area','')::numeric, nullif(p_property->>'rooms','')::int,
      nullif(p_property->>'floor','')::int, nullif(p_property->>'total_floors','')::int,
      nullif(p_property->>'year_built','')::int,
      v_cadastral, nullif(p_property->>'ownership_basis',''), nullif(p_property->>'encumbrances',''),
      nullif(p_property->>'description',''), nullif(p_property->>'price','')::numeric,
      v_owner_id, coalesce(nullif(p_property->>'status',''), 'available')
    )
    returning id into v_property_id;
  end if;

  return jsonb_build_object(
    'property_id', v_property_id,
    'property_existed', v_property_existed,
    'owner_id', v_owner_id
  );
end;
$$;

-- Обе функции SECURITY DEFINER и вызываются только серверным кодом на
-- service_role (src/app/api/v1/import/*), как и import_rental_contract —
-- значит PUBLIC (а через него anon/authenticated) их выполнять не должен.
revoke execute on function public.import_client_request(uuid, jsonb, jsonb) from public;
revoke execute on function public.import_property_extract(uuid, jsonb, jsonb) from public;

-- Кадастровый номер ищем на каждом импорте выписки — без индекса это seq scan
-- по всем объектам организации.
create index if not exists idx_properties_cadastral_number
  on public.properties(organization_id, cadastral_number)
  where cadastral_number is not null;
