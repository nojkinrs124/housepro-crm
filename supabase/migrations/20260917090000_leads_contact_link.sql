-- Связь лид → контакт после конвертации.
--
-- До этого конвертация только меняла статус лида на converted, и с карточки
-- контакта было не понять, из какого лида он пришёл, а лид можно было
-- сконвертировать повторно и получить дубль (сквозной проход 17.09.2026,
-- L-9/L-10). Колонка nullable: у старых лидов связи нет и восстановить её
-- можно только по телефону — это делает бэкфилл ниже, где совпадение однозначно.

alter table public.leads
  add column if not exists contact_id uuid references public.contacts(id) on delete set null;

create index if not exists leads_contact_id_idx on public.leads(contact_id);

comment on column public.leads.contact_id is
  'Контакт, созданный или выбранный при конвертации лида. NULL — лид ещё не конвертирован.';

-- Бэкфилл: конвертированные лиды без связи — к единственному живому контакту
-- той же организации с тем же телефоном.
update public.leads l
set contact_id = c.id
from (
  select organization_id, phone, min(id::text)::uuid as id
  from public.contacts
  where merged_into is null and phone is not null
  group by organization_id, phone
  having count(*) = 1
) c
where l.contact_id is null
  and l.status = 'converted'
  and l.phone is not null
  and l.phone = c.phone
  and l.organization_id = c.organization_id;
