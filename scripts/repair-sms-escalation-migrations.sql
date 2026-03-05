-- Run this in Supabase SQL Editor if you get:
--   duplicate key value violates unique constraint "schema_migrations_pkey"
--
-- Then run:  npx supabase db push
-- (Migrations use IF NOT EXISTS / CREATE OR REPLACE, so re-running is safe.)
--
-- Covers two rename scenarios:
-- 1. Original March 10 migrations that may have been applied under different names
-- 2. March 3 migrations renamed to March 10 130xxx to fix ordering dependency
--    (20260303 files ALTER tables created by 20260310 — breaks fresh deploys)

DELETE FROM supabase_migrations.schema_migrations
WHERE version IN (
  '20260310000004', '20260310000005', '20260310000006',
  '20260303120000', '20260303180000', '20260303200000', '20260303210000'
);
