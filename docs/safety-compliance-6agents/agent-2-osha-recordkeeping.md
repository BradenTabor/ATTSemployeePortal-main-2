# Agent 2: OSHA Recordkeeping Suite (Form 301, 300A, ITA)

> **Include `_context.md` before reading this prompt.**

## Your Mission

Complete the OSHA recordkeeping system: fix Form 301 field gaps, build the 300A annual summary suite, and create ITA-compatible exports. This is the regulatory reporting backbone.

## Your Migration Timestamp Range

Use timestamps `20260216200000` through `20260216209999`.

## FILES YOU OWN (only modify these)

**You may create or modify:**
- `supabase/migrations/20260216200*` (your new migrations)
- `src/components/admin/IncidentLoggingModal.tsx` (add 301 fields, privacy case)
- `src/lib/osha300Export.ts` (update exports for new fields + ITA format)
- `src/pages/safety-officer/OSHA300ASummary.tsx` (new file)
- `src/types/osha*.ts` or equivalent type files for OSHA-related types (new files)
- `src/hooks/queries/useOSHA300A.ts` (new file)
- `src/components/safety/PostingReminder.tsx` (new file)
- `tests/unit/osha-*` (new test files)
- `tests/e2e/osha-*` (new test files)

**You may READ but NOT MODIFY:**
- `src/components/admin/SafetyIncidentsList.tsx` — read to understand the OSHA 300 preview, but Agent 1 owns modification of export audit logging there. You may add the privacy case name masking logic ONLY to the OSHA 300 preview rendering, not to the export function itself.
- `src/components/forms/SignaturePad.tsx` — read to understand the component API, reuse it
- All other source files

**COORDINATION NOTE:** Agent 1 is simultaneously fixing RLS policies on `safety_incidents`. Your column additions (migration) will not conflict because migrations are append-only and run in timestamp order. Agent 5 will later add duplicate detection to `IncidentLoggingModal.tsx` via a hook — they will import a hook you don't need to create. Just add the 301 fields and privacy case cleanly.

---

## Task 2A: Add Missing OSHA Form 301 Fields

**Problem:** 4 of 18 OSHA Form 301 mandatory fields are missing from `safety_incidents`: employee address, date of birth, sex, and date of death.

**Before coding, read:**
- `src/components/admin/IncidentLoggingModal.tsx` — understand the form structure, conditional field display pattern (recordable vs non-recordable), and submission handler
- The `safety_incidents` table schema (search migrations)
- `src/lib/osha300Export.ts` — understand current export field list
- The existing TypeScript type for safety incidents (search `src/types/` or grep for `SafetyIncident`)

**Implementation:**

1. **Migration** `supabase/migrations/20260216200000_add_form_301_fields.sql`:
   ```sql
   ALTER TABLE safety_incidents
     ADD COLUMN IF NOT EXISTS employee_street_address TEXT,
     ADD COLUMN IF NOT EXISTS employee_city TEXT,
     ADD COLUMN IF NOT EXISTS employee_state TEXT,
     ADD COLUMN IF NOT EXISTS employee_zip TEXT,
     ADD COLUMN IF NOT EXISTS employee_date_of_birth DATE,
     ADD COLUMN IF NOT EXISTS employee_sex TEXT CHECK (employee_sex IN ('male', 'female', 'non_binary', 'prefer_not_to_say')),
     ADD COLUMN IF NOT EXISTS date_of_death DATE,
     ADD COLUMN IF NOT EXISTS privacy_case BOOLEAN DEFAULT false;
   ```

2. **Update TypeScript type:** Find the `SafetyIncident` type (or equivalent) and add the new fields with proper types.

