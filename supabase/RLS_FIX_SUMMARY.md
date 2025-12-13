# RLS Infinite Recursion Fix - Implementation Summary

## Problem Fixed
The `app_users` table had RLS policies that queried `app_users` itself to check admin roles, causing infinite recursion errors: "infinite recursion detected in policy for relation app_users".

## Solution Implemented

### 1. Helper Functions Migration
**File**: `supabase/migrations/20251212194400_create_auth_helper_functions.sql`

Created SECURITY DEFINER functions to safely check user roles:
- `auth.is_admin()` - Returns true if current user is admin
- `auth.is_admin_or_manager()` - Returns true if current user is admin or manager  
- `auth.is_mechanic()` - Returns true if current user is mechanic

These functions use `SECURITY DEFINER` to bypass RLS when checking roles, preventing circular dependencies.

### 2. app_users Fix Migration
**File**: `supabase/migrations/20251212194500_fix_app_users_rls_recursion.sql`

Fixed `app_users` table policies:
- **Dropped ALL existing recursive policies**
- **Created simple, non-recursive policies**:
  - Users can SELECT their own record: `user_id = auth.uid()`
  - Users can INSERT their own record: `user_id = auth.uid()`
- **NO admin checks within app_users policies** (prevents recursion)
- Admin operations (UPDATE/DELETE) must use service role or SECURITY DEFINER functions

### 3. Updated Other Table Policies
**File**: `supabase/migrations/20251217000001_consolidate_rls_policies.sql`

Updated all other table policies to use helper functions instead of direct `app_users` queries:
- `job_progress_trackers` - All admin checks now use `auth.is_admin()`
- `job_crew_assignments` - All admin checks now use `auth.is_admin()`
- `job_milestones` - All admin checks now use `auth.is_admin()`
- `job_progress_updates` - All admin checks now use `auth.is_admin()`
- `rto_requests` - All admin checks now use `auth.is_admin()`

**Removed app_users section** - Now handled by the fix migration above.

### 4. Fixed Individual Table Migrations
Updated these migration files to use helper functions:
- `supabase/migrations/20251201170000_create_contact_requests.sql` - Uses `auth.is_admin()`
- `supabase/migrations/20251201120000_create_daily_equipment_inspections.sql` - Fixed bug (was using `au.id` instead of `au.user_id`), now uses `auth.is_admin()`
- `supabase/migrations/20251122072438_create_dvir_reports_table.sql` - Fixed bug (was using `au.id` instead of `au.user_id`), now uses `auth.is_admin()`

## Migration Order
The migrations are ordered correctly:
1. `20251212194400_create_auth_helper_functions.sql` - Creates helper functions (MUST be first)
2. `20251212194500_fix_app_users_rls_recursion.sql` - Fixes app_users policies
3. `20251217000001_consolidate_rls_policies.sql` - Updates other table policies using helper functions

## Verification

After applying migrations, run these queries in Supabase SQL Editor:

```sql
-- Check app_users policies (should NOT contain app_users queries)
SELECT tablename, policyname, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'app_users'
ORDER BY policyname;

-- Verify no recursion - should return empty (no policies query app_users)
SELECT policyname, qual::text
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'app_users'
  AND (qual::text LIKE '%app_users%');

-- Test: Can user fetch their own role? (should work)
SELECT role FROM public.app_users WHERE user_id = auth.uid();

-- Verify helper functions exist
SELECT proname, prosecdef, provolatile 
FROM pg_proc 
WHERE proname IN ('is_admin', 'is_admin_or_manager', 'is_mechanic')
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'auth');
```

## Prevention Rules

Going forward, enforce these rules:

1. **NEVER query a table within its own RLS policy**
2. **ALWAYS use SECURITY DEFINER functions for role checks** (`auth.is_admin()`, etc.)
3. **Place helper functions BEFORE table policies** in migration order
4. **Test policies** with: `SELECT * FROM table_name LIMIT 1;` as non-admin user
5. **Add comments** explaining policy logic in each migration

## Key Changes Summary

✅ **Created**: `20251212194400_create_auth_helper_functions.sql`
✅ **Created**: `20251212194500_fix_app_users_rls_recursion.sql`
✅ **Modified**: `20251217000001_consolidate_rls_policies.sql`
✅ **Modified**: `20251201170000_create_contact_requests.sql`
✅ **Modified**: `20251201120000_create_daily_equipment_inspections.sql`
✅ **Modified**: `20251122072438_create_dvir_reports_table.sql`

## No Policies Query Their Own Table

Confirmed: No RLS policies on `app_users` query `app_users` itself. All admin checks on other tables use `auth.is_admin()` helper function instead of direct queries.

