-- Кому принадлежит незавершённый ввод бота.
--
-- `awaiting_intent` — одна строка на организацию, то есть флаг был общим для
-- всех, кто пишет боту. Пока админ не закончил начатое («добавить слот»,
-- «добавить пользователя», «правка промпта рубрики»), это состояние
-- подхватывал ЛЮБОЙ следующий собеседник бота: его текст разбирался как ответ
-- на чужую форму. В случае с `add_bot_user` посторонний мог таким образом
-- вписать себя в список допущенных.
--
-- Владелец ввода закрывает дыру: состояние потребляет только тот, кто его начал.
alter table public.channel_bot_settings
  add column if not exists "awaiting_intent_user_id" text;

comment on column public.channel_bot_settings.awaiting_intent_user_id is
  'Telegram user id того, кто начал незавершённый ввод. Чужой ввод под этот intent не подставляется.';

-- Незавершённый ввод, оставшийся с прошлой версии, владельца не имеет —
-- сбрасываем, иначе он навсегда останется «ничьим» и никогда не потребится.
update public.channel_bot_settings
set awaiting_intent = null
where awaiting_intent is not null and awaiting_intent_user_id is null;
