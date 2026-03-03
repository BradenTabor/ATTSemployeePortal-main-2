# Agent 1: Security & Data Integrity

> **Include `_context.md` before reading this prompt.**

## Your Mission

Fix all zero-tolerance security and data integrity violations found in the safety compliance audit. These are foundational — other agents depend on the data layer being trustworthy.

## Your Migration Timestamp Range

Use timestamps `20260216100000` through `20260216109999` for your migrations. This avoids collisions with other agents.

## FILES YOU OWN (only modify these)

**You may create or modify:**
- `supabase/migrations/20260216100*` (your new migrations)
- `src/lib/safetyAuditLog.ts` (wire dead code)
- `src/lib/osha300Export.ts` (add audit log call to export functions)
- `src/components/admin/ComplianceDataExportPanel.tsx` (add audit log calls)
- `src/components/admin/SafetyIncidentsList.tsx` (add audit log call to OSHA 300 export button ONLY — do not modify the list UI)
- `tests/unit/rls-policies.test.ts` (add or extend)
- `tests/unit/audit-trail.test.ts` (new file)
- Any new test files in `tests/unit/` prefixed with `security-` or `audit-`

**You may READ but NOT MODIFY:**
- All other source files (for understanding patterns)

---

## Task 1A: Fix `safety_incidents` Admin DELETE Vulnerability

**Problem:** The `safety_incidents_admin_all` RLS policy uses `FOR ALL` which grants DELETE to admins. This violates OSHA 29 CFR 1904.33 (5-year retention). An admin can permanently destroy legally required records.

**Before coding, read:**
- The existing migration that creates `safety_incidents` RLS policies (search `supabase/migrations/` for `safety_incidents`)
- `tests/unit/rls-policies.test.ts` to understand the test pattern

**Implementation:**
1. Create migration `supabase/migrations/20260216100000_fix_safety_incidents_delete.sql`.
2. DROP the existing `safety_incidents_admin_all` policy.
3. Create three replacement policies:
   ```sql
   CREATE POLICY safety_incidents_admin_select ON safety_incidents
     FOR SELECT USING (is_admin());
   CREATE POLICY safety_incidents_admin_insert ON safety_incidents
     FOR INSERT WITH CHECK (is_admin());
   CREATE POLICY safety_incidents_admin_update ON safety_incidents
     FOR UPDATE USING (is_admin());
   ```
4. Do NOT create a DELETE policy for any role.
5. Add: `COMMENT ON TABLE safety_incidents IS 'OSHA 5-year retention required (29 CFR 1904.33). DELETE intentionally blocked at RLS level.';`
6. Also check if any OTHER roles (safety_officer, general_foreman, foreman) have `FOR ALL` policies on this table. If so, split those the same way.

**Done when:**
- [ ] Migration file exists and is valid SQL
- [ ] `safety_incidents_admin_all` policy is dropped
- [ ] Three separate SELECT/INSERT/UPDATE policies exist
- [ ] No DELETE policy exists on `safety_incidents` for any role
- [ ] Comment exists on the table
- [ ] Test in `rls-policies.test.ts` confirms DELETE rejection for admin role (add test even if file is currently skipped due to service role key requirement — annotate clearly)

---

## Task 1B: Wire `logReportExported()` Into All Export Functions

**Problem:** `logReportExported()` in `src/lib/safetyAuditLog.ts` is defined but never called anywhere. Every CSV/PDF/Excel export of compliance data is completely unaudited.

**Before coding, read:**
- `src/lib/safetyAuditLog.ts` — understand the function signature and what it logs
- `src/lib/osha300Export.ts` — find `exportOsha300Csv()` and any other export functions
- `src/components/admin/ComplianceDataExportPanel.tsx` — find all export trigger handlers
- `src/components/admin/SafetyIncidentsList.tsx` — find the OSHA 300 export button handler
- Search the entire `src/` directory for any other export functions (grep for `export.*Csv`, `export.*Pdf`, `export.*Excel`, `DataExporter`, `download`, `blob`)

**Implementation:**
1. In every export function you find, add `logReportExported()` after the successful export completes.
2. Each call must include:
   - `reportType`: e.g., `"osha_300"`, `"osha_301"`, `"dvir_history"`, `"equipment_csv"`, `"compliance_data"`
   - `format`: `"csv"`, `"pdf"`, or `"xlsx"`
   - `metadata`: object with `{ dateRangeStart, dateRangeEnd, recordCount }` where available
3. Wrap every `logReportExported()` call in try/catch. A failed audit log write must NOT block the export. Log the error to console.error with context.
4. Do NOT modify the export logic itself — only add the audit log call after success.

**Done when:**
- [ ] Every export function in the codebase calls `logReportExported()` after success
- [ ] Each call passes reportType, format, and metadata
- [ ] Each call is wrapped in try/catch that does not block the export
- [ ] `npm run typecheck` passes
- [ ] No remaining calls to any export function lack an accompanying audit log call (grep to verify)

