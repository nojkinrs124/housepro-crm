-- Системные категории бухгалтерии для каждой организации — автоматически.
--
-- Расчёт с собственником (settlement.service.ts) ищет операции по кодам
-- tenant_payment / owner_payout / management_fee / agency_fee, а мастер
-- «Оформить» и форма операции ждут хотя бы одну категорию дохода. Миграция
-- 20260903162029 засеяла коды только организациям, существовавшим на тот
-- момент; новая организация оставалась с пустым справочником, и выплата
-- собственнику всегда считалась в ноль (сквозной проход 17.09.2026,
-- MG-8/AC-5/TS-7). Теперь набор создаётся триггером при создании организации
-- и досеивается всем существующим.

create or replace function public.seed_org_accounting_categories(p_org_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.accounting_categories (organization_id, name, type, code, is_system, color, icon, sort_order)
  select p_org_id, v.name, v.type, v.code, true, v.color, v.icon, v.sort_order
  from (values
    ('Комиссия агентства',    'income',  'agency_fee',     '#5C6659', 'Percent',      10),
    ('Арендный платёж',       'income',  'tenant_payment', '#6F8B6F', 'Home',         20),
    ('Управление объектом',   'income',  'management_fee', '#6F7C8B', 'Building2',    30),
    ('Депозит',               'income',  'deposit',        '#8B8A6F', 'Lock',         40),
    ('Прочие доходы',         'income',  'other_income',   '#8A8A8A', 'Plus',         90),
    ('Выплата собственнику',  'expense', 'owner_payout',   '#7C8B6F', 'ArrowUpRight', 100),
    ('Коммунальные услуги',   'expense', 'utilities',      '#6F8B8A', 'Droplets',     105),
    ('Мелкий ремонт',         'expense', 'repair_minor',   '#8A7B5A', 'Wrench',       110),
    ('Клининг',               'expense', 'cleaning',       '#6F8B8A', 'Sparkles',     120),
    ('Услуги подрядчиков',    'expense', 'contractor',     '#8B6F7C', 'HardHat',      130),
    ('Реклама и площадки',    'expense', 'advertising',    '#8B6F6F', 'Megaphone',    140),
    ('Прочие расходы',        'expense', 'other_expense',  '#8A8A8A', 'Minus',        190)
  ) as v(name, type, code, color, icon, sort_order)
  on conflict (organization_id, code) where code is not null do nothing;
$$;

comment on function public.seed_org_accounting_categories(uuid) is
  'Создаёт системные категории бухгалтерии (с кодами) для организации; повторный вызов ничего не дублирует.';

create or replace function public.trg_seed_org_accounting_categories()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_org_accounting_categories(new.id);
  return new;
end;
$$;

drop trigger if exists organizations_seed_categories on public.organizations;
create trigger organizations_seed_categories
  after insert on public.organizations
  for each row execute function public.trg_seed_org_accounting_categories();

-- Досев всем существующим организациям.
select public.seed_org_accounting_categories(o.id) from public.organizations o;
