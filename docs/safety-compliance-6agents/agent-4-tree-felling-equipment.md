# Agent 4: Tree Felling JSA, Equipment Templates & DVIR

> **Include `_context.md` before reading this prompt.**

## Your Mission

Harden the Tree Felling JSA (currently the weakest safety feature — zero validation, zero tests, 5 missing ANSI Z133 life-safety fields), add missing equipment inspection templates (chipper, chainsaw), and improve the DVIR defect workflow. This is hands-on field worker safety.

## Your Migration Timestamp Range

Use timestamps `20260216400000` through `20260216409999`.

## FILES YOU OWN (only modify these)

**You may create or modify:**
- `supabase/migrations/20260216400*` (your new migrations)
- `src/pages/forms/TreeFellingJSAForm.tsx` (major overhaul)
- `src/hooks/jsa/useTreeFellingValidation.ts` (new file)
- `src/hooks/jsa/useTreeFellingSubmission.ts` (new file)
- `src/pages/forms/DailyEquipmentInspectionForm.tsx` (add templates + LOTO integration)
- `src/hooks/equipment/useEquipmentFormValidation.ts` (add fail-notes requirement)
- `src/pages/forms/DVIRForm.tsx` (post-trip + defect workflow)
- `src/hooks/dvir/useDVIRFormValidation.ts` (require notes on fail + corrected/not-corrected)
- `src/pages/forms/Forms.tsx` (add post-trip link + dispatch warnings)
- `src/data/equipmentTemplates.ts` (new or extend existing template definitions)
- `tests/unit/tree-felling-*` (new test files)
- `tests/unit/equipment-*` (new test files)  
- `tests/e2e/tree-felling-*` (new test files)

**You may READ but NOT MODIFY:**
- `src/hooks/jsa/useJSASubmission.ts` — read to understand offline queue pattern, replicate for tree felling
- `src/hooks/jsa/useJSAFormValidation.ts` — read to understand validation pattern
- `src/lib/offlineQueue.ts`, `src/lib/offlinePhotoStore.ts` — read to understand offline infrastructure
- `src/components/forms/LOTOSection.tsx` — Agent 3 is creating this. Import it into equipment form. If it doesn't exist yet, create a placeholder import and add a TODO comment.
- All other files — for pattern reference only

**COORDINATION NOTE:** Agent 3 owns `JsaWizard.tsx` and `useJSAFormValidation.ts` (for electrical section). You own `TreeFellingJSAForm.tsx` which is a completely separate form — no conflict. Agent 3 is creating `LOTOSection.tsx` — import it into your equipment form work.

---

## Task 4A: Tree Felling JSA — Add Missing ANSI Z133 Life-Safety Fields

**Problem:** The Tree Felling JSA is missing 5 mandatory ANSI Z133 Section 6 fields: retreat path, drop zone, hinge wood plan, crew positions, and equipment checklist. All existing fields are unstructured freetext. There is ZERO validation — the form can be submitted completely blank with status "completed".

**Before coding, read:**
- `src/pages/forms/TreeFellingJSAForm.tsx` — understand current form structure, fields, and how it saves to `daily_jsa` with `jsa_type = 'tree_felling'` and `tree_felling_data` JSONB
- `src/pages/forms/DailyJSAForm.tsx` — read the well-structured JSA wizard as a reference for how to build a proper multi-step form with validation
- `src/hooks/jsa/useJSASubmission.ts` — understand the offline queue submission pattern
- `src/lib/offlineQueue.ts` — understand IndexedDB queue API
- `src/lib/offlinePhotoStore.ts` — understand photo persistence API

**Implementation:**

