---
name: add-e2e-test
description: Scaffold a Playwright E2E test for an ATTS page or flow — with correct auth helper usage (loginAs), selector strategy (semantic-first, data-testid fallback), form helper integration, multi-device project targeting, and test data considerations.
triggers:
  - "add e2e test"
  - "create playwright test"
  - "write e2e spec"
  - "end to end test"
  - "integration test"
version: 1.0
reviewed: 2026-02-17
---

# Add E2E Test

## Purpose
Scaffolds a Playwright E2E spec that integrates with the existing test infrastructure — 27 spec files, shared auth/form helpers, multi-browser project config, and seed/cleanup scripts. A test that doesn't use `loginAs()` or picks wrong selectors will flake on CI.

## Pre-Flight Checklist
- [ ] Page or flow to test — URL path (e.g., `/forms/jsa/tree-felling`)
- [ ] Required role — which test user should log in? (`employee`, `foreman`, `mechanic`, `general_foreman`, `admin`)
- [ ] Test scope — happy path only, or validation + edge cases too?
- [ ] Does the page need test data seeded? (e.g., existing records to view/edit)

---

## Infrastructure Reference

**Config:** `playwright.config.ts`
- Base URL: `http://localhost:5173`
- Timeout: 45s global, 10s expect
- 6 projects: Chromium, Firefox, WebKit, Pixel 5, iPhone 13 Pro, iPad Pro 11
- Retries: 2 on CI, 1 locally

**Helpers:**
- `tests/e2e/helpers/auth.ts` — `loginAs(page, role)`, `logout(page)`, `dismissOnboardingIfPresent(page)`
- `tests/e2e/helpers/forms.ts` — `fillInput()`, `uploadFile()`, `submitForm()`, `waitForToast()`, `hasValidationErrors()`, `navigateJSAStep()`

**Test users:** All use password `TestPassword123!`
- `test-employee@atts.test` (employee)
- `test-foreman@atts.test` (foreman)
- `test-mechanic@atts.test` (mechanic)
- `test-gf@atts.test` (general_foreman)
- `test-admin@atts.test` (admin)

**Setup:** `npx tsx tests/setup/seedTestUsers.ts`
**Cleanup:** `npx tsx tests/setup/cleanupE2EData.ts`

---

## File to Create

`tests/e2e/<feature-name>.spec.ts`

See `references/e2e-test-template.md` for the full template.

---

## Step-by-Step

### 1. Create the Spec File

Naming: kebab-case matching the feature (e.g., `hazard-assessment.spec.ts`).

### 2. Structure the Tests

```typescript
import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

test.describe('<Feature Name>', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, '<role>');
    await page.goto('/<path>');
    await page.waitForLoadState('domcontentloaded');
  });

  test('should render the page', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Page Title/i })).toBeVisible();
  });

  // More tests...
});
```

### 3. Selector Strategy (in priority order)

1. **Semantic (preferred):** `page.getByRole('button', { name: /Submit/i })`, `page.getByLabel(/Email/i)`, `page.getByText(/Success/i)`
2. **data-testid (reliable fallback):** `page.locator('[data-testid="submit-btn"]')`
3. **Attribute:** `page.locator('input[name="fieldName"]')`, `page.locator('select[name="truckNumber"]')`
4. **Or-chain (resilience):** `page.locator('#auth-email').or(page.locator('input[type="email"]'))`

Rules:
- Never use CSS class selectors (they break on style changes)
- Never use complex XPath
- Prefer `getByRole` over `getByTestId` — it validates accessibility for free
- Add `data-testid` attributes to the component if no semantic selector works — that's a valid code change

### 4. Assertion Patterns

```typescript
// Visibility
await expect(element).toBeVisible({ timeout: 10000 });

// Text
await expect(element).toContainText('expected', { ignoreCase: true });

// URL navigation
await expect(page).toHaveURL(/\/dashboard/);

// Form state
await expect(button).toBeEnabled({ timeout: 15000 });
await expect(button).toBeDisabled();

// Toast confirmation
await expect(page.locator('[data-sonner-toast]')).toBeVisible({ timeout: 10000 });
```

### 5. Form Testing

Use the helpers from `tests/e2e/helpers/forms.ts`:

```typescript
import { fillInput, submitForm, waitForToast, hasValidationErrors } from './helpers/forms';

// Fill a form field
await fillInput(page, 'fieldName', 'value');

// Submit and wait for response
await submitForm(page);
await waitForToast(page, /submitted successfully/i);

// Check validation
const hasErrors = await hasValidationErrors(page);
expect(hasErrors).toBe(true);
```

### 6. Test Grouping

```typescript
test.describe('Happy Path', () => {
  test('should submit valid form', async ({ page }) => { /* ... */ });
  test('should show success toast', async ({ page }) => { /* ... */ });
});

test.describe('Validation', () => {
  test('should show errors for empty required fields', async ({ page }) => { /* ... */ });
  test('should prevent submission with invalid data', async ({ page }) => { /* ... */ });
});

test.describe('Keyboard Navigation', () => {
  test('should be navigable with Tab key', async ({ page }) => { /* ... */ });
});
```

---

## Timeout Guidelines

| Scenario | Timeout |
|----------|---------|
| Auth/login | 25s (Supabase can be slow) |
| Page load | 10s |
| Toast visibility | 10s |
| Button enabled after fetch | 15s |
| Form submission round-trip | 20s |
| Default expect | 10s (from config) |

Override per-suite: `test.setTimeout(60000);`

---

## After Creation Checklist

- [ ] Spec uses `loginAs()` from `./helpers/auth` — not manual login
- [ ] `beforeEach` navigates to the page and waits for `domcontentloaded`
- [ ] Selectors use semantic strategy first (getByRole > getByTestId > attribute)
- [ ] No CSS class selectors
- [ ] Timeouts are explicit where needed (don't rely on defaults for slow operations)
- [ ] Run locally: `npx playwright test tests/e2e/<file>.spec.ts --project=chromium`
- [ ] Happy path test passes on at least Chromium

## Anti-Patterns

- **Never** write manual login code — always use `loginAs()`
- **Never** hardcode test user passwords in spec files — the helper handles this
- **Never** use `page.waitForTimeout(5000)` for synchronization — use `waitForLoadState`, `waitFor`, or `toBeVisible` with timeouts
- **Never** skip `waitForLoadState('domcontentloaded')` in `beforeEach` — pages flash-render before hydration
- **Never** assume test data exists — either seed it in `beforeAll` or use `test.skip()` if prerequisites aren't met
