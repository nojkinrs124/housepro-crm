-- ═══════════════════════════════════════════════════════════════════════════
-- Дедупликация контактов + починка внешнего ключа собственника объекта
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Нормализованный телефон ─────────────────────────────────────────────
-- Один и тот же человек заводится трижды: «+7 999 123-45-67», «89991234567»,
-- «9991234567». Поиск дублей по сырой строке бесполезен, поэтому сравниваем
-- по цифрам, приведённым к формату 7XXXXXXXXXX.
--
-- Функция IMMUTABLE — обязательное требование для использования в индексе.
create or replace function public.normalize_phone_digits(phone text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when phone is null then null
    when regexp_replace(phone, '\D', '', 'g') = '' then null
    when length(regexp_replace(phone, '\D', '', 'g')) = 11
         and left(regexp_replace(phone, '\D', '', 'g'), 1) = '8'
      then '7' || substr(regexp_replace(phone, '\D', '', 'g'), 2)
    when length(regexp_replace(phone, '\D', '', 'g')) = 10
      then '7' || regexp_replace(phone, '\D', '', 'g')
    else regexp_replace(phone, '\D', '', 'g')
  end
$$;

-- Индексы НЕ уникальные намеренно: у агентства бывают законные «дубли»
-- (муж и жена на одном номере, юрлицо и его директор). Система показывает
-- совпадения и предлагает слить, но не запрещает их существование.
create index if not exists idx_contacts_phone_normalized
  on public.contacts(organization_id, public.normalize_phone_digits(phone))
  where phone is not null;

create index if not exists idx_leads_phone_normalized
  on public.leads(organization_id, public.normalize_phone_digits(phone))
  where phone is not null;

create index if not exists idx_contacts_email_lower
  on public.contacts(organization_id, lower(email))
  where email is not null;

-- Отметка о слиянии: карточка-дубль не удаляется, а помечается ссылкой на
-- основную. Так остаются рабочими старые ссылки из истории и аудита.
alter table public.contacts add column if not exists "merged_into" uuid references public.contacts(id);
create index if not exists idx_contacts_merged_into
  on public.contacts(merged_into) where merged_into is not null;

-- ─── 2. properties.owner_id → contacts ──────────────────────────────────────
-- Форма объекта выбирает собственника из contacts (см. properties/new/page.tsx),
-- а внешний ключ вёл на legacy-таблицу owners. Она пуста и в неё давно ничего
-- не пишется, поэтому любая попытка сохранить собственника у объекта падала бы
-- нарушением FK. Переставляем ключ на реальную таблицу.
do $$ begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.properties'::regclass and conname = 'properties_owner_id_fkey'
  ) then
    alter table public.properties drop constraint properties_owner_id_fkey;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.properties'::regclass and conname = 'properties_owner_contact_id_fkey'
  ) then
    alter table public.properties
      add constraint properties_owner_contact_id_fkey
      foreign key (owner_id) references public.contacts(id) on delete set null;
  end if;
end $$;

create index if not exists idx_properties_owner_id
  on public.properties(owner_id) where owner_id is not null;
