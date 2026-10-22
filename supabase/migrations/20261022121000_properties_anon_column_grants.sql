-- Anon-ключ читал внутренние колонки объектов: owner_id, кадастровый номер,
-- обременения, управленческий сбор (проверено запросом к проду, аудит 22.10.2026,
-- P1-2). Политика RLS у properties построчная, поэтому колонки нужно закрывать
-- грантами, а не политикой.
--
-- Список ниже — ровно PUBLIC_PROPERTY_COLUMNS из src/features/site/lib/properties.ts
-- плюс site_publish (по нему публичные запросы фильтруют). Новые колонки
-- автоматически анонимам НЕ достанутся: это fail-closed, и если такая колонка
-- понадобится сайту, её нужно добавить сюда и в whitelist осознанно.
--
-- authenticated не трогаем: сотрудники CRM читают properties как раньше, RLS
-- ограничивает их своей организацией.

revoke select on public.properties from anon;

grant select (
  id,
  title,
  property_type,
  deal_type,
  address,
  district,
  price,
  deposit,
  area,
  living_area,
  kitchen_area,
  rooms,
  floor,
  total_floors,
  ceiling_height,
  house_type,
  wall_material,
  year_built,
  has_elevator,
  has_parking,
  has_internet,
  has_tv,
  heating_type,
  water_supply_type,
  description,
  photo_urls,
  video_url,
  status,
  site_publish,
  created_at
) on public.properties to anon;

-- Служебные функции фидов Авито читают properties под SECURITY DEFINER — им
-- гранты anon не нужны и не мешают.
