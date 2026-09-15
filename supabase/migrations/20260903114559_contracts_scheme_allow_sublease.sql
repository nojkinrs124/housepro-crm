-- Схема расчёта нужна и договору субаренды, а не только договору управления.
--
-- В миграции 20260903_contracts_plan_terms.sql схема была разрешена только у
-- property_management. Но по решению Р4 субаренда — это управление со схемой
-- «фиксированная выплата собственнику»: агентство платит собственнику
-- оговорённую сумму и оставляет себе разницу. Без этого поля договор субаренды
-- нельзя посчитать, и модель денег снова распадается на два несвязанных способа.

alter table public.contracts drop constraint if exists contracts_scheme_only_for_management_check;
alter table public.contracts add constraint contracts_scheme_only_for_management_check
  check (settlement_scheme is null or contract_type in ('property_management', 'sublease'));
