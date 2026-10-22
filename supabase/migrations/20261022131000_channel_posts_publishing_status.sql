-- Фаза 1 аудита (1.5): publishPost по compare-and-set, как в commitIntake
-- (lib/telegram/intake.ts). Нужен промежуточный статус 'publishing' между
-- 'pending_review'/'draft' и 'published' — без него два параллельных нажатия
-- «Опубликовать» (двойной тап, повтор callback_query от Telegram) оба проходят
-- проверку текущего статуса и публикуют пост в канал дважды.

alter table public.channel_posts drop constraint if exists channel_posts_status_check;
alter table public.channel_posts add constraint channel_posts_status_check
  check (status in ('draft', 'pending_review', 'publishing', 'approved', 'published', 'rejected', 'failed', 'expired'));
