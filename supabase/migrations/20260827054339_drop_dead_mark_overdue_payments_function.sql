-- Мёртвая функция: не вызывается ни из pg_cron, ни из кода приложения.
-- Реальная логика просрочек идёт через check_overdue_payments() + Edge Function check-overdue.
-- Найдено аудитом август 2026.
DROP FUNCTION IF EXISTS public.mark_overdue_payments();
