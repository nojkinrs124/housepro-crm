-- Личные кабинеты собственника и арендатора.
--
-- Второй контур доступа, независимый от сотрудников организации. Собственник и
-- арендатор не члены organization_members, и get_user_org_id() для них возвращает
-- пусто: под действующими политиками они не увидели бы ничего. Завести их
-- сотрудниками нельзя — это дало бы доступ ко всей организации.
--
-- Поэтому право видеть данные выражено явной строкой: контакт + объект + роль.
-- Каждый запрос кабинета проверяет её заново, идентификатор из адреса никогда
-- не считается доверенным.
create table if not exists public.portal_access (
  "id" uuid primary key default gen_random_uuid(),
  "organization_id" uuid not null references public.organizations(id) on delete cascade,
  "contact_id" uuid not null references public.contacts(id) on delete cascade,
  -- owner  — собственник объекта в управлении
  -- tenant — арендатор по действующему договору найма
  "role" text not null,
  "property_id" uuid references public.properties(id) on delete cascade,
  "engagement_id" uuid references public.management_engagements(id) on delete cascade,
  "contract_id" uuid references public.contracts(id) on delete set null,
  -- Нормализованный номер: по нему идёт вход, и он же связывает доступ с кодом.
  "phone" text not null,
  "granted_at" timestamptz not null default now(),
  "granted_by" uuid references public.users(id) on delete set null,
  -- Отзыв действует немедленно: прекращение отношений закрывает кабинет,
  -- не дожидаясь истечения сессии.
  "revoked_at" timestamptz,
  "last_login_at" timestamptz,
  constraint portal_access_role_check check (role = any (array['owner'::text, 'tenant'::text])),
  -- Доступ без объекта бессмыслен: кабинет показывает конкретный объект.
  constraint portal_access_scope_check check (property_id is not null)
);

-- Один действующий доступ на пару «контакт + объект + роль». Повторная выдача
-- не должна плодить строки, иначе отзыв закрывал бы только одну из них.
create unique index if not exists idx_portal_access_unique
  on public.portal_access (contact_id, property_id, role) where revoked_at is null;

create index if not exists idx_portal_access_phone
  on public.portal_access (phone) where revoked_at is null;

create index if not exists idx_portal_access_org
  on public.portal_access (organization_id, role);

alter table public.portal_access enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies
    where policyname = 'org members manage portal access' and tablename = 'portal_access') then
    create policy "org members manage portal access" on public.portal_access
      for all to authenticated
      using (organization_id = public.get_user_org_id())
      with check (organization_id = public.get_user_org_id());
  end if;
end $$;

-- Одноразовые коды входа.
--
-- Код хранится ТОЛЬКО хешем, как коды простой электронной подписи
-- (src/lib/signing.ts): утечка таблицы не должна давать возможность войти в
-- чужой кабинет. Соль на запрос — чтобы одинаковые коды давали разные хеши и
-- по базе нельзя было найти «такие же».
create table if not exists public.portal_otp (
  "id" uuid primary key default gen_random_uuid(),
  "organization_id" uuid not null references public.organizations(id) on delete cascade,
  "phone" text not null,
  "token" text not null,
  "code_hash" text not null,
  -- telegram | sms
  "channel" text not null,
  "expires_at" timestamptz not null,
  "attempts" integer not null default 0,
  "consumed_at" timestamptz,
  "created_at" timestamptz not null default now(),
  constraint portal_otp_channel_check check (channel = any (array['telegram'::text, 'sms'::text])),
  constraint portal_otp_attempts_check check (attempts >= 0)
);

create index if not exists idx_portal_otp_phone
  on public.portal_otp (phone, created_at desc);

alter table public.portal_otp enable row level security;

-- Коды не читает никто, кроме сервера под service role: сотрудникам они не
-- нужны, а внешнему посетителю — тем более. Политики для authenticated нет
-- намеренно, и это не забывчивость.
do $$ begin
  if not exists (select 1 from pg_policies
    where policyname = 'portal otp is server only' and tablename = 'portal_otp') then
    create policy "portal otp is server only" on public.portal_otp
      for select to authenticated using (false);
  end if;
end $$;

-- Третий канал выдачи кода: менеджер передаёт его лично.
--
-- Автоматической доставки сегодня нет ни по одному каналу, и это не недоделка,
-- а состояние системы:
--   • Telegram — contacts.telegram хранит @username, а личное сообщение по
--     юзернейму Telegram отправить не даёт: нужен chat_id, который появляется
--     только когда человек сам написал боту. Связки контакта с chat_id в базе
--     нет — это отдельная задача.
--   • SMS — провайдер не подключён и стоит денег.
--
-- Поэтому рабочий путь: менеджер жмёт «Выдать код» в CRM, видит его один раз и
-- передаёт клиенту тем каналом, которым уже с ним общается. Код при этом живёт
-- по тем же правилам — минуты, хеш, пять попыток. Когда появится доставка,
-- самостоятельный запрос заработает без переделки.
alter table public.portal_otp drop constraint if exists portal_otp_channel_check;
alter table public.portal_otp add constraint portal_otp_channel_check
  check (channel = any (array['telegram'::text, 'sms'::text, 'manual'::text]));

-- Кто выдал код вручную — чтобы в аудите было видно, через кого прошёл доступ.
alter table public.portal_otp add column if not exists "issued_by" uuid references public.users(id) on delete set null;
