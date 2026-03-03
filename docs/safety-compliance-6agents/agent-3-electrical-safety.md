# Agent 3: Electrical Safety & Worker Qualifications

> **Include `_context.md` before reading this prompt.**

## Your Mission

Build the electrical safety system: worker qualification registry, conditional electrical hazard JSA section with MAD lookup, and LOTO verification. Electrocution is the #2 cause of tree care fatalities — this is life-safety work.

## Your Migration Timestamp Range

Use timestamps `20260216300000` through `20260216309999`.

## FILES YOU OWN (only modify these)

**You may create or modify:**
- `supabase/migrations/20260216300*` (your new migrations)
- `src/components/forms/JsaWizard.tsx` (add electrical hazard conditional section)
- `src/hooks/jsa/useJSAFormValidation.ts` (add electrical field validation rules)
- `src/data/madReferenceTable.ts` (new file — MAD lookup data)
- `src/components/forms/ElectricalHazardSection.tsx` (new file)
- `src/components/forms/LOTOSection.tsx` (new file)
- `src/hooks/jsa/useElectricalHazards.ts` (new file)
- `src/pages/admin/WorkerQualifications.tsx` (new file — admin qualification management)
- `src/hooks/queries/useWorkerQualifications.ts` (new file)
- `src/types/electrical*.ts` (new type files)
- `tests/unit/electrical-*` (new test files)
- `tests/e2e/electrical-*` (new test files)

**You may READ but NOT MODIFY:**
- `src/pages/forms/DailyJSAForm.tsx` — read to understand how wizard steps are composed
- `src/hooks/jsa/useJSASubmission.ts` — read to understand submission flow
- `src/components/forms/SignaturePad.tsx`, `ValidationSummary.tsx` — reuse these
- All other files — for pattern reference only

**COORDINATION NOTE:** Agent 4 is modifying `TreeFellingJSAForm.tsx` (completely separate form) and `DailyEquipmentInspectionForm.tsx`. You modify the Daily JSA wizard — no file conflict. Agent 6 will import your qualification badge component into the SO dashboard.

---

## Task 3A: Worker Qualification Level Registry

**Problem:** No 3-tier electrical qualification tracking exists. OSHA 29 CFR 1910.269(r) requires distinguishing between unqualified employees, line-clearance tree trimmers, and 269-qualified employees.

**Before coding, read:**
- `app_users` table schema (search migrations for `app_users` or `create_app_users`)
- `src/hooks/useCertifications.ts` — understand the certification system
- `certification_records` table schema
- Any admin user management UI that exists (search for user management, employee list, etc.)

**Implementation:**

1. **Migration** `supabase/migrations/20260216300000_worker_qualification_registry.sql`:
   ```sql
   -- Add qualification level to users
   ALTER TABLE app_users
     ADD COLUMN IF NOT EXISTS electrical_qualification_level TEXT
       CHECK (electrical_qualification_level IN ('unqualified', 'line_clearance_tree_trimmer', 'qualified_269'))
       DEFAULT 'unqualified';

   -- Add qualification history tracking
   ALTER TABLE app_users
     ADD COLUMN IF NOT EXISTS electrical_qualification_date DATE,
     ADD COLUMN IF NOT EXISTS electrical_qualification_verified_by UUID REFERENCES app_users(id);

   COMMENT ON COLUMN app_users.electrical_qualification_level IS 'OSHA 1910.269(r) 3-tier: unqualified, line-clearance tree trimmer, 269-qualified';
   ```

2. **Create types** `src/types/electricalQualification.ts`:
   ```typescript
   export type ElectricalQualificationLevel =
     | 'unqualified'
     | 'line_clearance_tree_trimmer'
     | 'qualified_269';

   export interface WorkerQualification {
     user_id: string;
     full_name: string;
     electrical_qualification_level: ElectricalQualificationLevel;
     electrical_qualification_date: string | null;
     electrical_qualification_verified_by: string | null;
   }

   export const QUALIFICATION_LABELS: Record<ElectricalQualificationLevel, string> = {
     unqualified: 'Unqualified',
     line_clearance_tree_trimmer: 'Line-Clearance Tree Trimmer',
     qualified_269: 'Qualified (1910.269)',
   };
   ```

