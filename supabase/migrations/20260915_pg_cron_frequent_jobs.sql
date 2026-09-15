-- Частые кроны (channel-heartbeat, avito-messenger) переезжают из GitHub Actions в pg_cron.
--
-- Почему: с 27.08.2026 GitHub троттлит schedule-запуски воркфлоу — вместо 96 в сутки
-- приходит 2–9 с интервалом 3–6 часов. Heartbeat ловит слот только в окне 30 минут,
-- поэтому ни один слот расписания канала (пн/ср/пт 19:00) не срабатывал с 21.08.
-- pg_cron запускается точно по минуте и от внешних лимитов не зависит.
--
-- Секрет НЕ хранится в самой команде джоба: он лежит в Vault под именем
-- channel_cron_secret (значение = CRON_SECRET из Vercel). Заводится один раз
-- в SQL-редакторе Supabase:
--   select vault.create_secret('<значение CRON_SECRET>', 'channel_cron_secret');
-- Пока секрета нет, джобы пишут warning в лог и запрос не делают.

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

  -- Ответа не ждём: pg_net кладёт запрос в очередь, результат — в net._http_response.
  -- Таймаут больше дефолтных 5 с, потому что heartbeat генерирует черновик через LLM.
  perform net.http_get(
    url := 'https://housepro24.vercel.app' || path,
    headers := jsonb_build_object('Authorization', 'Bearer ' || secret),
    timeout_milliseconds := timeout_ms
  );
end;
$$;

comment on function public.call_vercel_cron(text, integer) is
  'Дёргает GET-эндпоинт /api/cron/* на проде с Bearer CRON_SECRET из vault (channel_cron_secret). Только для pg_cron.';

-- Функция читает секрет — наружу через PostgREST её отдавать нельзя.
revoke all on function public.call_vercel_cron(text, integer) from public, anon, authenticated;

-- Пересоздание джобов идемпотентно: сначала снимаем старые с теми же именами.
select cron.unschedule(jobid) from cron.job where jobname in ('channel-heartbeat', 'avito-messenger');

select cron.schedule(
  'channel-heartbeat',
  '*/15 * * * *',
  $$select public.call_vercel_cron('/api/cron/channel-heartbeat')$$
);

select cron.schedule(
  'avito-messenger',
  '*/15 * * * *',
  $$select public.call_vercel_cron('/api/cron/avito-messenger', 120000)$$
);
