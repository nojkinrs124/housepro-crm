-- Фид объектов для площадок раньше отдавался по адресу без всякой авторизации:
-- /api/export/cian возвращал опубликованные объекты всем (проверено на проде,
-- аудит 22.10.2026, P1-1). Колонки и RLS тут не спасают — нужен адрес, который
-- знает только владелец организации.
--
-- Токен на организацию, а не на площадку: у ЦИАН, Домклика и Яндекса адреса
-- фидов вбиваются в кабинеты руками и живут годами, поэтому ссылка должна быть
-- стабильной и одной на организацию. Робот площадки ходит без сессии — отсюда
-- отдельная таблица и чтение под service-role в роуте.

create table if not exists public.property_feed_tokens (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(16), 'hex'),
  created_at timestamptz not null default now()
);

alter table public.property_feed_tokens enable row level security;

-- Сотрудник видит токен своей организации (по нему строится ссылка в интерфейсе).
-- Вставлять и менять руками нельзя — только через ensure_property_feed_token().
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'property_feed_tokens'
      and policyname = 'Members can view their feed token'
  ) then
    create policy "Members can view their feed token"
      on public.property_feed_tokens for select to authenticated
      using (organization_id = get_user_org_id());
  end if;
end $$;

-- Токен существует ровно тогда, когда его впервые запросили из интерфейса:
-- организациям, которые фиды не отдают, лишняя запись не нужна.
create or replace function public.ensure_property_feed_token()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_token text;
begin
  v_org := get_user_org_id();
  if v_org is null then
    return null;
  end if;

  insert into public.property_feed_tokens (organization_id)
  values (v_org)
  on conflict (organization_id) do nothing;

  select token into v_token from public.property_feed_tokens where organization_id = v_org;
  return v_token;
end $$;

revoke execute on function public.ensure_property_feed_token() from anon;
grant execute on function public.ensure_property_feed_token() to authenticated;
