-- Перенос последних данных из legacy-таблицы clients в contacts.
--
-- В clients была одна строка, её двойник в contacts уже существовал, но три поля
-- там пустовали: telegram, comment и manager_id. Без этого шага они потерялись бы
-- при удалении таблицы. Паспорт переносить не потребовалось — в contacts он уже
-- разложен по полям и дополнен (кем и когда выдан, код подразделения).
--
-- source намеренно не трогаем: в contacts стоит осмысленное значение,
-- перезаписывать его данными из legacy нечем.

UPDATE contacts ct
SET telegram   = COALESCE(NULLIF(ct.telegram, ''), c.telegram),
    comment    = COALESCE(NULLIF(ct.comment,  ''), c.comment),
    manager_id = COALESCE(ct.manager_id, c.manager_id),
    updated_at = now()
FROM clients c
WHERE ct.phone = c.phone
  AND (NULLIF(ct.telegram, '') IS NULL OR NULLIF(ct.comment, '') IS NULL OR ct.manager_id IS NULL);
