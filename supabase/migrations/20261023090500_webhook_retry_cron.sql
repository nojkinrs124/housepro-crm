-- Фаза 3 аудита (3.2): ретрай неудачных доставок вебхуков каждые 5 минут —
-- тот же паттерн, что channel-heartbeat/avito-messenger (миграция
-- 20260915080224_pg_cron_frequent_jobs.sql): pg_cron → public.call_vercel_cron,
-- секрет из vault.channel_cron_secret, не через vercel.json (там крон не чаще
-- раза в сутки на Hobby-плане).

select cron.unschedule(jobid) from cron.job where jobname = 'webhook-retry';

select cron.schedule(
  'webhook-retry',
  '*/5 * * * *',
  $$select public.call_vercel_cron('/api/cron/webhook-retry')$$
);
