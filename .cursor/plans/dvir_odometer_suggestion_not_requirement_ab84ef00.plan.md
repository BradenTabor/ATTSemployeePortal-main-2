# DVIR Odometer: Last Recorded as Suggestion (Not Requirement)

## Current Behavior

- **Form-level validation** (`src/hooks/dvir/useDVIRFormValidation.ts`) calls `validators.mileage(value, previousMileage)`. The shared validator in `src/lib/formValidation.ts` (lines 78–80) returns an error when `num < previousMileage`: _"Odometer reading must be at least X mi"_, which **blocks submit**.
- **MileageInput** (`src/pages/forms/dvir/components.tsx`) uses a local `validation` useMemo that sets `valid: false` and message _"Lower than previous reading"_ when `current < previous`, applying a red border (`!validation.valid && value`).
- A hint is already shown: _"Last recorded for {truckNumber}: {previousMileage} mi"_.

Both the submit path and the inline UI treat "lower than last record" as a hard error.

## Desired Behavior

- Last recorded mileage remains **informational only** (suggestion). Submitting with a value lower than the last record (or any valid positive number) is allowed.
- Keep showing last recorded as a hint. When the user enters a value lower than last record, show a **neutral suggestion** (amber copy: _"Lower than last recorded. Submit if correct."_) and **do not block or show error styling**.

---

## Implementation

### 1. Remove "minimum vs previous" error from shared validator

**File:** `src/lib/formValidation.ts`

**Change:** In `validators.mileage(value, previousMileage)`, **delete the block** that returns an error when `num < previousMileage` (lines 78–80).

**Keep unchanged:**
- Required / non-empty check
- Valid number and `> 0` check

**Signature:** Leave as `(value, previousMileage)` so callers don't break. Add a brief comment: `// previousMileage kept in signature for caller compatibility; no longer used for validation`.

**Result:** Form-level validation in `useDVIRFormValidation` will no longer block submit for lower odometer readings. No other callers depend on the "must be at least previous" behavior.

---

### 2. MileageInput: treat "lower than previous" as suggestion, not error

**File:** `src/pages/forms/dvir/components.tsx`

**Change the `validation` useMemo** (lines 85–96). The new logic order must be:

1. If value is not a valid positive number → `{ valid: false, message: existing error }`
2. If previousMileage exists AND num < previousMileage → `{ valid: true, message: "Lower than last recorded. Submit if this reading is correct." }`
3. If previousMileage exists AND mileageDiff > 500 → `{ valid: true, message: existing "+X miles since last DVIR" warning }`
4. Default → `{ valid: true, message: null }`

**Critical edge case — step 2 must come before step 3.** When `num < previousMileage`, `mileageDiff` is negative. If step 3 runs first, it would either show a nonsensical negative-miles message or silently skip the suggestion. By checking `num < previousMileage` first, we show the correct suggestion and skip the diff check entirely.

**Styling for the suggestion message (step 2):**
- Text color: `text-amber-400/90` (not red, not default gray — visually distinct but non-blocking).
- Icon: Use `Info` from `lucide-react` instead of `AlertTriangle`. Import `Info` alongside existing icon imports.
- **Do not** apply `border-red-500/50` — the existing condition `!validation.valid && value` already handles this; since `valid: true`, the red border will not render.

**Keep the existing `mileageDiff > 500` warning** (step 3) unchanged in style — it is already a non-blocking warning and uses amber/yellow styling.

**No changes to:**
- The hint line showing _"Last recorded for {truckNumber}: {previousMileage} mi"_
- Props, data fetching, or parent component (`SectionA`, `DVIRForm.tsx`)

---

### 3. Verify `useDVIRFormValidation` has no secondary gate

**File:** `src/hooks/dvir/useDVIRFormValidation.ts`

**Action:** Confirm this hook's mileage validation relies solely on `validators.mileage()`. If there is any additional `previousMileage` comparison logic in this hook (beyond calling the shared validator), remove it as well. This is a verification step — if no secondary check exists, no code change is needed here.

---

### 4. Unit tests

**File:** `tests/unit/dvir-validation.test.ts`

#### Modify existing test:
- **Rename** _"rejects odometer reading less than previous"_ → _"accepts odometer reading less than previous (suggestion only)"_
- Change assertion: `expect(validators.mileage('11999', 12000)).toBeNull()`

#### Add new test:
- **"accepts odometer reading of 1 with large previous mileage"**: `expect(validators.mileage('1', 50000)).toBeNull()` — verifies no floor enforcement at all.

#### Keep unchanged:
- Test that accepts equal-to-previous (passes, no change)
- Test that accepts greater-than-previous (passes, no change)
- Tests that reject non-numeric, negative, zero, and empty values (passes, no change)

#### Optional but recommended — component-level test:
If a test file exists for `MileageInput` (or in an integration test suite), add or update a test that:
- Renders `MileageInput` with `previousMileage={12000}` and simulates entering `11000`.
- Asserts: no red border class is present, the suggestion text _"Lower than last recorded"_ is rendered, and the submit button (or form) is **not** disabled.

---

## Files to Touch (Summary)

| File | Change |
|------|--------|
| `src/lib/formValidation.ts` | Delete the `num < previousMileage` error branch in `validators.mileage`. Add comment on unused param. |
| `src/pages/forms/dvir/components.tsx` | In MileageInput `validation` useMemo: return `valid: true` + suggestion message when `current < previous` (before the `mileageDiff > 500` check). Use `text-amber-400/90` and `Info` icon. |
| `src/hooks/dvir/useDVIRFormValidation.ts` | **Verify only** — confirm no secondary `previousMileage` gate exists beyond the shared validator call. |
| `tests/unit/dvir-validation.test.ts` | Rename + flip assertion for "less than previous" test. Add edge-case test for value of 1. |

## Data Flow (Unchanged)

`previousMileage` is still loaded in `DVIRForm.tsx` from the latest DVIR for the selected truck (excluding same-day) and passed into `useDVIRFormValidation` and `SectionA` → `MileageInput`. No changes to that fetch or prop flow.

## Out of Scope

- No backend or DB constraint changes.
- No changes to other forms using mileage validation (DVIR is the only caller passing `previousMileage`).
- No changes to the hint text showing last recorded mileage.
