-- Атомарное добавление файла/заметки в сессию сбора документов.
--
-- Фотографии одного альбома Telegram приходят отдельными update и
-- обрабатываются параллельно; read-modify-write из кода терял бы одну из них.
-- Возвращает обновлённую строку. Сессия в статусе «карточка показана»
-- возвращается в сбор: новый материал — новая карточка.
create or replace function public.intake_append(
  p_id uuid, p_file jsonb default null, p_note text default null
)
returns public.bot_intake_sessions
language sql
security definer
set search_path to 'public'
as $$
  update public.bot_intake_sessions
  set files      = case when p_file is not null then files || jsonb_build_array(p_file) else files end,
      notes      = case when nullif(trim(p_note), '') is not null then array_append(notes, trim(p_note)) else notes end,
      status     = case when status = 'extracted' then 'collecting' else status end,
      updated_at = now()
  where id = p_id
    and status in ('collecting', 'extracted')
  returning *;
$$;

revoke execute on function public.intake_append(uuid, jsonb, text) from public, anon, authenticated;
