# Reference: E2E Test Stub

File location: `e2e/<formName>.spec.ts`

```typescript
// e2e/<formName>.spec.ts
import { test, expect } from '@playwright/test';
import { loginAs } from './fixtures/auth';

test.describe('<FormName> Form', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'safety_officer'); // use lowest-privilege role that can access form
  });

  test('happy path — fill and submit form', async ({ page }) => {
    await page.goto('/forms/<form-route>');

    // Step 1
    await page.getByLabel('Date').fill('2026-02-17');
    await page.getByLabel('Location').fill('Site A - North Yard');
    await page.getByRole('button', { name: 'Next' }).click();

    // Step 2 — add domain-specific field interactions
    // await page.getByLabel('...').fill('...');
    await page.getByRole('button', { name: 'Next' }).click();

    // Review & Submit
    await page.getByRole('button', { name: 'Submit' }).click();

    // Assert success
    await expect(page.getByText('submitted successfully')).toBeVisible();
    await expect(page).toHaveURL('/dashboard');
  });

  test('draft persistence — refreshing restores draft', async ({ page }) => {
    await page.goto('/forms/<form-route>');
    await page.getByLabel('Location').fill('Test Location');
    await page.reload();
    await expect(page.getByLabel('Location')).toHaveValue('Test Location');
  });

  test.skip('offline submission — queues when offline', async ({ page }) => {
    // TODO: Test offline queue behaviour using service worker interception
    // Reference: see DVIRForm.spec.ts for offline pattern when implemented
  });

  test.skip('photo upload — attaches and previews photos', async ({ page }) => {
    // TODO: Mock Supabase Storage for photo upload testing
  });

  test.skip('validation — shows errors on empty submit', async ({ page }) => {
    // TODO: Implement validation error assertion for each required field
  });
});
```

## Notes
- Always use `loginAs` fixture from `e2e/fixtures/auth.ts` — never hardcode credentials
- Mobile viewport tests: add `test.use({ viewport: { width: 390, height: 844 } })` describe block for critical paths
- Mark incomplete tests with `test.skip` + TODO rather than leaving them absent — skipped tests show up in the audit trail
- Keep test descriptions in plain English — they appear in compliance reports
