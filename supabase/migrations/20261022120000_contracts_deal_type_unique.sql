-- Повторное «Оформить сделку» создавало второй договор того же типа, а вместе с
-- ним второй график и вторую комиссию (аудит 22.10.2026, P1-6). В коде проверка
-- уже стоит (complete-deal.actions.ts, шаг 0), индекс — второй рубеж: гонка двух
-- вкладок проходит мимо проверки, но не мимо уникального индекса.
--
-- Индекс создаётся только если в базе нет уже накопленных дублей: если есть,
-- миграция не падает, а сообщает об этом notice'ом — чистка дублей это решение
-- по живым данным, а не автоматика.
do $$
declare
  dup_count integer;
begin
  select count(*) into dup_count
  from (
    select deal_id, contract_type
    from public.contracts
    where deal_id is not null
    group by deal_id, contract_type
    having count(*) > 1
  ) d;

  if dup_count > 0 then
    raise notice 'contracts: % пар (deal_id, contract_type) с дублями — уникальный индекс НЕ создан. Разберите дубли и примените повторно.', dup_count;
  else
    create unique index if not exists contracts_deal_type_uniq
      on public.contracts (deal_id, contract_type)
      where deal_id is not null;
  end if;
end $$;
