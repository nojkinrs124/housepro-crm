-- Phase 1: flexible channel publishing config — rubrics as data + multi-slot schedule
-- No behavior change: old schedule_json/draft_send_hour and hardcoded generate*Draft flow keep working untouched.

create table if not exists channel_rubrics (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  key text not null,
  label text not null,
  prompt_template text not null,
  use_web_search boolean not null default false,
  requires_input boolean not null default false,
  input_prompt text,
  image_style_override text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, key)
);

create table if not exists channel_schedule (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  rubric_id uuid not null references channel_rubrics(id) on delete cascade,
  day_key text not null check (day_key in ('sun','mon','tue','wed','thu','fri','sat')),
  send_time_local text not null check (send_time_local ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists channel_schedule_org_day_idx on channel_schedule (organization_id, day_key);

alter table channel_posts add column if not exists rubric_id uuid references channel_rubrics(id);
alter table channel_posts add column if not exists schedule_id uuid references channel_schedule(id);

alter table channel_rubrics enable row level security;
alter table channel_schedule enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'channel_rubrics' and policyname = 'channel_rubrics_org_isolation'
  ) then
    create policy channel_rubrics_org_isolation on channel_rubrics
      for all using (organization_id = get_user_org_id())
      with check (organization_id = get_user_org_id());
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'channel_schedule' and policyname = 'channel_schedule_org_isolation'
  ) then
    create policy channel_schedule_org_isolation on channel_schedule
      for all using (organization_id = get_user_org_id())
      with check (organization_id = get_user_org_id());
  end if;
end $$;

insert into channel_rubrics (organization_id, key, label, prompt_template, use_web_search, requires_input, input_prompt, sort_order)
values
  ('00000000-0000-0000-0000-000000000001', 'analytics', '📊 Аналитика',
   'Напиши аналитический пост для канала риэлторского агентства: тренды рынка недвижимости, изменения цен, спрос/предложение. Используй актуальные данные через веб-поиск, если это уместно.',
   true, false, null, 1),
  ('00000000-0000-0000-0000-000000000001', 'case', '💼 Кейс',
   'Напиши пост-кейс на основе надиктованной админом истории: как агентство помогло клиенту закрыть сделку. Только факты из надиктовки, без выдумывания деталей.',
   false, true, '🎙 Надиктуй кейс для сегодняшнего поста — коротко, своими словами, я оформлю в готовый текст.', 2),
  ('00000000-0000-0000-0000-000000000001', 'cta', '📣 CTA',
   'Напиши пост с призывом к действию: обратиться в агентство по вопросу продажи/аренды/подбора недвижимости. Мягкий, не навязчивый тон.',
   false, false, null, 3),
  ('00000000-0000-0000-0000-000000000001', 'adhoc', '✏️ Разовая тема',
   'Напиши пост на тему, заданную админом.',
   false, true, '✏️ Напиши тему для разового поста.', 4)
on conflict (organization_id, key) do nothing;

insert into channel_schedule (organization_id, rubric_id, day_key, send_time_local, enabled)
select '00000000-0000-0000-0000-000000000001', r.id, d.day_key, '19:00', true
from channel_rubrics r
join (values ('mon','analytics'), ('wed','case'), ('fri','cta')) as d(day_key, rkey)
  on d.rkey = r.key
where r.organization_id = '00000000-0000-0000-0000-000000000001'
on conflict do nothing;
