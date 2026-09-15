-- Условия тарифа фиксируются в договоре на момент подписания.
--
-- plan_rate — копия ставки из справочника, а не ссылка на неё: правка тарифа
-- не должна переписывать расчёты по уже заключённым договорам (FR-007).
--
-- settlement_scheme — схема расчёта с собственником при управлении. Их две, и
-- выбирает собственник:
--   percent — агентство удерживает процент от платежа арендатора. Пустой месяц
--             не приносит денег ни собственнику, ни агентству. Риск на собственнике.
--   fixed   — агентство платит собственнику фиксированную сумму ежемесячно и
--             оставляет себе всё сверх неё. За пустой месяц платит из своих.
--             Риск на агентстве.
-- Раньше вторая схема жила отдельным типом сделки «субаренда». Это не отдельный
-- процесс, а способ расчёта внутри управления.

alter table public.contracts add column if not exists "plan_id" uuid references public.service_plans(id) on delete set null;
alter table public.contracts add column if not exists "plan_rate" numeric;
alter table public.contracts add column if not exists "settlement_scheme" text;
alter table public.contracts add column if not exists "owner_fixed_amount" numeric;
alter table public.contracts add column if not exists "owner_payout_day" integer;

alter table public.contracts drop constraint if exists contracts_settlement_scheme_check;
alter table public.contracts add constraint contracts_settlement_scheme_check
  check (settlement_scheme is null or settlement_scheme = any (array['percent'::text, 'fixed'::text]));

alter table public.contracts drop constraint if exists contracts_owner_payout_day_check;
alter table public.contracts add constraint contracts_owner_payout_day_check
  check (owner_payout_day is null or (owner_payout_day >= 1 and owner_payout_day <= 28));

-- Схема осмысленна только у договора управления. У остальных типов её быть не должно:
-- иначе появится второй, невидимый способ считать деньги.
alter table public.contracts drop constraint if exists contracts_scheme_only_for_management_check;
alter table public.contracts add constraint contracts_scheme_only_for_management_check
  check (settlement_scheme is null or contract_type = 'property_management');

-- Схема и её параметры должны быть согласованы. Фиксированная выплата без суммы
-- или без дня — это договор, по которому нельзя посчитать обязательство.
alter table public.contracts drop constraint if exists contracts_scheme_fields_check;
alter table public.contracts add constraint contracts_scheme_fields_check
  check (
    settlement_scheme is null
    or (settlement_scheme = 'percent' and owner_fixed_amount is null and owner_payout_day is null)
    or (settlement_scheme = 'fixed'   and owner_fixed_amount is not null and owner_payout_day is not null)
  );

-- Текущий арендатор объекта и история арендаторов запрашиваются постоянно:
-- отдельной сущности «наём» нет, ею служит договор найма (решение Р-3).
create index if not exists idx_contracts_property_period
  on public.contracts (property_id, start_date desc) where property_id is not null;
