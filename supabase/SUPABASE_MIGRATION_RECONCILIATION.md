# Supabase Migration History Reconciliation

## Issue Summary

**Date**: 2025-12-18  
**Affected Version**: `20251212`

The Supabase CLI was failing with:
- `supabase db pull` - "The remote database's migration history does not match local files"
- `supabase db push` - "Remote migration versions not found in local migrations directory"

The `supabase migration list` showed a split row for version `20251212`:
```
                 | 20251212       | 20251212            <- Remote-only
   20251212       |                | 20251212            <- Local-only
```

## Root Cause

The original migration file used a **short version format** (`20251212_add_span_progress_estimates.sql`) while the CLI's repair command was creating remote entries that didn't properly align with the local file.

The issue was a **version format mismatch**:
- Short format: `20251212` (date only)
- Timestamp format: `20251212194400` (date + time)

When multiple migrations shared the same date prefix, the short format caused ordering and matching issues.

## Resolution

### What Was Changed

1. **Renamed migration file** to use timestamp format:
   - From: `20251212_add_span_progress_estimates.sql`
   - To: `20251212000000_add_span_progress_estimates.sql`

2. **Repaired remote migration history**:
   ```bash
   supabase migration repair --status reverted 20251212
   supabase migration repair --status applied 20251212000000
   ```

### Files Modified

- `supabase/migrations/20251212000000_add_span_progress_estimates.sql` (renamed from `20251212_add_span_progress_estimates.sql`)

## Validation

After reconciliation:

```bash
# All migrations aligned (no split rows)
supabase migration list

# Succeeds
supabase db push
# Output: "Remote database is up to date."
```

## Prevention Guidelines

### DO

1. **Use full timestamp format** for all new migrations: `YYYYMMDDHHmmss_name.sql`
   - Example: `20251218143000_add_new_feature.sql`

2. **Use `supabase migration new`** to generate migrations:
   ```bash
   supabase migration new add_new_feature
   ```
   This automatically uses the correct timestamp format.

3. **Verify alignment** before pushing:
   ```bash
   supabase migration list
   # Check: All rows should show matching Local and Remote columns
   ```

### DO NOT

1. **Never edit applied migration SQL content** - This will cause checksum mismatches.

2. **Never use short date format** (e.g., `20251212_name.sql`) when other migrations exist for the same date with timestamps.

3. **Never run `supabase db reset`** against production - This drops and recreates everything.

4. **Never delete rows** from `supabase_migrations.schema_migrations` directly unless you fully understand the implications.

## Troubleshooting Future Issues

If you see split rows in `supabase migration list`:

1. **Identify the mismatch type** using debug mode:
   ```bash
   supabase migration list --debug
   ```

2. **Clear orphaned remote entries**:
   ```bash
   supabase migration repair --status reverted <version>
   ```

3. **Re-apply with correct version** (after ensuring local file has correct name):
   ```bash
   supabase migration repair --status applied <version>
   ```

4. **If the file format is wrong**, rename the local file to use timestamp format, then repair.

## Reference

- [Supabase Migration CLI Docs](https://supabase.com/docs/guides/cli/migrations)
- [Migration Repair Command](https://supabase.com/docs/reference/cli/supabase-migration-repair)
