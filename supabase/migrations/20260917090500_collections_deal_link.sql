-- Подборка объектов привязывается к сделке подбора и помнит, когда была отправлена.
--
-- До этого подборка знала только лид (причём неконвертированный), и стадии
-- «Подборка отправлена» / «Просмотры» в подборе для арендатора нечем было
-- проверить по данным (сквозной проход 17.09.2026, TS-4).

alter table public.property_collections
  add column if not exists deal_id uuid references public.deals(id) on delete set null,
  add column if not exists sent_at timestamptz;

create index if not exists property_collections_deal_id_idx on public.property_collections(deal_id);

comment on column public.property_collections.deal_id is 'Сделка подбора, для которой собрана подборка.';
comment on column public.property_collections.sent_at is 'Когда подборку отправили клиенту (письмо или ссылка). NULL — ещё не отправляли.';

-- Бэкфилл: подборки лидов — к сделке подбора, созданной из того же лида.
update public.property_collections pc
set deal_id = d.id
from public.deals d
where pc.deal_id is null
  and pc.lead_id is not null
  and d.lead_id = pc.lead_id
  and d.deal_type = 'tenant_search';