3. **Update `IncidentLoggingModal.tsx`:**
   - Add an "Employee Demographics" section after the existing employee selection.
   - Show `employee_street_address`, `employee_city`, `employee_state`, `employee_zip`, `employee_date_of_birth`, `employee_sex` conditionally when the incident is marked recordable. Follow the exact same conditional display pattern the form already uses for other recordable-only fields.
   - Show `date_of_death` only when `severity = 'fatality'`.
   - Auto-populate from `app_users` profile data where possible (address, DOB). If `app_users` doesn't have these fields, leave them as manual entry.
   - State field: use a dropdown with US state abbreviations.
   - Sex field: radio buttons — Male, Female, Non-binary, Prefer not to say.

4. **Update `get_incident_log_osha_300_301` RPC:**
   - Create migration `supabase/migrations/20260216200001_update_osha_rpc.sql`
   - ALTER the existing RPC (or CREATE OR REPLACE) to include all new columns in the SELECT.

5. **Update `exportOsha300Csv()`** in `src/lib/osha300Export.ts`:
   - Add new fields to the 301 CSV export columns.
   - For the 300 Log export: when `privacy_case = true`, replace employee name with "Privacy Case".

**Done when:**
- [ ] Migration adds all 7 new columns + privacy_case to safety_incidents
- [ ] TypeScript type is updated with all new fields
- [ ] IncidentLoggingModal shows demographics for recordable incidents
- [ ] date_of_death appears only for fatality severity
- [ ] Auto-populate from app_users works (or manual entry if profile lacks data)
- [ ] RPC returns new columns
- [ ] CSV exports include new fields
- [ ] Privacy case masks employee name in 300 export
- [ ] `npm run typecheck` passes

---

## Task 2B: Build OSHA 300A Annual Summary RPC

**Problem:** No 300A generation function exists. OSHA requires annual summary with aggregate totals.

**Before coding, read:**
- `src/lib/osha300Export.ts` — understand existing OSHA data queries
- The `safety_incidents` table schema to identify which columns map to 300A aggregates
- Search for `determineOshaReportable` to understand recordability classification

**Implementation:**

1. **Migration** `supabase/migrations/20260216200002_osha_300a_system.sql`:
   ```sql
   -- 300A summary RPC
   CREATE OR REPLACE FUNCTION get_osha_300a_summary(
     p_year INTEGER,
     p_total_employees_avg NUMERIC DEFAULT NULL,
     p_total_hours_worked NUMERIC DEFAULT NULL
   )
   RETURNS JSONB AS $$
   DECLARE
     result JSONB;
   BEGIN
     SELECT jsonb_build_object(
       'year', p_year,
       'total_recordable_cases', COUNT(*) FILTER (WHERE osha_reportable = true),
       'cases_days_away', COUNT(*) FILTER (WHERE severity IN ('lost_time', 'fatality') AND days_away_from_work > 0),
       'cases_job_transfer', COUNT(*) FILTER (WHERE days_restricted > 0),
       'other_recordable', COUNT(*) FILTER (WHERE osha_reportable = true AND severity = 'recordable'),
       'total_days_away', COALESCE(SUM(days_away_from_work) FILTER (WHERE osha_reportable = true), 0),
       'total_days_restricted', COALESCE(SUM(days_restricted) FILTER (WHERE osha_reportable = true), 0),
       'total_injuries', COUNT(*) FILTER (WHERE osha_reportable = true AND injury_illness_type LIKE '%injury%'),
       'total_illnesses', COUNT(*) FILTER (WHERE osha_reportable = true AND injury_illness_type LIKE '%illness%'),
       'death_count', COUNT(*) FILTER (WHERE severity = 'fatality'),
       'total_employees_avg', p_total_employees_avg,
       'total_hours_worked', p_total_hours_worked
     ) INTO result
     FROM safety_incidents
     WHERE EXTRACT(YEAR FROM incident_date) = p_year;

     RETURN result;
   END;
   $$ LANGUAGE plpgsql SECURITY DEFINER;
   ```
   **IMPORTANT:** Verify the column names (`osha_reportable`, `severity`, `days_away_from_work`, `days_restricted`, `injury_illness_type`) against the actual `safety_incidents` schema. Adjust the query to match real column names.

