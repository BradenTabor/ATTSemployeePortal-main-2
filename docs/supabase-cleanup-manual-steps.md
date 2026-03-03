# Supabase Cleanup — Manual Steps

After applying migrations `20260219200000` through `20260219200005`, complete the following manually.

## 1. Tier A index drops (Phase 5)

Run the statements in **scripts/manual_drop_tier_a_indexes.sql** one at a time in the Supabase SQL Editor (or via `psql`).  
`DROP INDEX CONCURRENTLY` cannot run inside a transaction, so these are not in a migration.

## 2. Leaked password protection (Phase 8)

- In **Supabase Dashboard**: **Auth → Settings → Password Security**
- Enable **Leaked password protection**

This only affects **new sign-ups and password changes**. It does not retroactively check existing passwords.

## 3. (Recommended) Test on a branch first

Apply all migrations to a Supabase branch database and run the app against it before running on production.