3. **Create hook** `src/hooks/queries/useWorkerQualifications.ts`:
   - `useWorkerQualifications()` — fetch all users with qualification levels (admin/SO/GF only)
   - `useUpdateQualification()` — mutation to change a user's level
   - `useCrewQualifications(userIds: string[])` — fetch qualification levels for a set of users (for JSA crew verification)

4. **Create admin page** `src/pages/admin/WorkerQualifications.tsx`:
   - Table of all employees with columns: Name, Current Role, Electrical Qualification, Qualification Date, Verified By.
   - Inline edit: click qualification level to change it via dropdown.
   - On change: record who made the change and when.
   - Also add a certification record entry in `certification_records` with `cert_type = 'electrical_qualification'` to maintain history.
   - Filterable by qualification level.

5. **Create a reusable badge component** `src/components/ui/QualificationBadge.tsx`:
   - Displays the qualification level with color coding (red = unqualified, yellow = line-clearance, green = 269-qualified).
   - Accepts a `level: ElectricalQualificationLevel` prop.
   - Export for use by other agents (Agent 6 will use this on the dashboard).

6. **Register the route** for the admin page. Accessible to `admin` and `safety_officer` roles.

**Done when:**
- [ ] Migration adds qualification columns to app_users
- [ ] Type definitions exist with all qualification levels
- [ ] Hook fetches and updates qualifications
- [ ] Admin page shows all employees with inline qualification editing
- [ ] Changes create certification_records entries for history
- [ ] Badge component is reusable and exported
- [ ] Route registered and accessible
- [ ] `npm run typecheck` passes

---

## Task 3B: MAD Reference Table

**Problem:** No Minimum Approach Distance data exists in the system. This is critical for electrical safety JSA documentation.

**Implementation:**

1. **Create** `src/data/madReferenceTable.ts`:
   ```typescript
   /**
    * Minimum Approach Distances from OSHA 1910.269 Table R-6 and R-7.
    *
    * IMPORTANT: These values must be verified by a qualified person
    * against the current CFR text before production use.
    *
    * Last verified: [DATE YOU VERIFY]
    * Source: 29 CFR 1910.269 Table R-6 (AC), Table R-7 (DC)
    */

   export interface MADEntry {
     voltageRangeKV: { min: number; max: number };
     label: string;
     phaseToGround: string;  // e.g., "2 ft 2 in"
     phaseToPhase: string;   // e.g., "2 ft 3 in"
     phaseToGroundMeters: number;  // for calculations
     phaseToPhaseMeters: number;
   }

   export const MAD_TABLE: MADEntry[] = [
     {
       voltageRangeKV: { min: 0.05, max: 1.0 },
       label: '50V – 1.0kV',
       phaseToGround: 'Avoid contact',
       phaseToPhase: 'Avoid contact',
       phaseToGroundMeters: 0,
       phaseToPhaseMeters: 0,
     },
     {
       voltageRangeKV: { min: 1.1, max: 15.0 },
       label: '1.1kV – 15.0kV',
       phaseToGround: '2 ft 2 in',
       phaseToPhase: '2 ft 3 in',
       phaseToGroundMeters: 0.66,
       phaseToPhaseMeters: 0.69,
     },
     // Continue for ALL voltage ranges...
     // 15.1-36.0, 36.1-46.0, 46.1-72.5, 72.6-121,
     // 138-145, 161-169, 230-242, 345-362, 500-550, 765-800
   ];

   export function lookupMAD(voltageKV: number): MADEntry | null {
     return MAD_TABLE.find(
       entry => voltageKV >= entry.voltageRangeKV.min && voltageKV <= entry.voltageRangeKV.max
     ) ?? null;
   }

   export const COMMON_VOLTAGES: { label: string; kv: number }[] = [
     { label: '120V', kv: 0.12 },
     { label: '240V', kv: 0.24 },
     { label: '480V', kv: 0.48 },
     { label: '4.8kV', kv: 4.8 },
     { label: '7.2kV', kv: 7.2 },
     { label: '12.47kV', kv: 12.47 },
     { label: '23kV', kv: 23 },
     { label: '34.5kV', kv: 34.5 },
     { label: '69kV', kv: 69 },
     { label: '115kV', kv: 115 },
     { label: '138kV', kv: 138 },
     { label: '230kV', kv: 230 },
     { label: '345kV', kv: 345 },
     { label: '500kV', kv: 500 },
     { label: '765kV', kv: 765 },
     { label: 'Unknown — contact utility', kv: -1 },
   ];
   ```

