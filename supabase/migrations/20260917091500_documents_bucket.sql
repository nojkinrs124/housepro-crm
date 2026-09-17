-- Приватный бакет `documents` для вложений карточек (паспорта, сканы, договоры).
--
-- Код загрузки (src/features/files) писал в `documents`, которого не было —
-- блоки «Файлы» были скрыты (задача #35, сквозной проход 17.09.2026, FL-1).
-- Публичный `files` для этого не подходит: там лежат картинки телеграм-канала,
-- а сканы паспортов по публичной ссылке — утечка. Путь объекта:
--   documents/<organization_id>/<entity_id>/<timestamp>-<file>
-- Организация проверяется по первому сегменту пути, файлы отдаются по
-- подписанным ссылкам.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents', 'documents', false, 20971520,
  array[
    'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update set public = false;

drop policy if exists "org members read documents" on storage.objects;
drop policy if exists "org members write documents" on storage.objects;
drop policy if exists "org members delete documents" on storage.objects;

create policy "org members read documents"
  on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = public.get_user_org_id()::text);

create policy "org members write documents"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = public.get_user_org_id()::text);

create policy "org members delete documents"
  on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = public.get_user_org_id()::text);
