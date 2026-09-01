-- ═══════════════════════════════════════════════════════════════════════════
-- Простая электронная подпись договора (152-ФЗ / 63-ФЗ, ст. 5 п. 2)
-- ═══════════════════════════════════════════════════════════════════════════
-- Договор подписывался только на бумаге при личной встрече. Полноценная
-- квалифицированная ЭП требует аккредитованного удостоверяющего центра и
-- договора с оператором ЭДО, но закон допускает простую электронную подпись —
-- подтверждение личности одноразовым кодом, если стороны о ней договорились.
--
-- Юридическую силу такой подписи даёт совокупность доказательств, поэтому
-- фиксируем всё: хэш подписанного файла (чтобы доказать, что подписан именно
-- он), время, IP и user-agent подписанта, а также сам факт ввода кода.

create table if not exists public."contract_signatures" (
  "id" uuid not null default gen_random_uuid() primary key,
  "organization_id" uuid not null references public.organizations(id) on delete cascade,
  "contract_id" uuid not null references public.contracts(id) on delete cascade,

  -- Публичный токен ссылки для подписанта. Длинный и случайный: страница
  -- подписания открыта без авторизации.
  "sign_token" text not null unique,

  -- Кого приглашаем подписать.
  "signer_contact_id" uuid references public.contacts(id) on delete set null,
  "signer_name" text,
  "signer_email" text,
  "signer_phone" text,

  "status" text not null default 'pending'
    check (status = any (array['pending'::text, 'viewed'::text, 'signed'::text,
                               'declined'::text, 'expired'::text])),

  -- Снимок документа на момент отправки: ссылка и SHA-256 файла.
  -- Хэш — ключевая часть доказательства: он показывает, что после подписания
  -- файл не подменяли.
  "document_url" text,
  "document_sha256" text,

  -- Одноразовый код хранится только хэшем: утечка таблицы не должна давать
  -- возможность «подписать» договор за клиента.
  "code_hash" text,
  "code_expires_at" timestamptz,
  "code_attempts" integer not null default 0,
  "code_sent_at" timestamptz,

  "signed_at" timestamptz,
  "signer_ip" text,
  "signer_user_agent" text,
  "declined_reason" text,

  "expires_at" timestamptz not null default (now() + interval '14 days'),
  "created_by" uuid,
  "created_at" timestamptz not null default now()
);

create index if not exists idx_contract_signatures_contract
  on public.contract_signatures(contract_id, created_at desc);
create index if not exists idx_contract_signatures_org
  on public.contract_signatures(organization_id, status);

alter table public.contract_signatures enable row level security;

-- Читают и создают запросы на подпись только сотрудники организации.
-- Сама страница подписания работает через service-role по токену — у
-- подписанта нет и не должно быть сессии в CRM.
do $$ begin
  if not exists (select 1 from pg_policies
    where policyname = 'org members manage signatures' and tablename = 'contract_signatures') then
    create policy "org members manage signatures" on public.contract_signatures
      for all to authenticated
      using (organization_id = public.get_user_org_id())
      with check (organization_id = public.get_user_org_id());
  end if;
end $$;
