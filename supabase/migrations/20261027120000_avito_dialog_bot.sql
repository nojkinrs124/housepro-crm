-- Авито-бот: автоматический диалог в мессенджере Авито + авто-назначение показов.
--
-- Зачем: крон avito-messenger до сих пор только логировал переписку в ленту общения —
-- ответить клиенту мог только человек внутри приложения Авито, вне CRM. Эта миграция
-- добавляет хранилище истории диалога (как bot_conversations у Telegram-бота, но
-- индексировано по чату Авито, а не по Telegram chat_id) — модель должна видеть
-- предыдущие свои сообщения, иначе на каждое новое сообщение клиента отвечает заново
-- без контекста.

create table if not exists public.avito_conversations (
  avito_chat_id text not null,
  organization_id uuid not null,
  messages jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'avito_conversations_pkey' and connamespace = 'public'::regnamespace) then
    alter table public.avito_conversations add constraint avito_conversations_pkey primary key (avito_chat_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'avito_conversations_organization_id_fkey' and connamespace = 'public'::regnamespace) then
    alter table public.avito_conversations add constraint avito_conversations_organization_id_fkey foreign key (organization_id) references public.organizations(id) on delete cascade;
  end if;
end $$;

alter table public.avito_conversations enable row level security;

-- Крон читает/пишет под service_role (getSupabaseAdmin) — RLS здесь только
-- на случай прямого доступа из приложения тем же паттерном, что и avito_settings.
drop policy if exists "org members access avito conversations" on public.avito_conversations;
create policy "org members access avito conversations" on public.avito_conversations
  for all to authenticated
  using (organization_id = public.get_user_org_id())
  with check (organization_id = public.get_user_org_id());

-- leads.property_id уже существует в схеме (используется формой лида) — Авито-бот
-- просто заполняет его автоматически, связывая чат с объектом по itemId объявления.
create index if not exists idx_leads_property_id on public.leads(property_id);

comment on table public.avito_conversations is
  'История диалога LLM-бота с клиентом в конкретном чате Авито — аналог bot_conversations у Telegram, индексирован по avito_chat_id.';
