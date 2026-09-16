-- ═══════════════════════════════════════════════════════════════════════════
-- НЕ ПРИМЕНЕНО. Лежит вне supabase/migrations намеренно: содержит DROP, который
-- guard-migration блокирует через apply_migration — это единственный путь к
-- потере боевых данных, и запускает его владелец руками (решение B4 аудита
-- упрощения, docs/SIMPLIFY-AUDIT.md).
--
-- Перед запуском (все проверки на проде 16.09.2026 дали 0 — повторить):
--   select count(*) from deals     where client_id is not null or owner_id is not null;
--   select count(*) from contracts where client_id is not null or owner_id is not null;
--   select count(*) from tasks     where owner_id is not null;
--   select count(*) from logs;   -- 10 строк, никем не читаются (A1 закрыт)
--
-- Из кода обращений к этим колонкам нет (grep 16.09.2026). НЕ трогаем:
-- contacts.passport (читает генерация документов) и files.client_id
-- (пишет files.actions.ts — привязка файла к контакту).
--
-- После запуска: перенести файл в supabase/migrations/ с версией из
-- schema_migrations и перегенерировать типы (npm run db:types).
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
