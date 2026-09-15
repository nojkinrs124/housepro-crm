-- Модуль: Telegram-канал контент-ассистент
-- Черновики постов, настройки канала, трекинг CTA-кликов, еженедельная сводка

create table if not exists public.channel_bot_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  channel_chat_id text,                          -- id/username канала, куда публикуем
  admin_telegram_user_id text,                    -- кто утверждает черновики
  style_prompt text default 'Деловой, экспертный, дружелюбный тон. Без канцелярита, без излишнего пафоса.',
  schedule_json jsonb not null default '{"mon":"analytics","wed":"case","fri":"cta"}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.channel_posts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rubric text not null check (rubric in ('analytics','case','cta','adhoc')),
  status text not null default 'draft' check (status in ('draft','pending_review','approved','published','rejected','failed','expired')),
  draft_text text,
  final_text text,
  cta_type text not null default 'none' check (cta_type in ('dm_admin','bot_qualifier','none')),
  source_input text,                              -- сырой текст/транскрипт (для кейсов)
  scheduled_for date,
  review_message_id bigint,                       -- id сообщения с черновиком в личке админа
  channel_message_id bigint,                       -- id опубликованного сообщения в канале
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_channel_posts_org_status on public.channel_posts(organization_id, status);
create index if not exists idx_channel_posts_scheduled on public.channel_posts(scheduled_for);

create table if not exists public.channel_links (
  code text primary key,                          -- короткий код в /r/{code}
  organization_id uuid not null references public.organizations(id) on delete cascade,
  post_id uuid references public.channel_posts(id) on delete set null,
  destination_url text not null,
  label text,
  created_at timestamptz not null default now()
);

create table if not exists public.channel_link_clicks (
  id uuid primary key default gen_random_uuid(),
  code text not null references public.channel_links(code) on delete cascade,
  clicked_at timestamptz not null default now(),
  user_agent text,
  referer text
);

create index if not exists idx_channel_link_clicks_code on public.channel_link_clicks(code, clicked_at);

create table if not exists public.channel_weekly_stats (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  week_start date not null,
  subscriber_count_start int,
  subscriber_count_end int,
  posts_published int not null default 0,
  total_clicks int not null default 0,
  top_post_id uuid references public.channel_posts(id),
  created_at timestamptz not null default now(),
  unique (organization_id, week_start)
);

alter table public.channel_bot_settings enable row level security;
alter table public.channel_posts enable row level security;
alter table public.channel_links enable row level security;
alter table public.channel_link_clicks enable row level security;
alter table public.channel_weekly_stats enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'org_isolation' and tablename = 'channel_bot_settings') then
    create policy "org_isolation" on public.channel_bot_settings for all to authenticated
      using (organization_id = get_user_org_id()) with check (organization_id = get_user_org_id());
  end if;
  if not exists (select 1 from pg_policies where policyname = 'org_isolation' and tablename = 'channel_posts') then
    create policy "org_isolation" on public.channel_posts for all to authenticated
      using (organization_id = get_user_org_id()) with check (organization_id = get_user_org_id());
  end if;
  if not exists (select 1 from pg_policies where policyname = 'org_isolation' and tablename = 'channel_links') then
    create policy "org_isolation" on public.channel_links for all to authenticated
      using (organization_id = get_user_org_id()) with check (organization_id = get_user_org_id());
  end if;
  if not exists (select 1 from pg_policies where policyname = 'org_isolation' and tablename = 'channel_weekly_stats') then
    create policy "org_isolation" on public.channel_weekly_stats for all to authenticated
      using (organization_id = get_user_org_id()) with check (organization_id = get_user_org_id());
  end if;
  -- clicks не содержат organization_id напрямую — изолируем через join на channel_links
  if not exists (select 1 from pg_policies where policyname = 'org_isolation_via_link' and tablename = 'channel_link_clicks') then
    create policy "org_isolation_via_link" on public.channel_link_clicks for select to authenticated
      using (exists (select 1 from public.channel_links l where l.code = channel_link_clicks.code and l.organization_id = get_user_org_id()));
  end if;
end $$;

alter table public.channel_bot_settings add column if not exists awaiting_case boolean not null default false;

alter table public.channel_bot_settings add column if not exists admin_telegram_username text;

alter table public.channel_posts add column if not exists image_url text;

-- Обобщаем awaiting_case (bool) до awaiting_intent (text) — теперь то же самое ожидание
-- нужно и для /post из меню, не только для /case.
alter table public.channel_bot_settings add column if not exists awaiting_intent text check (awaiting_intent in ('case','post'));
update public.channel_bot_settings set awaiting_intent = 'case' where awaiting_case = true;
alter table public.channel_bot_settings drop column if exists awaiting_case;

alter table public.channel_bot_settings add column if not exists schedule_paused boolean not null default false;

alter table public.channel_posts add column if not exists reaction_count int not null default 0;

alter table public.channel_weekly_stats add column if not exists total_reactions int not null default 0;

-- Часовой пояс канала (для расчёта "завтра" при генерации черновика) и локальный час,
-- в который черновик уходит на утверждение. GMT+7 = Etc/GMT-7 (фиксированный офсет, без DST).
alter table public.channel_bot_settings add column if not exists timezone text not null default 'Etc/GMT-7';
alter table public.channel_bot_settings add column if not exists draft_send_hour int not null default 19 check (draft_send_hour between 0 and 23);