2. **CRITICAL:** Before hardcoding the MAD values, cross-reference each voltage range against the actual OSHA 1910.269 Table R-6 (for AC) and Table R-7 (for DC). The values in the audit report may have rounding. Use the exact CFR values. Add a code comment with the verification date.

**Done when:**
- [ ] MAD table file exists with all voltage ranges
- [ ] `lookupMAD()` returns correct entry for any input voltage
- [ ] COMMON_VOLTAGES covers typical tree-care scenarios
- [ ] Code comment documents verification source and date
- [ ] `npm run typecheck` passes

---

## Task 3C: Electrical Hazard JSA Conditional Section

**Problem:** When `hazardsPresent.lines_energized = true` in the JSA, there are no fields for voltage, MAD, qualification verification, utility contact, or second-worker requirement. These are all required by OSHA 1910.269.

**Before coding, read:**
- `src/components/forms/JsaWizard.tsx` — understand the wizard step architecture, how steps are conditionally rendered, how data flows between steps
- `src/hooks/jsa/useJSAFormValidation.ts` — understand how validation rules are structured
- `src/pages/forms/DailyJSAForm.tsx` — understand how the wizard is composed and submitted
- The JSA `hazardsPresent` field structure (find where the 9 hazard items are defined)

**Implementation:**

1. **Migration** `supabase/migrations/20260216300001_jsa_electrical_data.sql`:
   ```sql
   ALTER TABLE daily_jsa
     ADD COLUMN IF NOT EXISTS electrical_hazard_data JSONB;

   COMMENT ON COLUMN daily_jsa.electrical_hazard_data IS 'OSHA 1910.269 electrical safety data. Required when electrical hazards identified.';
   ```

2. **Create type** in `src/types/electricalHazard.ts`:
   ```typescript
   export interface ElectricalHazardData {
     voltage_kv: number;
     voltage_label: string;
     mad_phase_to_ground: string;
     mad_phase_to_phase: string;
     utility_company_contacted: boolean;
     utility_company_name: string;
     utility_contact_name: string;
     utility_confirmation_time: string;
     crew_qualifications_verified: boolean;
     crew_qualification_issues: string[];  // names of unqualified workers
     second_worker_required: boolean;  // true when voltage > 750V
     second_worker_name: string;
     loto_required: boolean;
     loto_procedure_followed: boolean;
     loto_authorized_employee: string;
   }
   ```

3. **Create component** `src/components/forms/ElectricalHazardSection.tsx`:
   - This is a self-contained section that activates when ANY electrical hazard is selected in the JSA (`lines_energized`, `secondary_voltage`, or `open_wire_secondary`).
   - **Voltage determination:** Dropdown using `COMMON_VOLTAGES` from MAD table.
   - **MAD auto-display:** When voltage is selected, auto-display the MAD from `lookupMAD()`. Show both phase-to-ground and phase-to-phase distances prominently (large text, highlighted background).
   - **Utility company:** Checkbox "Utility company contacted" → if checked, show: company name, contact name, confirmation time.
   - **Crew qualification verification:** Accept a `crewMemberIds: string[]` prop. Use `useCrewQualifications(crewMemberIds)` to auto-check each member's level. Display:
     - Green check next to qualified workers
     - Red warning next to unqualified workers with message: "[Name] is unqualified for energized line work (OSHA 1910.269)"
     - If ANY crew member is unqualified, show a blocking warning (form cannot be submitted).
   - **Second worker (>750V):** When voltage > 0.75kV, show required checkbox: "A second qualified employee is within voice range" + name field.
   - **LOTO:** Checkbox "Work involves de-energization requiring LOTO" → if checked, show LOTO fields (see Task 3D).

