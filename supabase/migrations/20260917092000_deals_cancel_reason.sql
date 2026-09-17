-- Причина отмены сделки. Предусловие cancel_reason было объявлено в
-- preconditions.ts, но хранить его было негде — «Отменить сделку» срабатывала
-- одним кликом без вопросов (сквозной проход 17.09.2026, RA-13).
alter table public.deals add column if not exists cancel_reason text;
comment on column public.deals.cancel_reason is 'Почему сделка отменена — обязательна при переводе в cancelled.';
