---
name: create-supabase-migration
description: Scaffold a Supabase SQL migration for ATTS with correct file naming, RLS policy setup using the project's seven-role model (employee, admin, manager, mechanic, general_foreman, safety_officer, foreman), audit triggers, indexes for known query patterns, and a pre-commit security checklist.
triggers:
  - "create migration"
  - "add table"
  - "new migration"
  - "database schema change"
  - "add column"
  - "alter table"
  - "new database table"
  - "schema change"
version: 1.0
reviewed: 2026-02-17
---

# Create Supabase Migration

## Purpose
Produces a correctly structured SQL migration file for the ATTS Supabase project. Missing RLS policies, audit triggers, or indexes are silent failures — this skill ensures none get skipped.

## ⚠️ Security-First Rule
Every new table MUST have RLS enabled and policies defined before the migration is considered complete. A table without RLS is accessible to any authenticated user. This is a compliance violation in a safety-forms application.

## Pre-Flight Checklist
Before writing any SQL, collect:
- [ ] Table name — snake_case, plural (e.g., `hazard_assessments`)
- [ ] Purpose — what does this table store?
- [ ] Who can SELECT? (all auth users / specific roles / own rows only)
- [ ] Who can INSERT? (all auth users / specific roles)
- [ ] Who can UPDATE? (all / own rows only / specific roles)
- [ ] Who can DELETE? (admin only / own rows / never)
- [ ] Expected query patterns — what WHERE clauses will be most common? (drives index decisions)
- [ ] Does this table need photo URLs? (add `photo_urls text[]` column)
- [ ] Does this table need offline sync? (add `client_id uuid` column for dedup)

---

## File Naming

Format: `YYYYMMDDHHMMSS_descriptive_name.sql`

- Use current UTC timestamp
- Name should describe the change, not the table (e.g., `20260217120000_add_hazard_assessments_table.sql` not `20260217120000_hazard_assessments.sql`)
- Location: `supabase/migrations/`

---

## Migration Structure (in order)

See `references/migration-template.md` for the full SQL template.

### 1. Table Creation

```sql
create table if not exists public.<table_name> (
  id uuid primary key default gen_random_uuid(),
  
  -- Foreign keys
  submitted_by uuid not null references auth.users(id) on delete restrict,
  
  -- Domain columns (your fields here)
  
  -- Offline dedup (include if form can be submitted offline)
  client_id uuid unique,
  
  -- Photos (include if form has photos)
  photo_urls text[] default '{}',
  
  -- Audit columns — ALWAYS include these
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### 2. Enable RLS

```sql
alter table public.<table_name> enable row level security;
```

Never skip this line.

### 3. RLS Policies — Use the Decision Tree

See `references/rls-decision-tree.md` for the full policy templates.

**Quick reference — choose the right pattern:**

| Access Pattern | Use Policy Template |
|---|---|
| All authenticated users can read | `select_all_auth` |
| Users can only read their own rows | `select_own_rows` |
| Role-gated read (safety_officer+) | `select_role_gated` |
| All authenticated users can insert | `insert_all_auth` |
| Users can only edit their own rows | `update_own_rows` |
| Admin-only delete | `delete_admin_only` |
| No deletes allowed | (no delete policy — deny by default) |

### 4. Indexes

Always index:
- Foreign key columns (`submitted_by`, `employee_id`, etc.)
- `created_at` for date-range queries
- Any column that appears in WHERE clauses based on the expected query patterns

```sql
create index if not exists idx_<table>_submitted_by on public.<table_name>(submitted_by);
create index if not exists idx_<table>_created_at on public.<table_name>(created_at desc);
-- Add query-specific indexes here
```

### 5. Audit Trigger

Always add the updated_at trigger:

```sql
create trigger set_<table_name>_updated_at
  before update on public.<table_name>
  for each row execute function public.set_updated_at();
```

The `set_updated_at()` function already exists in the database — do not redefine it.

### 6. Comments (Optional but recommended)

```sql
comment on table public.<table_name> is 'Stores <description> for ATTS safety compliance.';
comment on column public.<table_name>.client_id is 'Client-generated UUID for offline deduplication.';
```

---

## After Creation — Security Checklist

Run these checks mentally before saving the file:

- [ ] `alter table ... enable row level security` is present
- [ ] At minimum a SELECT policy exists — no table should be silently unreadable
- [ ] DELETE policy is present (or intentionally absent — document why)
- [ ] Every `references` foreign key has `on delete restrict` or `on delete cascade` (never silent)
- [ ] `created_at` and `updated_at` columns are present
- [ ] Audit trigger is present
- [ ] Index on `submitted_by` / primary FK column
- [ ] Index on `created_at` if date-range queries expected
- [ ] If offline-capable: `client_id uuid unique` column is present
- [ ] File is named with current timestamp and descriptive name

---

## Anti-Patterns — Never Do These

- **Never** create a table without `enable row level security`
- **Never** use `on delete cascade` on `submitted_by` references — safety records must outlive user accounts (use `restrict`)
- **Never** use `serial` or `integer` for IDs — always `uuid default gen_random_uuid()`
- **Never** store timezone-naive timestamps — always `timestamptz`
- **Never** add the `updated_at` trigger logic inline — call the existing `set_updated_at()` function
- **Never** name indexes without the `idx_` prefix
- **Never** create a migration that modifies an existing RLS policy without reviewing all existing policies on that table first
