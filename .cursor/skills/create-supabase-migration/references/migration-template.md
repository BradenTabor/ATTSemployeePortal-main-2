# Reference: Full Migration Template

File: `supabase/migrations/YYYYMMDDHHMMSS_add_<table_name>_table.sql`

```sql
-- Migration: Add <table_name> table
-- Created: YYYY-MM-DD
-- Purpose: <one sentence describing what this table stores and why>

-- ─── Table ────────────────────────────────────────────────────────────────────

create table if not exists public.<table_name> (
  -- Primary key
  id uuid primary key default gen_random_uuid(),

  -- Ownership / Foreign keys
  submitted_by uuid not null references auth.users(id) on delete restrict,
  -- Add other FK references here
  -- employee_id uuid references public.profiles(id) on delete restrict,

  -- ── Domain columns ──────────────────────────────────────────────────────────
  -- Add your form-specific columns here
  -- Always use timestamptz (not timestamp) for time values
  -- Always use text (not varchar) for string values
  -- Use text[] for multi-select fields
  -- Use jsonb only for truly dynamic structures
  
  date date not null,
  location text not null,
  status text not null default 'submitted'
    check (status in ('submitted', 'reviewed', 'approved', 'rejected')),
  notes text,

  -- ── Offline sync (include for forms that support offline submission) ─────────
  client_id uuid unique,  -- client-generated UUID prevents duplicate offline submissions

  -- ── Photos (include if form has photo upload) ────────────────────────────────
  photo_urls text[] not null default '{}',

  -- ── Audit columns — ALWAYS include ──────────────────────────────────────────
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── RLS ──────────────────────────────────────────────────────────────────────

alter table public.<table_name> enable row level security;

-- SELECT: submitter can read their own; safety_officer and admin can read all
create policy "<table_name>_select"
  on public.<table_name>
  for select
  to authenticated
  using (
    submitted_by = auth.uid()
    or public.current_user_role() in ('admin', 'safety_officer')
  );

-- INSERT: any authenticated user can submit (row must be attributed to themselves)
create policy "<table_name>_insert"
  on public.<table_name>
  for insert
  to authenticated
  with check (submitted_by = auth.uid());

-- UPDATE: admin only (safety records require privileged corrections)
create policy "<table_name>_update"
  on public.<table_name>
  for update
  to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

-- DELETE: intentionally no policy — compliance records are permanent
-- To "remove" a record, set status = 'rejected' instead.

-- ─── Indexes ──────────────────────────────────────────────────────────────────

-- Always index the FK to auth.users
create index if not exists idx_<table_name>_submitted_by
  on public.<table_name>(submitted_by);

-- Always index created_at for date-range queries
create index if not exists idx_<table_name>_created_at
  on public.<table_name>(created_at desc);

-- Add query-specific indexes based on expected WHERE patterns
-- create index if not exists idx_<table_name>_status on public.<table_name>(status);
-- create index if not exists idx_<table_name>_date on public.<table_name>(date desc);

-- ─── Audit Trigger ────────────────────────────────────────────────────────────

-- Uses existing set_updated_at() function — do NOT redefine it
create trigger set_<table_name>_updated_at
  before update on public.<table_name>
  for each row execute function public.set_updated_at();

-- ─── Comments ────────────────────────────────────────────────────────────────

comment on table public.<table_name> is
  '<Description of what this table stores, referenced in OSHA compliance context if relevant>.';

comment on column public.<table_name>.client_id is
  'Client-generated UUID used to deduplicate offline form submissions.';
```

## Modifying an Existing Table

For ALTER TABLE migrations, use:

```sql
-- Migration: Add <column> to <table>
-- Created: YYYY-MM-DD

alter table public.<table_name>
  add column if not exists <column_name> <type> <constraints>;

-- Add index if this column will be queried
create index if not exists idx_<table_name>_<column_name>
  on public.<table_name>(<column_name>);
```

Important: Do NOT modify existing RLS policies in an ALTER migration without
reviewing ALL existing policies on the table first and noting the change in a comment.
