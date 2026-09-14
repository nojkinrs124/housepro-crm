-- Сгенерированное объявление объекта (кнопка «Сгенерировать объявление» в карточке).
-- История генераций отдельной таблицей не ведётся — хранится последний результат.
alter table properties
  add column if not exists listing_title        text,
  add column if not exists listing_text         text,
  add column if not exists listing_raw_input    text,
  add column if not exists listing_generated_at timestamptz,
  add column if not exists listing_model        text;
