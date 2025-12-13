# Migration History Conflict Resolution Guide

## Problem
`supabase db push` is failing with: "Remote migration versions not found in local migrations directory" due to a migration history mismatch with `20251212`.

## Solution: Manual Application + History Update

### Step 1: Apply RLS Fix Migrations Manually

1. Open **Supabase Dashboard → SQL Editor**
2. Run the SQL from `supabase/MANUAL_APPLY_RLS_FIX.sql`
   - This applies the helper functions and fixes app_users RLS policies
   - Copy and paste the entire file contents into SQL Editor
   - Click "Run" to execute

### Step 2: Update Migration History

1. Still in **SQL Editor**, run the SQL from `supabase/UPDATE_MIGRATION_HISTORY.sql`
   - This marks migrations `20251212194400` and `20251212194500` as applied
   - This allows `supabase db push` to work correctly going forward

### Step 3: Verify

Run in terminal:
```bash
supabase migration list
```

You should see `20251212194400` and `20251212194500` marked as applied on both local and remote.

### Step 4: Test the Fix

1. Try `supabase db push` again - it should work now
2. Verify RLS policies are fixed:
   ```sql
   -- Should return policies WITHOUT app_users subqueries
   SELECT policyname, qual::text
   FROM pg_policies 
   WHERE schemaname = 'public' 
     AND tablename = 'app_users'
     AND (qual::text LIKE '%app_users%');
   -- Should return empty (no recursion!)
   ```

## Alternative: If Manual Application Doesn't Work

If you continue to have issues, you can also try:

1. **Reset migration history** (DANGEROUS - only if you're sure):
   ```bash
   # Connect to remote database and check current state
   # Then manually fix the supabase_migrations.schema_migrations table
   ```

2. **Apply via Supabase CLI with force flag** (if available):
   ```bash
   supabase db push --ignore-history
   # Note: This flag may not exist in your CLI version
   ```

## What Was Fixed

- ✅ Created `auth.is_admin()`, `auth.is_admin_or_manager()`, `auth.is_mechanic()` helper functions
- ✅ Fixed `app_users` RLS policies to prevent infinite recursion
- ✅ Updated all other table policies to use helper functions instead of direct queries

## Files Created

- `supabase/migrations/20251212194400_create_auth_helper_functions.sql` - Helper functions
- `supabase/migrations/20251212194500_fix_app_users_rls_recursion.sql` - app_users fix
- `supabase/MANUAL_APPLY_RLS_FIX.sql` - Combined SQL for manual application
- `supabase/UPDATE_MIGRATION_HISTORY.sql` - Updates migration history table