1. **Create type** `src/types/treeFelling.ts`:
   ```typescript
   export type CompassDirection = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';
   export type LeanMagnitude = 'slight' | 'moderate' | 'heavy';
   export type NotchType = 'conventional_45' | 'open_face_70' | 'humboldt' | 'other';

   export interface CrewPosition {
     name: string;
     role: string;  // e.g., "sawyer", "lookout", "swamper", "equipment operator"
   }

   export interface TreeFellingData {
     // Tree assessment
     tree_species: string;
     tree_condition: string;
     trunk_condition: string;
     tree_height_estimate: string;
     dbh_estimate: string;  // diameter at breast height

     // Lean & fall plan
     lean_direction: CompassDirection;
     lean_magnitude: LeanMagnitude;
     fall_path: CompassDirection;
     notch_type: NotchType;
     notch_type_other: string;  // when notch_type = 'other'

     // ANSI Z133 mandatory fields
     retreat_path_direction: CompassDirection;
     retreat_path_distance: string;
     retreat_path_cleared: boolean;
     drop_zone_description: string;
     drop_zone_cleared: boolean;
     hinge_wood_width: string;
     hinge_wood_thickness: string;
     hinge_wood_condition: string;
     crew_positions: CrewPosition[];
     equipment_checklist: {
       chainsaw_inspected: boolean;
       wedges_available: boolean;
       felling_lever_available: boolean;
       escape_route_cleared: boolean;
       ppe_verified_all_crew: boolean;
     };

     // Existing fields (structured)
     distance_from_lines: string;
     hazards_present: string;
   }
   ```

2. **Overhaul `TreeFellingJSAForm.tsx`:**
   - Replace all freetext fields with structured inputs:
     - `tree_species`: Dropdown with common species (oak, pine, maple, elm, ash, hickory, cedar, sweetgum, other) + freetext for "other."
     - `lean_direction`: Compass selector component (8 directions, visual circle).
     - `lean_magnitude`: Radio buttons (slight/moderate/heavy).
     - `fall_path`: Compass selector (same component as lean_direction).
     - `notch_type`: Dropdown — Conventional (45°), Open-face (70°+), Humboldt, Other (with freetext).
     - `retreat_path_direction`: Compass selector. Label: "Planned retreat path — minimum 2 tree lengths at 45° from fall direction."
     - `retreat_path_distance`: Text input with label "Estimated retreat distance."
     - `retreat_path_cleared`: Checkbox "Retreat path has been cleared of obstacles."
     - `drop_zone_description`: Text area "Describe the planned drop zone."
     - `drop_zone_cleared`: Checkbox "Drop zone has been cleared of personnel and obstacles."
     - `hinge_wood_width`, `hinge_wood_thickness`: Text inputs (measurements).
     - `hinge_wood_condition`: Dropdown — sound, partially decayed, hollow, unknown.
     - `crew_positions`: Dynamic list — "Add crew member" button, each row has name (text) and role (dropdown: sawyer, lookout, swamper, equipment operator, ground worker, other).
     - `equipment_checklist`: 5 required checkboxes.
   - Organize into clear sections: Tree Assessment → Lean & Fall Plan → Safety Plan (retreat, drop zone, hinge) → Crew → Equipment → Overhead Hazards → Review/Signature.
   - Use the existing `SignaturePad` component for the signature.

3. **Create compass selector component** `src/components/forms/CompassSelector.tsx`:
   - Visual 8-direction compass rose.
   - Clickable directions that highlight when selected.
   - Props: `value: CompassDirection | null`, `onChange: (dir: CompassDirection) => void`, `label: string`.
   - Reusable for lean direction, fall path, and retreat path.

**Done when:**
- [ ] All 5 ANSI Z133 fields exist (retreat path, drop zone, hinge wood, crew positions, equipment checklist)
- [ ] All previously freetext fields replaced with structured inputs
- [ ] Compass selector component works for direction fields
- [ ] Crew positions uses dynamic add/remove list
- [ ] Equipment checklist has 5 required items
- [ ] Form organized into logical sections
- [ ] `npm run typecheck` passes

---

## Task 4B: Tree Felling JSA — Validation

**Problem:** ZERO validation exists. Form submits completely blank.

**Implementation:**

1. **Create** `src/hooks/jsa/useTreeFellingValidation.ts`:
   - ALL structured fields from Task 4A are required for submission with status "completed."
   - **Retreat path angle check:** The retreat path direction must differ from the fall path direction by at least 90°. Implement this as a compass direction angle comparison:
     ```typescript
     // Compass directions as degrees
     const DIRECTION_DEGREES: Record<CompassDirection, number> = {
       N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315
     };

     function angleBetween(d1: CompassDirection, d2: CompassDirection): number {
       const diff = Math.abs(DIRECTION_DEGREES[d1] - DIRECTION_DEGREES[d2]);
       return Math.min(diff, 360 - diff);
     }

     // Validation: angleBetween(retreat_path, fall_path) >= 90
     ```
   - At least 1 crew member must be listed in `crew_positions`.
   - All 5 equipment checklist items must be checked.
   - `retreat_path_cleared` and `drop_zone_cleared` must be true.
   - If `notch_type = 'other'`, `notch_type_other` is required.
   - Return validation errors in the same format as `useJSAFormValidation.ts`.

