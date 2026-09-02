-- CHECK на leads.status разъехался со словарём кода (src/features/leads/config/lead-statuses.ts):
-- в базе не было 'interested' и 'rejected', зато был 'meeting', которого нет в коде.
-- Из-за этого смена статуса на «Заинтересован» или «Отказ» падала PATCH 400
-- (leads_status_check), Server Action возвращал ошибку, а UI её проглатывал —
-- статус мигал и возвращался после перезагрузки.
-- Данных со статусом 'meeting' в таблице нет (только 'new' и 'closed').

ALTER TABLE leads DROP CONSTRAINT leads_status_check;

ALTER TABLE leads ADD CONSTRAINT leads_status_check
  CHECK (status = ANY (ARRAY[
    'new'::text,
    'contacted'::text,
    'showing'::text,
    'searching'::text,
    'interested'::text,
    'converted'::text,
    'closed'::text,
    'rejected'::text
  ]));
