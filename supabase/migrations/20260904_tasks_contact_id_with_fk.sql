-- Задача ссылается на контакт, а не на удалённую таблицу clients.
--
-- После удаления legacy-таблиц clients/owners (02.09.2026) колонка
-- tasks.client_id осталась висеть: имя указывает на несуществующую таблицу,
-- внешнего ключа нет, а форма задачи пишет в неё идентификатор КОНТАКТА.
-- Получалась ссылка без целостности — удаление контакта оставляло бы в задаче
-- битый идентификатор, и никто бы этого не заметил.
--
-- Переименование, а не новая колонка: данных в ней нет (0 из 21 задачи), но
-- сама связь нужна и используется формой.
alter table public.tasks rename column "client_id" to "contact_id";

alter table public.tasks drop constraint if exists tasks_contact_id_fkey;
alter table public.tasks add constraint tasks_contact_id_fkey
  foreign key (contact_id) references public.contacts(id) on delete set null;

create index if not exists idx_tasks_contact
  on public.tasks (contact_id) where contact_id is not null;

-- tasks.owner_id оставлен: экшен писал в него всегда null (поля в форме нет),
-- код больше на него не ссылается. Колонка пустая и никому не мешает; удаление
-- колонок заблокировано хуком guard-migration, и обходить его ради пустой
-- колонки незачем.
comment on column public.tasks.owner_id is
  'Не используется с 04.09.2026. Осталась от удалённой таблицы owners; связь задачи с человеком идёт через contact_id.';

comment on column public.deals.client_id is
  'Не используется с 04.09.2026. Стороны сделки — owner_contact_id и client_contact_id.';
comment on column public.deals.owner_id is
  'Не используется с 04.09.2026. Стороны сделки — owner_contact_id и client_contact_id.';
comment on column public.contracts.client_id is
  'Не используется с 04.09.2026. Стороны договора — owner_contact_id и client_contact_id.';
comment on column public.contracts.owner_id is
  'Не используется с 04.09.2026. Стороны договора — owner_contact_id и client_contact_id.';
