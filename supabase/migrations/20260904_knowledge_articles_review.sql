-- Срок годности инструкции.
--
-- Статья без даты проверки незаметно превращается в дезинформацию: интерфейс
-- меняется, текст остаётся. Инструкция, которая врёт, хуже отсутствующей — по
-- ней сотрудник делает не то и перестаёт верить всей базе знаний.
--
-- Дата проверки, а не даты правки: правка меняет текст, а проверка — это
-- утверждение «я перечитал и это по-прежнему верно». Их надо различать, иначе
-- опечатка в заголовке «омолодит» устаревшую статью.
alter table public.knowledge_articles
  add column if not exists "reviewed_at" timestamptz;

alter table public.knowledge_articles
  add column if not exists "reviewed_by" uuid references public.users(id) on delete set null;

-- Через сколько месяцев статью надо перечитать. У разных статей разный срок:
-- «Как завести объект» живёт дольше, чем «Тарифы агентства».
alter table public.knowledge_articles
  add column if not exists "review_period_months" integer not null default 6;

alter table public.knowledge_articles drop constraint if exists knowledge_articles_review_period_check;
alter table public.knowledge_articles add constraint knowledge_articles_review_period_check
  check (review_period_months >= 1 and review_period_months <= 36);

-- Существующие статьи считаем проверенными в момент создания: они писались
-- под тогдашний интерфейс. Это честнее, чем оставить пусто и показать все
-- шестнадцать статей просроченными в первый же день.
update public.knowledge_articles
set reviewed_at = coalesce(updated_at, created_at, now())
where reviewed_at is null;

create index if not exists idx_knowledge_articles_review
  on public.knowledge_articles (organization_id, reviewed_at);
