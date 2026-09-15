-- Направления работы вместо одной универсальной воронки.
--
-- Все типы сделок ехали по одним шести стадиям (new → showing → negotiation →
-- contract → payment → completed), которые не описывали толком ни один процесс:
-- в аренде между «Новой» и «Показом» умещалось пять реальных шагов, а при
-- подборе для арендатора договор подписывается ДО поиска, тогда как воронка
-- ставила его предпоследним.
--
-- Теперь deals.deal_type хранит направление, а deals.status — стадию воронки
-- этого направления.
--
-- Порядок внутри файла строгий: сначала снять старые CHECK, потом перенести
-- значения, и только потом поставить новые. Обратный порядок падает на
-- существующих строках.

-- ── 1. Снять старые ограничения ──
alter table public.deals drop constraint if exists deals_deal_type_check;
alter table public.deals drop constraint if exists deals_status_check;

-- ── 2. Новые колонки ──
-- Отметки чек-листов стадий: {"<код стадии>": ["<код пункта>", ...]}
alter table public.deals add column if not exists "stage_progress" jsonb not null default '{}'::jsonb;
-- Направление не удалось определить автоматически — запись ждёт ручного разбора.
alter table public.deals add column if not exists "needs_review" boolean not null default false;
alter table public.deals add column if not exists "plan_id" uuid references public.service_plans(id) on delete set null;

-- ── 3. Перенос направлений ──
-- Коммерция перестала быть направлением: это тип объекта (офис, склад,
-- торговое помещение), и коммерческий объект идёт по обычной аренде или продаже.
-- Субаренда перестала быть направлением: это управление со схемой расчёта
-- «фиксированная выплата собственнику».
update public.deals d set deal_type = case d.deal_type
  when 'rent'    then 'rent_agent'
  when 'subrent' then 'management'
  when 'sale'    then 'sale'
  when 'management' then 'management'
  when 'commercial' then coalesce(
    (select case when p.deal_type = 'sale' then 'sale' else 'rent_agent' end
       from public.properties p where p.id = d.property_id),
    'rent_agent')
  else d.deal_type
end
where d.deal_type in ('rent', 'subrent', 'sale', 'management', 'commercial');

-- Коммерческая сделка без объекта: направление выбрано по умолчанию, значит
-- решение принято не по данным — такую запись разбирают руками.
update public.deals set needs_review = true
where property_id is null and deal_type = 'rent_agent' and status <> 'cancelled'
  and deal_number is null;

-- ── 4. Перенос стадий ──
-- Завершённая работа получает терминальную стадию своего направления,
-- отменённая остаётся отменённой. Всё, что было в середине старой воронки,
-- ставится на первую стадию и помечается на ручной разбор: угадывать позицию
-- в чужой воронке нельзя, а терять работу — тем более.
update public.deals set
  status = case
    when status = 'cancelled' then 'cancelled'
    when status = 'completed' and deal_type = 'management' then 'in_service'
    when status = 'completed' then 'completed'
    when deal_type = 'tenant_search' then 'inquiry'
    else 'sourcing'
  end,
  needs_review = needs_review or status in ('showing', 'negotiation', 'contract', 'payment')
where status in ('new', 'showing', 'negotiation', 'contract', 'payment', 'completed', 'cancelled');

-- ── 5. Новые ограничения ──
alter table public.deals add constraint deals_deal_type_check
  check (deal_type = any (array[
    'rent_agent'::text,
    'management'::text,
    'sale'::text,
    'tenant_search'::text
  ]));

-- Объединение стадий всех четырёх направлений. Принадлежность стадии
-- направлению проверяет Server Action по src/features/directions/config/directions.ts:
-- составной CHECK «если направление X, то стадия из Y» разрастается до
-- нечитаемого выражения и не умеет объяснить пользователю причину отказа,
-- а FR-003 требует именно объяснения.
-- Расхождение словаря в коде с этим списком стережёт scripts/checks/stage-dictionary.mjs:
-- когда такое разошлось у статусов лидов, смена статуса падала PATCH 400,
-- а интерфейс ошибку проглатывал.
alter table public.deals add constraint deals_status_check
  check (status = any (array[
    'sourcing'::text, 'inquiry'::text,
    'meeting'::text, 'valuation'::text,
    'agency_contract'::text, 'mgmt_contract'::text, 'search_contract'::text,
    'handover'::text, 'docs_check'::text,
    'preparation'::text, 'searching'::text,
    'showings'::text, 'collection_sent'::text, 'viewings'::text,
    'tenant_check'::text, 'preliminary'::text,
    'move_in'::text, 'main_contract'::text, 'rent_contract'::text,
    'registration'::text,
    'in_service'::text, 'completed'::text, 'cancelled'::text
  ]));

create index if not exists idx_deals_direction_stage
  on public.deals (organization_id, deal_type, status);

create index if not exists idx_deals_needs_review
  on public.deals (organization_id) where needs_review;