2. **Certification table:**
   ```sql
   CREATE TABLE osha_300a_certifications (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     year INTEGER NOT NULL UNIQUE,
     certified_by_name TEXT NOT NULL,
     certified_by_title TEXT NOT NULL,
     certified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     signature TEXT NOT NULL,
     total_employees_avg NUMERIC,
     total_hours_worked NUMERIC,
     summary_data JSONB NOT NULL,
     posted_date DATE,
     created_at TIMESTAMPTZ DEFAULT now()
   );

   ALTER TABLE osha_300a_certifications ENABLE ROW LEVEL SECURITY;

   CREATE POLICY osha_300a_admin_select ON osha_300a_certifications
     FOR SELECT USING (is_admin() OR current_setting('request.jwt.claims')::jsonb->>'role' = 'safety_officer');
   CREATE POLICY osha_300a_admin_insert ON osha_300a_certifications
     FOR INSERT WITH CHECK (is_admin() OR current_setting('request.jwt.claims')::jsonb->>'role' = 'safety_officer');
   CREATE POLICY osha_300a_admin_update ON osha_300a_certifications
     FOR UPDATE USING (is_admin() OR current_setting('request.jwt.claims')::jsonb->>'role' = 'safety_officer');
   -- No DELETE policy — certifications are permanent records
   ```
   **IMPORTANT:** Check how other RLS policies reference the safety_officer role. If there's a helper like `is_safety_officer()`, use that instead of the raw JWT check. Match the existing pattern.

3. Add INSERT/UPDATE audit triggers on `osha_300a_certifications` following the existing audit trigger pattern.

**Done when:**
- [ ] RPC function exists and returns correct aggregate structure
- [ ] Certification table exists with RLS (no DELETE policy)
- [ ] Audit triggers exist on certification table
- [ ] `npm run typecheck` passes

---

## Task 2C: Build 300A Summary Page

**Before coding, read:**
- `src/pages/safety-officer/SafetyOfficerDashboard.tsx` — understand routing and layout patterns
- `src/components/forms/SignaturePad.tsx` — understand the signature component API
- How the app registers new routes (check router config, likely in `src/App.tsx` or a routes file)

**Implementation:**

1. **Create hook** `src/hooks/queries/useOSHA300A.ts`:
   - `useOSHA300ASummary(year)` — calls the RPC, returns typed data
   - `useCertify300A()` — mutation to insert into `osha_300a_certifications`
   - `use300ACertification(year)` — query to check if year is already certified