2. **Wire validation into the form.** Display errors using the existing `ValidationSummary` component. Block submission until all required fields pass.

3. **Draft status:** Allow saving as draft with incomplete fields. Only enforce full validation on "completed" submission.

**Done when:**
- [ ] All fields required for "completed" submission
- [ ] Retreat path angle check enforces ≥90° from fall path
- [ ] At least 1 crew member required
- [ ] All 5 equipment checklist items required
- [ ] Both "cleared" checkboxes required
- [ ] Draft saves allowed without full validation
- [ ] Blank form CANNOT submit as "completed"
- [ ] ValidationSummary shows all errors
- [ ] `npm run typecheck` passes

---

## Task 4C: Tree Felling JSA — Offline Support

**Problem:** Tree Felling JSA has NO offline support. Uses direct Supabase calls. Data loss risk for field workers.

**Before coding, read:**
- `src/hooks/jsa/useJSASubmission.ts` — this is your template. Replicate its offline pattern exactly.
- `src/lib/offlineQueue.ts` — understand the queue API
- `src/lib/offlinePhotoStore.ts` — understand photo persistence

**Implementation:**

1. **Create** `src/hooks/jsa/useTreeFellingSubmission.ts`:
   - Replicate the pattern from `useJSASubmission.ts` exactly.
   - On submit: try Supabase first. If offline, queue to IndexedDB.
   - Photo persistence: use `offlinePhotoStore` for any attached photos.
   - Auto-sync on reconnect with retry schedule.
   - Draft recovery: save draft state to localStorage (already partially exists per audit — verify and complete).

2. **Update `TreeFellingJSAForm.tsx`** to use the new submission hook instead of direct Supabase calls.

3. **Add offline indicator:** Use the existing `OfflineFormIndicator` component in the form UI.

**Done when:**
- [ ] Submission uses offline queue pattern matching DailyJSA
- [ ] Form submits successfully when offline (queued to IndexedDB)
- [ ] Photos persist in IndexedDB when offline
- [ ] Auto-sync triggers on reconnect
- [ ] OfflineFormIndicator visible in form
- [ ] Draft recovery works via localStorage
- [ ] `npm run typecheck` passes

---

## Task 4D: Equipment — Chipper & Chainsaw Templates

**Problem:** No chipper or chainsaw inspection templates exist. ANSI Z133 requires chipper-specific inspection (Section 8) and 29 CFR 1910.266 requires chainsaw pre-use inspection.

**Before coding, read:**
- `src/pages/forms/DailyEquipmentInspectionForm.tsx` — understand the template selection system (Sky Trim, Geo Boy, Skid Steer are existing templates)
- Find where templates are defined (likely a data file or within the form component)

**Implementation:**

1. **Add Chipper template** (ANSI Z133 Section 8):
   - Infeed hopper condition
   - Discharge chute clear and functional
   - Feed control bar operational
   - Chipper knives/blades condition and sharpness
   - Chip curtain intact
   - Emergency stop functional (test before use)
   - Engine guards in place
   - Towing hitch and safety chains
   - Debris screen intact
   - All safety decals legible

2. **Add Chainsaw template** (29 CFR 1910.266, ANSI Z133 Section 7):
   - Chain tension correct
   - Chain brake functional (test)
   - Throttle trigger lockout functional
   - Muffler condition
   - Anti-vibration mounts condition
   - Guide bar condition and wear
   - Chain sharpness
   - Bar oil level
   - Fuel system — no leaks
   - Spark arrestor condition
   - Handle condition and grip

3. Register both templates in the existing template selection system so they appear as options.

**Done when:**
- [ ] Chipper template with 10 inspection items exists
- [ ] Chainsaw template with 11 inspection items exists
- [ ] Both appear in equipment inspection template dropdown
- [ ] Items use the same Pass/Fail/N-A pattern as existing templates
- [ ] `npm run typecheck` passes

---

## Task 4E: Equipment — LOTO Integration

**Implementation:**

