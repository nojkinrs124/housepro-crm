-- Применено через Supabase MCP (apply_migration) 2026-07-14, файл добавлен в репозиторий
-- для истории схемы. Хранит состояние подтверждений мутирующих действий Telegram-бота
-- между сообщениями вебхука (иначе confirm/cancel не на чем держать).

create table if not exists public.bot_pending_actions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  telegram_chat_id text not null,
  telegram_user_id text,
  action_type text not null,
  payload jsonb not null,
  summary_text text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '15 minutes')
);

create index if not exists idx_bot_pending_actions_chat_status
  on public.bot_pending_actions (telegram_chat_id, status, created_at desc);

alter table public.bot_pending_actions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'bot_pending_actions' and policyname = 'org_isolation'
  ) then
    create policy org_isolation on public.bot_pending_actions
      for all
      using (organization_id = get_user_org_id())
      with check (organization_id = get_user_org_id());
  end if;
end $$;
