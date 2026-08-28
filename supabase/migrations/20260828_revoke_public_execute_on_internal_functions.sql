-- Advisor: function_permissions -- internal SECURITY DEFINER functions were
-- executable by role PUBLIC (so anon/authenticated inherit it too), though
-- they should only be called by trusted server code (pg_cron / Edge
-- Functions / API routes using service_role). Explicitly revoke EXECUTE
-- from PUBLIC -- required because anon/authenticated inherit PUBLIC's
-- privileges and a direct revoke targeted at them alone does not work
-- until it is revoked from PUBLIC first.
--
-- get_user_org_id() is intentionally NOT touched here -- used inside RLS
-- policies everywhere, must stay executable for anon/authenticated.
--
-- import_rental_contract(...) verified before this change: only called from
-- src/app/api/v1/import/rental-contract/route.ts via a service_role client
-- (getSupabaseAdmin()), never called directly from the frontend -- safe to
-- close.

revoke execute on function public.check_expiring_contracts() from public;
revoke execute on function public.check_overdue_payments() from public;
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.import_rental_contract(uuid, jsonb, jsonb, jsonb, jsonb) from public;
