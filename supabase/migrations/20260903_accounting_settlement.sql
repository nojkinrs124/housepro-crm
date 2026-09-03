-- Взаиморасчёт с собственником на существующей бухгалтерии.
--
-- Отдельного реестра расчётов не заводится: accounting_transactions уже несёт
-- property_id, contract_id, contact_id, период, статусы, категории, банковский
-- импорт и напоминания о просрочке. Вторая бухгалтерия рядом с первой
-- потребовала бы их сводить между собой.

-- Объект в управлении, к которому относится операция. Через property_id это
-- тоже выводится, но обслуживание — самостоятельная сущность со своим периодом:
-- операции прошлого обслуживания того же объекта не должны попадать в текущее
-- сальдо.
alter table public.accounting_transactions
  add column if not exists "engagement_id" uuid references public.management_engagements(id) on delete set null;

-- За чей счёт расход. Ключевое поле взаиморасчёта: расход за счёт агентства
-- уменьшает его доход, за счёт собственника — уменьшает выплату ему.
alter table public.accounting_transactions
  add column if not exists "borne_by" text;

alter table public.accounting_transactions drop constraint if exists accounting_transactions_borne_by_check;
alter table public.accounting_transactions add constraint accounting_transactions_borne_by_check
  check (borne_by is null or borne_by = any (array['agency'::text, 'owner'::text]));

create index if not exists idx_accounting_transactions_engagement
  on public.accounting_transactions (engagement_id, date) where engagement_id is not null;

-- ── Стабильный код категории ──
-- Название категории пользователь правит, и искать по нему из кода — значит
-- сломать расчёт при первом же переименовании. Код неизменен.
alter table public.accounting_categories add column if not exists "code" text;

create unique index if not exists idx_accounting_categories_code
  on public.accounting_categories (organization_id, code) where code is not null;

-- Проставляем коды уже существующим категориям по названию: это единственный
-- момент, когда сопоставление по названию допустимо — дальше работает код.
update public.accounting_categories set code = 'tenant_payment', is_system = true
  where code is null and type = 'income' and name = 'Арендный платёж';
update public.accounting_categories set code = 'agency_fee', is_system = true
  where code is null and type = 'income' and name = 'Комиссия агента';
update public.accounting_categories set code = 'management_fee', is_system = true
  where code is null and type = 'income' and name = 'Управление объектом';
update public.accounting_categories set code = 'deposit', is_system = true
  where code is null and type = 'income' and name = 'Депозит';
update public.accounting_categories set code = 'utilities', is_system = true
  where code is null and type = 'expense' and name = 'Коммунальные услуги';

-- Недостающие системные категории взаиморасчёта. is_system не даёт удалить их
-- из интерфейса: на них ссылается расчёт.
insert into public.accounting_categories (organization_id, name, type, code, is_system, color, icon, sort_order)
select o.id, v.name, v.type, v.code, true, v.color, v.icon, v.sort_order
from public.organizations o
cross join (values
  ('Выплата собственнику', 'expense', 'owner_payout',   '#7C8B6F', 'ArrowUpRight', 100),
  ('Мелкий ремонт',        'expense', 'repair_minor',   '#8A7B5A', 'Wrench',       110),
  ('Клининг',              'expense', 'cleaning',       '#6F8B8A', 'Sparkles',     120),
  ('Услуги подрядчиков',   'expense', 'contractor',     '#8B6F7C', 'HardHat',      130)
) as v(name, type, code, color, icon, sort_order)
on conflict (organization_id, code) where code is not null do nothing;