1. **Migration** `supabase/migrations/20260216400000_equipment_loto.sql`:
   ```sql
   ALTER TABLE daily_equipment_inspections
     ADD COLUMN IF NOT EXISTS loto_required BOOLEAN DEFAULT false,
     ADD COLUMN IF NOT EXISTS loto_data JSONB;
   ```

2. **Update `DailyEquipmentInspectionForm.tsx`:**
   - When ANY checklist item is marked "Fail" AND the equipment type is chipper, grinder, aerial lift (Sky Trim, Jarraff), or stump grinder (Geo Boy): show the LOTO section.
   - Import `LOTOSection` from `src/components/forms/LOTOSection.tsx` (created by Agent 3). If it doesn't exist yet, create a placeholder with a TODO comment: `// TODO: Import LOTOSection from Agent 3 when available`.
   - Save LOTO data to the `loto_data` JSONB column.

**Done when:**
- [ ] Migration adds loto columns
- [ ] LOTO section appears when fail items + applicable equipment type
- [ ] LOTOSection imported (or placeholder with TODO)
- [ ] LOTO data saves to database
- [ ] `npm run typecheck` passes

---

## Task 4F: DVIR — Post-Trip Flow & Defect Improvements

**Implementation:**

1. **Migration** `supabase/migrations/20260216400001_dvir_post_trip.sql`:
   ```sql
   ALTER TABLE dvir_reports
     ADD COLUMN IF NOT EXISTS inspection_type TEXT
       CHECK (inspection_type IN ('pre_trip', 'post_trip'))
       DEFAULT 'pre_trip';
   ```

2. **Update `DVIRForm.tsx`:**
   - Accept `inspection_type` from route parameter or prop.
   - When `inspection_type = 'post_trip'`, change the page title to "Post-Trip Vehicle Inspection" and update any labels that say "Pre-Trip."
   - Same 46-item checklist for both types.

3. **Update `Forms.tsx`:**
   - Add a "Post-Trip Inspection" button/link next to the existing DVIR link.
   - Route to DVIR form with `inspection_type=post_trip` parameter.

4. **Require notes when items fail** — Update `useDVIRFormValidation.ts`:
   - When any checklist item is marked "Fail," the `notes` field becomes required.
   - Validation error: "Defect notes are required when items are marked Fail."

5. **Add corrected/need-not-be-corrected selector:**
   - In the mechanic review section of the DVIR, add a dropdown per defect:
     - "Condition was corrected"
     - "Condition need not be corrected before vehicle operation"
   - This matches 49 CFR 396.13(b)(3).

6. **Vehicle dispatch warning:**
   - Identify safety-critical checklist items (brakes, steering, tires) — add a `safety_critical: true` flag to these items in the checklist definition.
   - When a DVIR has open safety-critical defects (Fail + not yet corrected), display a prominent red warning banner on `Forms.tsx`: "Vehicle [truck number] has open safety-critical defects. Do not operate until resolved."
   - Query `dvir_reports` for today's reports with open critical defects.

**Done when:**
- [ ] Migration adds inspection_type column
- [ ] Post-trip form accessible from Forms hub
- [ ] Post-trip uses same checklist with updated labels
- [ ] Notes required when any item is Fail
- [ ] Corrected/not-corrected selector exists in mechanic section
- [ ] Safety-critical items flagged in checklist definition
- [ ] Dispatch warning banner shows for vehicles with open critical defects
- [ ] `npm run typecheck` passes

---

## Task 4G: Write Tests

**Implementation:**

1. `tests/unit/tree-felling-validation.test.ts`:
   - Test all required fields block blank submission
   - Test retreat path angle check (90° minimum from fall path)
   - Test crew position minimum (at least 1)
   - Test equipment checklist all-required
   - Test draft vs completed validation difference
   - Test compass direction angle calculation edge cases

2. `tests/unit/tree-felling-submission.test.ts`:
   - Test offline queue integration
   - Test draft save/restore
   - Test photo persistence in offline mode

3. `tests/e2e/tree-felling-jsa.spec.ts`:
   - Happy path: fill all fields, submit, verify in database
   - Blank submission rejection
   - Invalid retreat path (same direction as fall) rejection
   - Offline submission and sync

4. `tests/unit/equipment-templates.test.ts`:
   - Test chipper template has all required items
   - Test chainsaw template has all required items
   - Test LOTO section triggers for correct equipment types

**Done when:**
- [ ] All test files exist
- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
