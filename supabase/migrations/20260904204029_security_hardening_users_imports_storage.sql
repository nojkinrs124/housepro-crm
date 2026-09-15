-- ─────────────────────────────────────────────────────────────────────────────
-- Аудит безопасности 05.09.2026. Закрываются дыры, найденные проверкой боевой
-- базы живыми запросами (anon-ключ + ACL функций + политики storage).
-- Данные не удаляются: только гранты, политики и триггер.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Импортные функции были исполнимы ролями anon и authenticated.
--
-- Миграция 20260905 revoke'ила их «from public», но Supabase выдаёт EXECUTE
-- ролям anon/authenticated ЯВНО (alter default privileges), и revoke с PUBLIC
-- эти прямые гранты не снимает. Проверено запросом с боевым anon-ключом:
-- POST /rest/v1/rpc/import_client_request доходил до тела функции. То есть
-- любой человек из интернета мог писать контакты, лиды и объекты (включая
-- паспортные поля) в любую организацию, зная только её UUID.
-- Обе функции вызываются исключительно service-role клиентом
-- (src/app/api/v1/import/*, src/lib/telegram/tools.ts) — забирать безопасно.
revoke execute on function public.import_client_request(uuid, jsonb, jsonb) from anon, authenticated;
revoke execute on function public.import_property_extract(uuid, jsonb, jsonb) from anon, authenticated;

-- 2. public.users: чтение всех профилей всеми и самоповышение прав.
--
-- Было: SELECT USING (auth.uid() is not null) — любой авторизованный видел
-- сотрудников всех организаций; UPDATE USING (id = auth.uid()) без WITH CHECK и
-- без колоночных грантов — сотрудник мог одним PATCH'ем к PostgREST поставить
-- себе role = 'admin' (вся модель прав в src/lib/permissions.ts читает эту
-- колонку); INSERT WITH CHECK (true) — строка в users создавалась кем угодно.

create or replace function public.is_org_admin()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from organization_members m
    where m.user_id = auth.uid() and m.is_active and m.role = 'admin'
  )
$$;

revoke execute on function public.is_org_admin() from public, anon;

drop policy if exists "Auth users can view all profiles" on public.users;
create policy "org members can view profiles"
  on public.users for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1 from organization_members m
      where m.user_id = users.id and m.organization_id = get_user_org_id()
    )
  );

-- Строку в users создаёт только триггер handle_new_user (SECURITY DEFINER,
-- владелец postgres — RLS его не касается) и приглашение сотрудника через
-- service-role. Политика для роли public здесь не нужна вовсе.
drop policy if exists "System can insert users" on public.users;

-- Свой профиль правит сам, чужой в своей организации — админ организации.
-- Ограничение на служебные поля навешано триггером ниже: WITH CHECK не видит
-- OLD и отличить «сменил имя» от «сменил себе роль» не может.
drop policy if exists "Users can update own profile" on public.users;
create policy "profile update"
  on public.users for update to authenticated
  using (
    id = auth.uid()
    or (
      is_org_admin()
      and exists (
        select 1 from organization_members m
        where m.user_id = users.id and m.organization_id = get_user_org_id()
      )
    )
  );

create or replace function public.users_guard_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  -- Серверный код на service_role (приглашение сотрудника, миграции) и админ
  -- организации меняют служебные поля законно.
  if coalesce(auth.role(), '') = 'service_role' then return new; end if;
  if is_org_admin() then return new; end if;

  if new.role               is distinct from old.role
     or new.is_active       is distinct from old.is_active
     or new.organization_id is distinct from old.organization_id
     or new.email           is distinct from old.email
     or new.id              is distinct from old.id then
    raise exception 'Роль, доступ и организацию сотрудника меняет только администратор организации';
  end if;

  return new;
end;
$$;

drop trigger if exists users_guard_privileged_columns on public.users;
create trigger users_guard_privileged_columns
  before update on public.users
  for each row execute function public.users_guard_privileged_columns();

-- Создание и удаление профилей — только серверным кодом.
revoke insert, delete on public.users from anon, authenticated;
revoke select, update on public.users from anon;

-- 3. Хранилище: политики не различали организации вовсе.
--
-- Каждая была вида «bucket_id = X AND auth.uid() IS NOT NULL», то есть любой
-- авторизованный пользователь читал договоры и шаблоны всех организаций и мог
-- их удалить. Путь в бакете несёт идентификатор сущности — по нему и
-- проверяем организацию. Сравнение идёт id::text = сегмент пути, а не
-- сегмент::uuid: мусорное имя файла тогда просто не совпадает, а не роняет
-- политику ошибкой приведения типа.

-- contracts: contracts/<contract_id>/vN/contract.docx
drop policy if exists "Auth users can read contracts" on storage.objects;
drop policy if exists "Auth users can upload contracts" on storage.objects;

create policy "org members read contracts"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'contracts'
    and exists (
      select 1 from public.contracts c
      where c.id::text = (storage.foldername(name))[2]
        and c.organization_id = public.get_user_org_id()
    )
  );

create policy "org members write contracts"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'contracts'
    and exists (
      select 1 from public.contracts c
      where c.id::text = (storage.foldername(name))[2]
        and c.organization_id = public.get_user_org_id()
    )
  );

-- document-templates: templates/<user_id>/<файл>.docx
drop policy if exists "Auth users can read templates" on storage.objects;
drop policy if exists "Auth users can upload templates" on storage.objects;
drop policy if exists "Authenticated users can read templates" on storage.objects;
drop policy if exists "Authenticated users can upload templates" on storage.objects;
drop policy if exists "Authenticated users can delete templates" on storage.objects;

create policy "org members read templates"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'document-templates'
    and exists (
      select 1 from public.organization_members m
      where m.user_id::text = (storage.foldername(name))[2]
        and m.organization_id = public.get_user_org_id()
    )
  );

create policy "org members write templates"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'document-templates'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy "org members delete templates"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'document-templates'
    and exists (
      select 1 from public.organization_members m
      where m.user_id::text = (storage.foldername(name))[2]
        and m.organization_id = public.get_user_org_id()
    )
  );

-- property-photos: <property_id>/<файл>. Бакет публичный на чтение осознанно —
-- ссылки на фото стоят в объявлениях; закрываем запись и удаление.
drop policy if exists "Auth users can upload property photos" on storage.objects;
drop policy if exists "Auth users can delete property photos" on storage.objects;

create policy "org members upload property photos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'property-photos'
    and exists (
      select 1 from public.properties p
      where p.id::text = (storage.foldername(name))[1]
        and p.organization_id = public.get_user_org_id()
    )
  );

create policy "org members delete property photos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'property-photos'
    and exists (
      select 1 from public.properties p
      where p.id::text = (storage.foldername(name))[1]
        and p.organization_id = public.get_user_org_id()
    )
  );

-- files: единственный, кто в него пишет — src/lib/telegram/channel-image.ts на
-- service_role (картинки постов канала). Приложению доступ туда не нужен, а
-- политики позволяли любому авторизованному залить и удалить что угодно.
drop policy if exists "Authenticated users can upload files" on storage.objects;
drop policy if exists "Authenticated users can view files" on storage.objects;
drop policy if exists "Authenticated users can delete files" on storage.objects;

-- 4. Advisor function_search_path_mutable: триггерная функция без search_path.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  new.updated_at = now();
  return new;
end $$;
