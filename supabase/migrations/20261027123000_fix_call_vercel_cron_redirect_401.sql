-- Фикс 401 на всех частых кронах (channel-heartbeat, avito-messenger) с 09:45 27.10.2026.
--
-- Причина: call_vercel_cron() бил в housepro24.vercel.app, который отдаёт 308 редирект на
-- housepro24.ru. pg_net (как и большинство HTTP-клиентов) не переносит заголовок
-- Authorization на межхостовый редирект — финальный запрос доходил до .ru уже без Bearer
-- и получал честный 401 от isCronAuthorized(). Это не было связано ни с ротацией секрета,
-- ни с кодом Авито-бота — функция ломалась на самом первом прыжке, до любой бизнес-логики.
--
-- Фикс: бить сразу в прод-домен, без промежуточного редиректа.

create or replace function public.call_vercel_cron(path text, timeout_ms integer default 60000)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  secret text;
begin
  select decrypted_secret into secret
  from vault.decrypted_secrets
  where name = 'channel_cron_secret'
  limit 1;

  if secret is null then
    raise warning 'call_vercel_cron: секрет channel_cron_secret не найден в vault, % пропущен', path;
    return;
  end if;

  perform net.http_get(
    url := 'https://housepro24.ru' || path,
    headers := jsonb_build_object('Authorization', 'Bearer ' || secret),
    timeout_milliseconds := timeout_ms
  );
end;
$$;

comment on function public.call_vercel_cron(text, integer) is
  'Дёргает GET-эндпоинт /api/cron/* на housepro24.ru с Bearer CRON_SECRET из vault (channel_cron_secret). Только для pg_cron. Бьёт в домен напрямую, не в housepro24.vercel.app — тот редиректит 308 и теряет заголовок Authorization.';

revoke all on function public.call_vercel_cron(text, integer) from public, anon, authenticated;
