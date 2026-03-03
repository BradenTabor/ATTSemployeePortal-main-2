-- Run this in Supabase SQL Editor if you get:
--   duplicate key value violates unique constraint "schema_migrations_pkey"
--   Key (version)=(20260310000001) already exists
--
-- Then run:  npx supabase db push
-- (Migrations use IF NOT EXISTS, so re-running is safe.)

DELETE FROM supabase_migrations.schema_migrations
WHERE version IN ('20260310000004', '20260310000005', '20260310000006');
