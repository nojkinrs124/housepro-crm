-- Фаза 1 аудита (1.2): bot_processed_updates помечал update «обработано» ДО
-- работы (insert по PK). Ход, который упёрся в maxDuration и не успел ответить,
-- навечно запирал update_id — повторная доставка от Telegram получала
-- duplicate:true и ответ пользователю не приходил никогда.
--
-- Статус claimed|done|failed + claimed_at с reclaim по TTL: если воркер умер
-- без finally (убит по таймауту), другой приход того же update_id через TTL
-- заберёт его заново, а не будет заблокирован навечно.

alter table public.bot_processed_updates
  add column if not exists status text not null default 'claimed'
    check (status in ('claimed', 'done', 'failed')),
  add column if not exists claimed_at timestamptz not null default now();

-- Старые строки (до этой миграции) все успешно обработаны — иначе бот
-- давно бы не отвечал на них никогда; переводим в 'done', чтобы их не
-- захватил reclaim по TTL сразу после деплоя.
update public.bot_processed_updates set status = 'done' where status = 'claimed';

create index if not exists idx_bot_processed_updates_status_claimed
  on public.bot_processed_updates (status, claimed_at);