2. **Create page** `src/pages/safety-officer/OSHA300ASummary.tsx`:
   - Year selector dropdown (default: previous calendar year).
   - Summary display with all 300A fields pre-populated from the RPC.
   - Manual input fields for `total_employees_avg` and `total_hours_worked` (these aren't tracked in the system).
   - "Certify" button opening a modal with:
     - Company executive name and title (text inputs)
     - Certification date (auto-filled today, editable)
     - Digital signature using existing `SignaturePad` component
     - Checkbox: "I certify that I have examined the OSHA 300 Log and that to the best of my knowledge the annual summary is correct and complete."
   - If year is already certified, show the certification details and disable re-certification.
   - PDF generation button using jsPDF matching OSHA 300A layout.
   - CSV export button generating ITA-compatible format.

3. **Create type definitions** in `src/types/osha300a.ts`:
   ```typescript
   export interface OSHA300ASummary {
     year: number;
     total_recordable_cases: number;
     cases_days_away: number;
     cases_job_transfer: number;
     other_recordable: number;
     total_days_away: number;
     total_days_restricted: number;
     total_injuries: number;
     total_illnesses: number;
     death_count: number;
     total_employees_avg: number | null;
     total_hours_worked: number | null;
   }

   export interface OSHA300ACertification {
     id: string;
     year: number;
     certified_by_name: string;
     certified_by_title: string;
     certified_at: string;
     signature: string;
     total_employees_avg: number | null;
     total_hours_worked: number | null;
     summary_data: OSHA300ASummary;
     posted_date: string | null;
   }
   ```

4. **Register the route** in the app's router configuration. Make it accessible to `admin` and `safety_officer` roles.

**Done when:**
- [ ] Route `/safety-officer/osha-300a` (or equivalent) is accessible
- [ ] Year selector loads summary from RPC
- [ ] Manual fields for employees/hours work
- [ ] Certification modal with signature pad works
- [ ] Certification persists to `osha_300a_certifications`
- [ ] PDF export generates 300A-formatted document
- [ ] CSV export generates ITA-compatible format
- [ ] Already-certified years show read-only view
- [ ] `npm run typecheck` passes

---

## Task 2D: 300A Posting Reminder

**Implementation:**

1. **Create component** `src/components/safety/PostingReminder.tsx`:
   - Query `osha_300a_certifications` for the current posting year.
   - Between Feb 1 and Apr 30: show a banner — "OSHA 300A Summary for [year] must be posted in a conspicuous location. Has it been posted?"
   - "Mark as Posted" button that updates `posted_date` on the certification record.
   - If already posted, show confirmation: "300A posted on [date]."
   - Outside Feb 1–Apr 30: show nothing.
   - If no certification exists for the relevant year: show warning — "300A for [year] has not been certified yet."
   - Use `date-fns-tz` with `America/Chicago` for date comparisons.

2. This component will be imported by Agent 6 into the Safety Officer Dashboard. Just create it as a self-contained component with its own data fetching.

**Done when:**
- [ ] Component renders correct banner between Feb 1–Apr 30
- [ ] "Mark as Posted" updates the certification record
- [ ] Shows nothing outside the posting period
- [ ] Warns if no certification exists
- [ ] Component is self-contained (own data fetching, own hooks)
- [ ] `npm run typecheck` passes

---

## Task 2E: ITA-Compatible CSV Export

**Before coding, read:**
- Search for OSHA ITA (Injury Tracking Application) CSV format documentation online if needed
- `src/lib/osha300Export.ts` — existing CSV export structure

**Implementation:**

1. Add `exportOSHA300AITA(year)` function to `src/lib/osha300Export.ts`:
   - Generate CSV matching the exact OSHA ITA submission schema for 300A data.
   - Include all required ITA fields with correct column headers.
   - Validate field formats before export (e.g., establishment size, NAICS code, state).

2. Add `exportOSHA300ITA()` and `exportOSHA301ITA()` functions:
   - Match ITA schema for 300 Log and 301 individual records.
   - Include all 18 Form 301 fields (including the 4 new ones from Task 2A).

3. Wire all three ITA exports into the 300A Summary page as additional export buttons.

**Done when:**
- [ ] Three ITA export functions exist (300A, 300, 301)
- [ ] CSV format matches OSHA ITA schema
- [ ] All 18 Form 301 fields included in 301 ITA export
- [ ] Export buttons accessible from 300A Summary page
- [ ] `npm run typecheck` passes

---

## Task 2F: Write OSHA Recordkeeping Tests

**Implementation:**

1. `tests/unit/osha-300a-summary.test.ts`:
   - Test that `get_osha_300a_summary` RPC returns correct aggregate structure
   - Test with zero incidents, with mixed severities, with fatalities
   - Test privacy case name masking in 300 export

2. `tests/unit/osha-form-301.test.ts`:
   - Test that all 18 Form 301 fields are present in the export
   - Test conditional field display (demographics only for recordable, death date only for fatality)

3. `tests/e2e/osha-300a.spec.ts`:
   - Test 300A page loads with year selector
   - Test certification flow (fill form, sign, certify)
   - Test PDF and CSV export buttons function

**Done when:**
- [ ] Test files exist with meaningful coverage
- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
