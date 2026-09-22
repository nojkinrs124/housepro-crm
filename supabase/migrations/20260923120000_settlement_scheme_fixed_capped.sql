-- Третья схема расчёта с собственником: «фиксированная выплата по факту
-- поступлений» (тариф «Фиксированный с процентом» в справочнике).
--
-- Отличие от уже существующих:
--   percent      — агентство удерживает процент от платежа. Риск простоя на собственнике.
--   fixed        — агентство платит фикс. сумму по календарю, даже если аренда не оплачена.
--                  Риск простоя на агентстве.
--   fixed_capped — агентство платит фикс. сумму, но не больше, чем реально поступило от
--                  арендатора. Пустой месяц собственнику не платится, агентство при этом
--                  тоже ничего не теряет — из своих денег не доплачивает. Всё, что поступило
--                  сверх фиксированной суммы, — доход агентства.
--
-- Ставка (rate) при этой схеме не участвует в расчёте — она есть у тарифа только
-- для справки в справочнике услуг.

alter table public.contracts drop constraint if exists contracts_settlement_scheme_check;
alter table public.contracts add constraint contracts_settlement_scheme_check
  check (settlement_scheme is null or settlement_scheme = any (array['percent'::text, 'fixed'::text, 'fixed_capped'::text]));

alter table public.contracts drop constraint if exists contracts_scheme_fields_check;
alter table public.contracts add constraint contracts_scheme_fields_check
  check (
    settlement_scheme is null
    or (settlement_scheme = 'percent' and owner_fixed_amount is null and owner_payout_day is null)
    or (settlement_scheme in ('fixed', 'fixed_capped') and owner_fixed_amount is not null and owner_payout_day is not null)
  );

alter table public.management_engagements drop constraint if exists management_engagements_scheme_check;
alter table public.management_engagements add constraint management_engagements_scheme_check check (
  settlement_scheme is null or settlement_scheme = any (array['percent'::text, 'fixed'::text, 'fixed_capped'::text])
);

alter table public.management_engagements drop constraint if exists management_engagements_scheme_fields_check;
alter table public.management_engagements add constraint management_engagements_scheme_fields_check check (
  settlement_scheme is null
  or (settlement_scheme = 'percent' and owner_fixed_amount is null and owner_payout_day is null)
  or (settlement_scheme in ('fixed', 'fixed_capped') and owner_fixed_amount is not null and owner_payout_day is not null)
);

-- Тариф справочника, который на практике заводится с этой схемой. Как и у
-- остальных стартовых тарифов, заводится каждой организации; повторный прогон
-- ничего не дублирует.
insert into public.service_plans
  (organization_id, code, title, charge_type, rate, repair_limit, obligations, directions, sort_order)
select o.id, v.code, v.title, v.charge_type, v.rate, v.repair_limit, v.obligations::jsonb, v.directions, v.sort_order
from public.organizations o
cross join (values
  ('management_fixed_percent', 'Фиксированный с процентом', 'owner_fixed', null::numeric, 5000::numeric,
   '[{"code":"tenant_change","title":"Смена арендаторов"},{"code":"inspection","title":"Проверки квартиры"},{"code":"cleaning","title":"Уборка"},{"code":"repair","title":"Мелкий ремонт до 5000 ₽"},{"code":"reporting","title":"Отчётность собственнику"},{"code":"issues","title":"Решение проблем"}]',
   array['management'], 25)
) as v(code, title, charge_type, rate, repair_limit, obligations, directions, sort_order)
on conflict (organization_id, code) do nothing;
