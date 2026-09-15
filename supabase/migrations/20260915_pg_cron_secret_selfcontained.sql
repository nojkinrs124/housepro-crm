-- Секрет для pg_cron-джобов живёт только в Vault и никогда не проходит через человека.
--
-- Первая версия (20260915_pg_cron_frequent_jobs) ожидала, что в Vault руками положат
-- значение CRON_SECRET из Vercel. Переносить токен между сервисами вручную не нужно:
-- Postgres сам генерирует секрет, а эндпоинты /api/cron/channel-heartbeat и
-- /api/cron/avito-messenger сверяют Bearer с ним через get_pg_cron_secret() под
-- service_role (см. src/lib/cron-auth.ts). CRON_SECRET из Vercel по-прежнему принимается —
-- для ручного вызова и совместимости.

-- Идемпотентно: секрет создаётся один раз, повторный запуск миграции его не перетирает.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'channel_cron_secret') then
    perform vault.create_secret(
      encode(gen_random_bytes(32), 'hex'),
      'channel_cron_secret',
      'Bearer для pg_cron → /api/cron/* на проде. Сгенерирован в БД, наружу не выносить.'
    );
  end if;
end;
$$;

create or replace function public.get_pg_cron_secret()
returns text
language sql
security definer
set search_path = ''
stable
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = 'channel_cron_secret'
  limit 1;
$$;

comment on function public.get_pg_cron_secret() is
  'Секрет pg_cron-джобов из Vault. Только для service_role: эндпоинты /api/cron/* сверяют с ним Bearer.';

revoke all on function public.get_pg_cron_secret() from public, anon, authenticated;
grant execute on function public.get_pg_cron_secret() to service_role;
