# Data Retention (Safety Compliance)

## Overview

The `data_retention_policies` table and `run_data_retention()` function implement configurable retention for compliance records. Records older than the configured retention period are deleted (no archive table in Phase 1).

## Default Policies

| Table | Date Column | Retention |
|-------|-------------|-----------|
| `dvir_reports` | `report_date` | 90 days (49 CFR 396.3) |
| `daily_jsa` | `job_date` | 365 days |
| `daily_equipment_inspections` | `inspection_date` | 365 days |
| `safety_incidents` | `incident_date` | 5 years / 1825 days (OSHA 1904.33) |

## Running Retention

**Manual (Supabase SQL):**
```sql
SELECT * FROM public.run_data_retention();
-- Returns: table_name, deleted_count per table.
```

**Schedule (pg_cron):** Migration `20260229180000_schedule_data_retention_cron.sql` schedules `run_data_retention` daily at 03:00 UTC. Apply migrations to enable.

**Edge Function (alternative):** Create a scheduled Edge Function that calls Supabase with the service role and executes `SELECT * FROM run_data_retention();` (e.g. via `supabase.rpc('run_data_retention')` or raw SQL).

## Changing Retention

Update `data_retention_policies`:
```sql
UPDATE public.data_retention_policies
SET retention_days = 180
WHERE table_name = 'daily_jsa';
```

Disable for a table:
```sql
UPDATE public.data_retention_policies
SET enabled = false
WHERE table_name = 'daily_equipment_inspections';
```

## Notes

- Retention uses `America/Chicago` for cutoff date.
- Only enabled policies are applied. Tables and columns are validated at run time.
- Phase 1 does not move data to an archive table; future work can add `archive_table_name` and COPY then DELETE.
