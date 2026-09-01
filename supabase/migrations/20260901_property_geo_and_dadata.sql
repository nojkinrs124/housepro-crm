-- ═══════════════════════════════════════════════════════════════════════════
-- Геоданные объектов (координаты, ФИАС, метро)
-- ═══════════════════════════════════════════════════════════════════════════
-- Раньше адрес объекта был просто текстом. Из-за этого невозможны были карта
-- в подборке для клиента, поиск «рядом с метро» и корректные фиды на площадки,
-- которые требуют координаты.
--
-- Заполняются подсказками DaData при вводе адреса (см. src/lib/dadata),
-- но остаются необязательными: объект можно завести и без интеграции.

alter table public.properties add column if not exists "latitude" numeric;
alter table public.properties add column if not exists "longitude" numeric;
alter table public.properties add column if not exists "fias_id" text;
alter table public.properties add column if not exists "metro" text;

-- Частичный индекс: объектов без координат в базе будет много (старые записи),
-- и в выборки «показать на карте» они всё равно не попадают.
create index if not exists idx_properties_geo
  on public.properties(organization_id, latitude, longitude)
  where latitude is not null and longitude is not null;
