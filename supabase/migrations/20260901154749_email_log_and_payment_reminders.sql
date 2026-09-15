-- ═══════════════════════════════════════════════════════════════════════════
-- Почтовый канал: журнал отправок + поля для напоминаний и графика платежей
-- ═══════════════════════════════════════════════════════════════════════════
-- До этой миграции CRM не могла отправить клиенту ничего: уведомления жили
-- только в таблице notifications (колокольчик) и в Telegram сотрудников.
--
-- email_log нужен не для красоты: без него невозможно ответить на вопрос
-- «письмо клиенту ушло или нет», а провайдеры (Resend/Unisender) хранят
-- историю ограниченно и ничего не знают об организациях.
--
-- ВАЖНО про выбор таблицы для платежей: рабочий реестр начислений — это
-- accounting_transactions (type='income', status='planned'), а НЕ payments.
-- В payments приложение уже ничего не пишет (страницы /payments редиректят
-- на /accounting), поэтому служебные поля вешаем на живую таблицу.

create table if not exists public."email_log" (
  "id" uuid not null default gen_random_uuid() primary key,
  "organization_id" uuid not null references public.organizations(id) on delete cascade,
  "recipient" text not null,
  "subject" text not null,
  "kind" text not null,
  "status" text not null default 'sent'
    check (status = any (array['sent'::text, 'failed'::text, 'skipped'::text])),
  "provider" text,
  "provider_message_id" text,
  "error" text,
  "entity_type" text,
  "entity_id" uuid,
  "created_at" timestamptz not null default now()
);

create index if not exists idx_email_log_org_created
  on public.email_log(organization_id, created_at desc);
create index if not exists idx_email_log_entity
  on public.email_log(entity_type, entity_id);

alter table public.email_log enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies
    where policyname = 'org members can view email log' and tablename = 'email_log') then
    create policy "org members can view email log" on public.email_log
      for select to authenticated
      using (organization_id = public.get_user_org_id());
  end if;
end $$;

-- ─── Дедупликация напоминаний об оплате ─────────────────────────────────────
-- Крон гоняется ежедневно; без отметок «когда напомнили» клиент получал бы
-- одно и то же письмо каждое утро до самой оплаты.
alter table public.accounting_transactions
  add column if not exists "reminder_sent_at" timestamptz;
alter table public.accounting_transactions
  add column if not exists "overdue_notified_at" timestamptz;

-- ─── Поля графика платежей ──────────────────────────────────────────────────
-- Начисления, созданные автоматически из договора, помечаются номером в графике
-- и периодом, за который выставлены. Ручные платежи оставляют их пустыми —
-- по наличию schedule_seq видно, что строку сгенерировала система.
alter table public.accounting_transactions
  add column if not exists "schedule_seq" integer;
alter table public.accounting_transactions
  add column if not exists "period_start" date;
alter table public.accounting_transactions
  add column if not exists "period_end" date;

create index if not exists idx_acc_tx_due_reminders
  on public.accounting_transactions(organization_id, status, due_date)
  where type = 'income';

create index if not exists idx_acc_tx_contract_schedule
  on public.accounting_transactions(contract_id, schedule_seq)
  where schedule_seq is not null;

-- ─── Онлайн-оплата начисления ───────────────────────────────────────────────
-- Ссылка на оплату и идентификатор платежа у эквайера. Хранятся на начислении,
-- потому что оплачивается именно конкретное начисление, а не договор целиком.
alter table public.accounting_transactions add column if not exists "payment_url" text;
alter table public.accounting_transactions add column if not exists "payment_external_id" text;
alter table public.accounting_transactions add column if not exists "payment_provider" text;
alter table public.accounting_transactions add column if not exists "paid_at" timestamptz;

create unique index if not exists idx_acc_tx_payment_external
  on public.accounting_transactions(payment_provider, payment_external_id)
  where payment_external_id is not null;

-- Номер платёжного поручения из банковской выписки (см. bank-import.actions.ts).
alter table public.accounting_transactions add column if not exists "bank_document_number" text;
