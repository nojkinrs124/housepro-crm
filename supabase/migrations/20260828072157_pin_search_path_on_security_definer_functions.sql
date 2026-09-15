-- Advisor: function_search_path_mutable (0011) — фиксируем search_path у функций,
-- чтобы исключить search_path hijacking. Поведение не меняется: все функции уже
-- ссылаются на объекты в public. явно/неявно, тот же эффект с закреплённым путём.

alter function public.get_user_org_id() set search_path = public;
alter function public.handle_new_user() set search_path = public;
alter function public.generate_contract_number() set search_path = public;
alter function public.check_expiring_contracts() set search_path = public;
alter function public.check_overdue_payments() set search_path = public;
