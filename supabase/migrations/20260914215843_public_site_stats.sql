-- Живые цифры для страницы «О компании» публичного сайта.
--
-- Страница показывает «квартир в управлении» и «закрытых сделок». Аноним не
-- читает management_engagements и deals (и не должен: там адреса и люди),
-- поэтому наружу отдаём только два счётчика через security-definer функцию.
-- Никаких идентификаторов, никаких строк — числа и всё.
--
-- Организация — та же «первая», что использует приём заявок с сайта
-- (/api/public/leads): пока сайт один, мульти-тенант тут не нужен.
create or replace function public.public_site_stats()
returns table (objects_in_management integer, closed_deals integer)
language sql
stable
security definer
set search_path = public
as $$
  with org as (
    select id from public.organizations order by created_at asc limit 1
  )
  select
    (select count(*)::integer
       from public.management_engagements e, org
      where e.organization_id = org.id
        and e.status in ('onboarding', 'active', 'paused')) as objects_in_management,
    (select count(*)::integer
       from public.deals d, org
      where d.organization_id = org.id
        and d.status = 'completed') as closed_deals;
$$;

revoke all on function public.public_site_stats() from public;
grant execute on function public.public_site_stats() to anon, authenticated, service_role;

comment on function public.public_site_stats() is
  'Два счётчика для публичного сайта (страница «О компании»). Без персональных данных; читается anon.';
