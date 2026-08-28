-- Advisor: extension_in_public -- pg_trgm lived in the public schema, which
-- the advisor flags as a risk (extensions in public can collide with
-- application objects and complicate privilege management). Relocated to
-- the service extensions schema -- it is already in the project's default
-- search_path, so all trigram operators/functions (used by the GIN indexes
-- idx_*_trgm) keep resolving without code changes and without rebuilding
-- the indexes.
--
-- Verified before applying: the Postgres role's default search_path
-- contains "$user", public, extensions -- so relative references to
-- pg_trgm functions (similarity(), % operator, etc.) do not break.

alter extension pg_trgm set schema extensions;
