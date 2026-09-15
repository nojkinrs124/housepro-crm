-- База знаний агентства: инструкции для себя и сотрудников прямо в CRM.
-- Тексты в markdown — их пишут люди, рендер идёт в React без innerHTML.
create table if not exists public.knowledge_articles (
  "id" uuid primary key default gen_random_uuid(),
  "organization_id" uuid not null references public.organizations(id) on delete cascade,
  "title" text not null,
  "slug" text not null,
  "category" text not null default 'Общее',
  "summary" text,
  "body" text not null default '',
  "sort_order" integer not null default 0,
  "is_published" boolean not null default true,
  "created_by" uuid,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);

-- Адрес статьи уникален внутри организации, а не глобально: у каждого
-- агентства своя база знаний со своими названиями.
create unique index if not exists idx_knowledge_articles_slug
  on public.knowledge_articles (organization_id, slug);

create index if not exists idx_knowledge_articles_list
  on public.knowledge_articles (organization_id, category, sort_order);

alter table public.knowledge_articles enable row level security;

-- Читают и правят статьи сотрудники своей организации; кто именно может
-- править, решает requirePermission в Server Action.
do $$ begin
  if not exists (select 1 from pg_policies
    where policyname = 'org members manage knowledge' and tablename = 'knowledge_articles') then
    create policy "org members manage knowledge" on public.knowledge_articles
      for all to authenticated
      using (organization_id = public.get_user_org_id())
      with check (organization_id = public.get_user_org_id());
  end if;
end $$;
