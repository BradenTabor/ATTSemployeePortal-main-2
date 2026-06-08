-- =============================================================================
-- Local-harness stubs for Supabase-managed schemas that the prod baseline
-- references but that are NOT part of vanilla PostgreSQL.
--
-- These exist ONLY so the prod schema dump loads cleanly on a plain local PG17.
-- They are intentionally inert (no scheduling, no HTTP). They are loaded BEFORE
-- prod_schema.sql so validated objects resolve:
--   * VIEWS public.cron_job_runs / public.scheduled_cron_jobs read cron.job(+runs)
--   * a webhook TRIGGER references supabase_functions.http_request()
--   * several function bodies call net.http_post() (bodies aren't validated, but
--     the stub keeps the harness faithful if anything ever executes them).
--
-- Mirrors real pg_cron / pg_net column + signature shapes so views resolve.
-- =============================================================================

-- contrib extensions present in prod (bundled with PostgreSQL 17) ------------
-- pg_trgm lives in public on this project (indexes use public.gin_trgm_ops).
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;

-- pg_cron -------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS cron;

CREATE TABLE IF NOT EXISTS cron.job (
  jobid    bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  schedule text,
  command  text,
  nodename text DEFAULT 'localhost',
  nodeport integer DEFAULT 5432,
  database text DEFAULT current_database(),
  username text DEFAULT current_user,
  active   boolean DEFAULT true,
  jobname  text
);

CREATE TABLE IF NOT EXISTS cron.job_run_details (
  jobid          bigint,
  runid          bigint,
  job_pid        integer,
  database       text,
  username       text,
  command        text,
  status         text,
  return_message text,
  start_time     timestamptz,
  end_time       timestamptz
);

CREATE OR REPLACE FUNCTION cron.schedule(job_name text, schedule text, command text)
RETURNS bigint LANGUAGE sql AS $$ SELECT 0::bigint $$;

CREATE OR REPLACE FUNCTION cron.alter_job(
  job_id bigint,
  schedule text DEFAULT NULL,
  command text DEFAULT NULL,
  database text DEFAULT NULL,
  username text DEFAULT NULL,
  active boolean DEFAULT NULL
) RETURNS void LANGUAGE sql AS $$ SELECT $$;

CREATE OR REPLACE FUNCTION cron.unschedule(job_name text)
RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;

-- pg_net --------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS net;

CREATE OR REPLACE FUNCTION net.http_post(
  url text,
  body jsonb DEFAULT '{}'::jsonb,
  params jsonb DEFAULT '{}'::jsonb,
  headers jsonb DEFAULT '{}'::jsonb,
  timeout_milliseconds integer DEFAULT 5000
) RETURNS bigint LANGUAGE sql AS $$ SELECT 0::bigint $$;

CREATE OR REPLACE FUNCTION net.http_get(
  url text,
  params jsonb DEFAULT '{}'::jsonb,
  headers jsonb DEFAULT '{}'::jsonb,
  timeout_milliseconds integer DEFAULT 5000
) RETURNS bigint LANGUAGE sql AS $$ SELECT 0::bigint $$;

-- supabase webhooks ---------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS supabase_functions;

-- Trigger functions take no formal args (args arrive via TG_ARGV); CREATE TRIGGER
-- only needs a zero-arg function returning trigger to resolve.
CREATE OR REPLACE FUNCTION supabase_functions.http_request()
RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$;

-- storage (Supabase Storage) ------------------------------------------------
-- Prod baseline dump is auth+public only; migrations before prod HEAD are not
-- re-applied. Policies below are verbatim from prod (applied via
-- 20260309000000_create_safety_rewards_tables.sql lines 168-194). Gate
-- assertion 20260606040413 checks policyname = 'Admins can upload reward images'.
CREATE SCHEMA IF NOT EXISTS storage;

CREATE TABLE IF NOT EXISTS storage.buckets (
  id     text PRIMARY KEY,
  name   text NOT NULL,
  public boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS storage.objects (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text REFERENCES storage.buckets(id)
);

INSERT INTO storage.buckets (id, name, public)
VALUES ('safety-rewards', 'safety-rewards', true)
ON CONFLICT (id) DO NOTHING;

-- Policies load in storage_baseline.sql AFTER prod_schema (they call public.is_admin()).
