-- ═══════════════════════════════════════════════════════════════════════════
-- ПРИМЕНЕНО на проде 16.09.2026 владельцем вручную через Dashboard SQL Editor
-- (guard-migration блокирует DROP через apply_migration — намеренно). Запись в
-- supabase_migrations.schema_migrations добавлена отдельно, чтобы db push и
-- локальный стек не пытались применить повторно. Решение B4 аудита упрощения
-- (docs/SIMPLIFY-AUDIT.md).
--
-- Проверки перед запуском (все дали 0 на проде 16.09.2026):
--   select count(*) from deals     where client_id is not null or owner_id is not null;
--   select count(*) from contracts where client_id is not null or owner_id is not null;
--   select count(*) from tasks     where owner_id is not null;
--   select count(*) from logs;   -- 10 строк, никем не читались (A1 закрыт)
--
-- Код: ContractSchema держал client_id (uuid → null), и insert/update договора
-- писал client_id: null — после DROP это падало бы на проде. Снято тем же
-- коммитом (src/lib/schemas/index.ts, contracts/[id]/edit). НЕ трогаем:
-- contacts.passport (читает генерация документов) и files.client_id
-- (пишет files.actions.ts — привязка файла к контакту).
-- ═══════════════════════════════════════════════════════════════════════════

-- Осколки удалённых таблиц clients/owners (задача #24 в docs/IMPROVEMENTS.md)
alter table public.deals     drop column if exists client_id;
alter table public.deals     drop column if exists owner_id;
alter table public.contracts drop column if exists client_id;
alter table public.contracts drop column if exists owner_id;
alter table public.tasks     drop column if exists owner_id;

-- Журнал, который никто не читал: события генерации договора теперь идут
-- в audit_logs (см. generate.actions.ts).
drop table if exists public.logs;

-- Индексы-дубли на замороженной таблице payments (idx_payments_* остаются)
drop index if exists public.payments_contract_id_idx;
drop index if exists public.payments_due_date_idx;
drop index if exists public.payments_status_idx;

-- Остатки биллинга Stripe, удалённого 04.09.2026 (organizations.plan оставляем)
alter table public.organizations drop column if exists stripe_customer_id;
alter table public.organizations drop column if exists stripe_subscription_id;
alter table public.organizations drop column if exists subscription_status;
alter table public.organizations drop column if exists trial_ends_at;