---

## Task 1C: Block Equipment Inspection `user_id` Modification

**Problem:** Admin/mechanic UPDATE policy on `daily_equipment_inspections` allows modifying `user_id`, which breaks the audit trail. The original inspector can be changed after the fact.

**Implementation:**
1. Create migration `supabase/migrations/20260216100001_protect_equipment_user_id.sql`.
2. Add a trigger:
   ```sql
   CREATE OR REPLACE FUNCTION prevent_equipment_user_id_change()
   RETURNS TRIGGER AS $$
   BEGIN
     IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
       RAISE EXCEPTION 'Cannot modify user_id on submitted inspection records (audit trail protection)';
     END IF;
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql;

   CREATE TRIGGER enforce_equipment_user_id_immutability
     BEFORE UPDATE ON daily_equipment_inspections
     FOR EACH ROW
     EXECUTE FUNCTION prevent_equipment_user_id_change();
   ```
3. Check if the same vulnerability exists on `dvir_reports` and `daily_jsa`. If those tables also allow admin UPDATE of `user_id`, add the same trigger pattern for them in this migration.

**Done when:**
- [ ] Migration file exists with the trigger
- [ ] Trigger fires BEFORE UPDATE and blocks `user_id` changes
- [ ] Same protection added to `dvir_reports` and `daily_jsa` if needed
- [ ] `npm run typecheck` passes

---

## Task 1D: Add Audit Triggers to `certification_records`

**Problem:** Certification issuance, revocation, and changes are not captured in `safety_audit_log`. Every other safety table has audit triggers — this one was missed.

**Before coding, read:**
- An existing migration that creates audit triggers for another safety table (e.g., search for `safety_audit_log` in migrations to find the INSERT/UPDATE trigger pattern)

**Implementation:**
1. Create migration `supabase/migrations/20260216100002_cert_records_audit_triggers.sql`.
2. Add INSERT and UPDATE triggers on `certification_records` that write to `safety_audit_log`.
3. Follow the exact same pattern used by `dvir_reports` triggers. Capture: `id`, `op` (INSERT/UPDATE), `user_id`, `certification_type`, `status`, `changed_at` in the payload.

**Done when:**
- [ ] Migration file exists
- [ ] INSERT trigger on `certification_records` writes to `safety_audit_log`
- [ ] UPDATE trigger on `certification_records` writes to `safety_audit_log`
- [ ] Payload includes id, op, user_id, certification_type, status
- [ ] Pattern matches existing audit triggers exactly

---

## Task 1E: Fix `run_data_retention()` Hard DELETE (No Audit Trail)

**Problem:** `run_data_retention()` performs hard DELETE with zero audit trail. Records vanish permanently with no log of what was deleted.

**Before coding, read:**
- The migration or function definition for `run_data_retention()` (search migrations for `data_retention` or `run_data_retention`)
- The `data_retention_policies` table schema — note the `archive_table_name` column that exists but is unused

**Implementation:**
1. Create migration `supabase/migrations/20260216100003_retention_audit_trail.sql`.
2. Modify `run_data_retention()` to INSERT a summary row into `safety_audit_log` BEFORE each DELETE batch:
   ```sql
   INSERT INTO safety_audit_log (event_type, table_name, payload)
   VALUES (
     'data_retention_delete',
     target_table,
     jsonb_build_object(
       'records_deleted', delete_count,
       'date_range_start', oldest_record_date,
       'date_range_end', newest_deleted_date,
       'retention_policy_days', retention_days,
       'executed_at', now()
     )
   );
   ```
3. Implement the archive flow using the existing `archive_table_name` column:
   - For each retention policy where `archive_table_name` is set, create the archive table if it doesn't exist (same schema as source).
   - INSERT records into the archive table before DELETE from the source.
   - If `archive_table_name` is NULL, just log and delete (no archive).

**Done when:**
- [ ] Modified `run_data_retention()` logs deletions to `safety_audit_log` before deleting
- [ ] Log entry includes: table name, record count, date range, retention policy, timestamp
- [ ] Archive flow implemented for tables with `archive_table_name` set
- [ ] Existing behavior unchanged for tables without archive_table_name
- [ ] `npm run typecheck` passes

---

## Task 1F: Write Security Tests

**Implementation:**
1. Create `tests/unit/security-audit-trail.test.ts`:
   - Test that `logReportExported()` creates an entry in `safety_audit_log` with correct fields
   - Test that a failed `logReportExported()` call does not throw (is caught)
2. Extend `tests/unit/rls-policies.test.ts`:
   - Test DELETE rejection on `safety_incidents` for admin, safety_officer, and employee roles
   - Test that `user_id` change is blocked on `daily_equipment_inspections`
   - Annotate tests that require service role key with `it.skip` and a clear comment

**Done when:**
- [ ] Test files exist with meaningful test cases
- [ ] `npm run test` passes (new tests pass or are properly skipped with annotation)
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes (or only has pre-existing lint errors)
