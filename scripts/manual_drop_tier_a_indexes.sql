-- ============================================================================
-- Phase 5: Tier A index drops — RUN MANUALLY (not via Supabase migration)
-- ============================================================================
-- DROP INDEX CONCURRENTLY cannot run inside a transaction. Run each statement
-- separately in Supabase SQL Editor or via: psql -c "DROP INDEX CONCURRENTLY ..."
--
-- Tier A: High-confidence drops (bloated session indexes; tables already dropped
-- in migration 20260219200003 have their indexes removed with the table.)
-- ============================================================================

DROP INDEX CONCURRENTLY IF EXISTS public.idx_user_activity_sessions_last_seen;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_user_activity_sessions_active;
