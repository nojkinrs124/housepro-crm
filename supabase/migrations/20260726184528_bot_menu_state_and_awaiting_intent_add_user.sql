-- Состояние навигации главного меню бота (перерисовываемый экран на чат).
create table if not exists public.bot_menu_state (
  telegram_chat_id text primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  current_screen text not null default 'root',
  menu_message_id bigint,
  updated_at timestamptz not null default now()
);

alter table public.bot_menu_state enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'bot_menu_state' and policyname = 'org_isolation'
  ) then
    create policy org_isolation on public.bot_menu_state
      for all using (organization_id = get_user_org_id())
      with check (organization_id = get_user_org_id());
  end if;
end $$;

-- Расширяем допустимые значения awaiting_intent: нужен ещё режим ожидания
-- telegram_user_id/пересланного сообщения для добавления пользователя в allowlist бота.
alter table public.channel_bot_settings drop constraint if exists channel_bot_settings_awaiting_intent_check;
alter table public.channel_bot_settings add constraint channel_bot_settings_awaiting_intent_check
  check (awaiting_intent = ANY (ARRAY['case'::text, 'post'::text, 'add_bot_user'::text]));
