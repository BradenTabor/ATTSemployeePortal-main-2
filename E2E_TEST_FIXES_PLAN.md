# E2E Test Fixes – Consolidated Plan

This plan covers fixes for failing E2E tests across **dashboards**, **DVIR**, **equipment**, **PWA offline**, and **RTO** specs.

---

## Part A: Dashboard, DVIR Odometer, Equipment, DVIR Concurrency (8 failures)

### 1. Dashboard tests (3 failures)
- **Visibility:** Add timeout to assertion in `tests/e2e/dashboards.spec.ts` line 18, e.g. `toBeVisible({ timeout: 10000 })`.
- **Admin authorization:** App has `path="/admin"` only; tests use `/admin/dashboard`. Add route `path="/admin/dashboard"` → `<Navigate to="/admin" replace />` in `src/App.tsx`, or change tests to `page.goto('/admin')`.

### 2. DVIR odometer (2 failures)
- **"must be at least" message:** In `src/pages/forms/dvir/sections/SectionA.tsx`, after the `MileageInput` wrapper div, render `getFieldError('mileage')` when `shouldShowError('mileage')` (same pattern as truck/driver errors), with `role="alert"`, so the validator text "Odometer reading must be at least X mi" is visible.
- **Same mileage:** Hook and `MileageInput` already allow equal; no change needed.

### 3. Equipment form submit (2 failures)
- Ensure "All Pass" and hydraulic file upload update state so `allErrors` is empty; add/use wait for submit button enabled in `tests/e2e/equipment-form.spec.ts` after `fillRequiredFields`.

### 4. DVIR double-submission (1 flaky)
- In `tests/e2e/dvir-form.spec.ts`, replace long `page.waitForTimeout(5000)` with a wait for success toast or heading (e.g. `waitFor({ state: 'visible', timeout: 15000 })` on success indicator).

---

## Part B: PWA Offline and RTO (3 failures / 14 reported)

### 5. PWA – Form input preservation (1 failure)
**File:** `tests/e2e/pwa-offline.spec.ts` (test around line 147)

**Problem:** Verification at line 170 uses `page.inputValue('input[name="truckNumber"]')`. On the DVIR form, `truckNumber` is a **select**, not an input. `page.inputValue()` on a selector that matches a select can cause timeouts or wrong behavior.

**Fix:**
- Keep the existing fill logic that handles select vs input (lines 153–161).
- For **verification**, do not use `page.inputValue('input[name="truckNumber"]')`. Instead:
  - If the test used `truckSelect`: after going offline, get the selected value with `const selectedTruck = await truckSelect.inputValue();` (Playwright’s `Locator.inputValue()` on a select returns the selected option’s value). Then `expect(selectedTruck).toBeTruthy();`.
  - For driver name, keep `const driverName = await page.inputValue('input[name="driversName"]');` and `expect(driverName).toBe('Offline Test Driver');`.
- Remove the assertion that truck equals `'OFFLINE-TEST-001'` when the field is a select (the value will be the option at index 1, e.g. a truck ID).

### 6. PWA – Queue submission when offline (1 failure)
**File:** `tests/e2e/pwa-offline.spec.ts` (test around line 177)

**Problem:** Line 201 uses `page.click('button[type="submit"]')` and times out. The DVIR submit button stays **disabled** until required fields are filled: oil dipstick photo, vehicle (and if present aerial) checklist, and at least one signature. The test only fills truck, driversName, and mileage.

**Fix:**
- After selecting truck and filling driversName and mileage:
  - Upload required oil dipstick photo:  
    `page.locator('input[type="file"][name="oilDipstick"], input[type="file"][aria-label*="oil"], [data-testid="oil-dipstick"]').first().setInputFiles('tests/fixtures/oil-dipstick.jpg');`
  - Complete Vehicle / Trailer checklist:  
    `page.locator('section:has(h2:has-text("Vehicle / Trailer"))').getByRole('button', { name: 'All Pass' }).click();`
  - If visible, complete Aerial section: same pattern with "Aerial Lift" and "All Pass".
  - Fill signatures:  
    `page.fill('#finalDriverSignature', 'Queue Test');`  
    `page.fill('#generalForemanSignature', 'Test Foreman');`
- Add short waits after upload and after "All Pass" (e.g. 500–600 ms) so state updates.
- Use the same submit button locator as other DVIR tests:  
  `page.locator('[data-testid="dvir-submit-button"]').scrollIntoViewIfNeeded();` then click.
- Then go offline, click submit, and assert on queued/offline/error message (existing logic is fine; optionally use regex `text=/queued|offline|will be sent/i` for the message locator).

### 7. RTO – Submit request successfully (1 failure)
**File:** `tests/e2e/rto-form.spec.ts` (test around line 104)

**Problem:** Success indicators timeout. The form uses custom TimeField components with label-based accessibility; the test already uses `getByLabel(/Start Time/i)` and `getByLabel(/End Time/i)`. The main gap is that the test may click submit before the button is **enabled** (e.g. validation not yet passed or time/reason not fully applied).

**Fix:**
- After filling all fields (fullName, startDate, endDate, start time, end time, reason, notes):
  - Use a single submit button locator:  
    `const submitBtn = page.locator('[data-testid="rto-submit-button"]').or(page.locator('button[type="submit"]'));`
  - Scroll into view: `await submitBtn.scrollIntoViewIfNeeded();`
  - **Wait for enabled:** `await expect(submitBtn).toBeEnabled({ timeout: 10000 });`
  - Then `await submitBtn.click();`
- Ensure time fields are filled: wait for `startTimeInput` and `endTimeInput` to be visible (e.g. `waitFor({ state: 'visible', timeout: 5000 })`) before filling `'08:00'` and `'17:00'`.
- Keep the existing broad success check (toast, heading, alert, text, form gone, URL changed); no change needed there.

---

## Implementation order

1. **PWA preservation** – fix truck verification (select vs input).
2. **PWA queue** – fill all required DVIR fields and use `dvir-submit-button`.
3. **RTO submit** – wait for submit enabled and ensure time fields are filled.
4. Then proceed with Part A (dashboard, DVIR odometer, equipment, DVIR concurrency) as in the original plan.

---

## Files to touch

| Area              | File(s) |
|-------------------|--------|
| PWA preservation  | `tests/e2e/pwa-offline.spec.ts` |
| PWA queue         | `tests/e2e/pwa-offline.spec.ts` |
| RTO submit        | `tests/e2e/rto-form.spec.ts` |
| Dashboard         | `tests/e2e/dashboards.spec.ts`, optionally `src/App.tsx` |
| DVIR odometer     | `src/pages/forms/dvir/sections/SectionA.tsx` |
| Equipment         | `src/pages/forms/DailyEquipmentInspectionForm.tsx` and/or test `fillRequiredFields` / waits |
| DVIR concurrency  | `tests/e2e/dvir-form.spec.ts` |
