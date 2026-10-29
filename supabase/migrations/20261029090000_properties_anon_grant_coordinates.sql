-- Публичная подборка /c/<token> падала с 500 «permission denied for table properties»
-- (QA 28.10.2026, находка D-12, P0).
--
-- Причина: миграция 20261022121000 закрыла anon-доступ к properties поколоночно,
-- а страница подборки (src/app/c/[token]/page.tsx) читает ещё latitude/longitude для
-- карты. Колонки не попали в грант — PostgREST отказывает всему запросу целиком.
-- Проверено на проде анонимным ключом: select latitude → 42501.
--
-- Координаты объекта в подборке клиент и так видит на карте, утечки здесь нет.
-- Строки по-прежнему ограничены политикой «anon can view published properties»
-- (опубликованные или входящие в публичную подборку).

grant select (latitude, longitude) on public.properties to anon;

-- down:
-- revoke select (latitude, longitude) on public.properties from anon;
