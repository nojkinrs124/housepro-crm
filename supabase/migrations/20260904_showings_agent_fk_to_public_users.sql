-- Агент показа: связь вела в auth.users, а не в public.users.
--
-- Из-за этого встроенная выборка `agent:users!showings_agent_id_fkey(...)` на
-- карточке показа не разрешалась: PostgREST ищет связь с `public.users`, а
-- одноимённый внешний ключ указывал в схему `auth`, наружу не выставленную.
-- Блок «Агент» на карточке из-за этого не работал.
--
-- Во всех остальных таблицах колонки «кто» ссылаются на public.users
-- (tasks.assigned_to, deals.manager_id, properties.manager_id,
-- accounting_transactions.employee_id) — showings был единственным исключением.
--
-- Осиротевших значений нет (проверено перед применением), пересоздание
-- ограничения данные не трогает.
alter table public.showings drop constraint if exists showings_agent_id_fkey;

alter table public.showings
  add constraint showings_agent_id_fkey
  foreign key (agent_id) references public.users(id) on delete set null;

alter table public.showings drop constraint if exists showings_created_by_fkey;

alter table public.showings
  add constraint showings_created_by_fkey
  foreign key (created_by) references public.users(id) on delete set null;
