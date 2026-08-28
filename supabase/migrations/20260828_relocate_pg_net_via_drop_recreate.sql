-- Advisor: extension_in_public -- pg_net also lived in public. Unlike
-- pg_trgm, pg_net does NOT support `ALTER EXTENSION ... SET SCHEMA`
-- (ERROR 0A000: extension "pg_net" does not support SET SCHEMA), so the
-- only way to relocate it is DROP/CREATE. This is a destructive operation
-- (in-flight async HTTP requests are lost), so it was explicitly confirmed
-- by Ruslan before running, not decided on automatically.
--
-- Verified after applying:
--  - the cron.job for check-overdue-daily-telegram was unaffected (it calls
--    net.http_post(...) -- pg_net's functions always live in the fixed
--    net schema regardless of which schema the extension itself is
--    registered in, so schema-qualified calls keep working);
--  - a live test net.http_post(...) call against httpbin.org succeeded.

drop extension pg_net cascade;
create extension pg_net schema extensions;