4. **Integrate into `JsaWizard.tsx`:**
   - Add the `ElectricalHazardSection` as a conditional section within the hazards step (or as an additional wizard step that appears after hazards when electrical hazards are flagged).
   - Pass crew member IDs from the JSA's job info step.
   - Store data in `electrical_hazard_data` JSONB on submission.

5. **Update `useJSAFormValidation.ts`:**
   - When any electrical hazard is checked, ALL electrical hazard fields become required:
     - voltage_kv must be selected (not null)
     - utility_company_contacted must be true (or explicitly acknowledged as not contacted with reason)
     - crew_qualifications_verified must be true AND zero unqualified workers
     - If voltage > 0.75kV: second_worker_name must be filled
   - Show these validation errors in the ValidationSummary component.

**Done when:**
- [ ] Migration adds `electrical_hazard_data` JSONB to `daily_jsa`
- [ ] ElectricalHazardSection renders when electrical hazards are selected
- [ ] Voltage dropdown works with all common voltages
- [ ] MAD auto-displays correctly for selected voltage
- [ ] Utility company fields appear conditionally
- [ ] Crew qualification check runs and shows warnings/blocks for unqualified workers
- [ ] Second worker field appears for >750V
- [ ] Validation blocks submission when required electrical fields are empty
- [ ] Data persists in `electrical_hazard_data` on submission
- [ ] `npm run typecheck` passes

---

## Task 3D: LOTO Section Component

**Problem:** No LOTO (Lockout/Tagout) documentation exists anywhere in the system. 29 CFR 1910.147 requires it for maintenance on chippers, grinders, and aerial lifts.

**Implementation:**

1. **Create component** `src/components/forms/LOTOSection.tsx`:
   - Self-contained section that can be embedded in both the JSA and the Equipment Inspection form.
   - Fields:
     - LOTO procedure followed (required checkbox)
     - Lockout device applied (required checkbox)
     - Tagout attached (required checkbox)
     - Energy source verified at zero-energy state (required checkbox)
     - Authorized employee performing lockout (required text — name)
     - Date/time of lockout (auto-filled, editable)
   - All fields required when the section is visible.
   - Export as a reusable component that Agent 4 can import into the Equipment Inspection form.

2. **Create type** (add to `src/types/electricalHazard.ts` or new file):
   ```typescript
   export interface LOTOData {
     procedure_followed: boolean;
     lockout_device_applied: boolean;
     tagout_attached: boolean;
     zero_energy_verified: boolean;
     authorized_employee: string;
     lockout_datetime: string;
   }
   ```

**Done when:**
- [ ] LOTOSection component renders all required fields
- [ ] All fields are required when visible
- [ ] Component is reusable (exported for Agent 4 to import)
- [ ] Type definition exists
- [ ] `npm run typecheck` passes

---

## Task 3E: Write Electrical Safety Tests

**Implementation:**

1. `tests/unit/electrical-mad-lookup.test.ts`:
   - Test `lookupMAD()` for all voltage ranges
   - Test edge cases: 0V, negative, exactly on boundary, above max range
   - Test that all COMMON_VOLTAGES resolve to a valid MAD entry (except "Unknown")

2. `tests/unit/electrical-qualification.test.ts`:
   - Test qualification level validation
   - Test crew qualification check with mixed levels
   - Test blocking behavior when unqualified worker present

3. `tests/unit/electrical-jsa-validation.test.ts`:
   - Test that electrical fields are required when hazards flagged
   - Test second worker required when voltage > 750V
   - Test form blocks when crew has unqualified members

4. `tests/e2e/electrical-jsa.spec.ts`:
   - Test JSA with electrical hazards selected → section appears
   - Test voltage selection → MAD displays
   - Test submission blocked when required fields empty
   - Test successful submission with all fields filled

**Done when:**
- [ ] All test files exist with meaningful coverage
- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
