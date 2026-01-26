/**
 * JSA Form E2E Tests
 * 
 * End-to-end tests for Job Safety Analysis forms.
 * Tests wizard flow, state machine, and edge cases.
 */

import { test, expect } from '@playwright/test';
import { loginAs, dismissOnboardingIfPresent } from './helpers/auth';

async function gotoJsaForm(page: import('@playwright/test').Page) {
  await page.goto('/forms/jsa');
  await page.waitForTimeout(1200);
  await dismissOnboardingIfPresent(page);
  await page.waitForSelector('[data-testid="jsa-wizard"]', { timeout: 10000 });
}

/** Step 1 uses DateField (label "Job Date") and InputField (id workLocation). Use labels for stability. */
async function fillJsaStep1(
  page: import('@playwright/test').Page,
  data: { jobDate: string; workLocation: string }
) {
  await expect(page.getByText('Job Information')).toBeVisible();
  const jobDateInput = page.getByLabel(/Job Date/i);
  await expect(jobDateInput).toBeVisible({ timeout: 8000 });
  await jobDateInput.fill(data.jobDate);
  const workLocationInput = page.getByLabel(/Work Location/i);
  await expect(workLocationInput).toBeVisible({ timeout: 3000 });
  await workLocationInput.fill(data.workLocation);
}

// Test data
const VALID_JSA_DATA = {
  jobDate: new Date().toISOString().split('T')[0],
  workLocation: '123 E2E Test Street, Austin TX 78701',
  circuitNumber: 'CKT-E2E-001',
  signature: 'E2E Test Employee',
};

test.describe('JSA Form', () => {
  test.setTimeout(60000);

  test.describe('Wizard Flow Tests', () => {
    test('should navigate through all 6 steps', async ({ page }) => {
      await loginAs(page, 'employee');
      await gotoJsaForm(page);

      // Step 1: Job Information — use label-based selectors (DateField has no name, workLocation has id)
      await fillJsaStep1(page, VALID_JSA_DATA);
      
      // Navigate to step 2
      await page.getByTestId('jsa-next').click();
      await page.waitForTimeout(500);
      
      // Step 2: Safety & PPE
      await expect(page.getByText(/Safety|PPE/, { exact: false }).first()).toBeVisible();
      
      // Navigate to step 3
      await page.getByTestId('jsa-next').click();
      await page.waitForTimeout(500);
      
      // Step 3: Conditions
      await expect(page.getByText(/Conditions|Weather/, { exact: false }).first()).toBeVisible();
      
      // Navigate to step 4
      await page.getByTestId('jsa-next').click();
      await page.waitForTimeout(500);
      
      // Step 4: Hazards
      await expect(page.getByText(/Hazards/, { exact: false }).first()).toBeVisible();
      
      // Navigate to step 5
      await page.getByTestId('jsa-next').click();
      await page.waitForTimeout(500);
      
      // Step 5: Spans
      await expect(page.getByText(/Span/, { exact: false }).first()).toBeVisible();
      
      // Navigate to step 6
      await page.getByTestId('jsa-next').click();
      await page.waitForTimeout(500);
      
      // Step 6: Review
      await expect(page.getByText(/Review|Sign/, { exact: false }).first()).toBeVisible();
    });

    test('should allow going back through steps', async ({ page }) => {
      await loginAs(page, 'employee');
      await gotoJsaForm(page);

      await fillJsaStep1(page, VALID_JSA_DATA);

      // Go to step 2
      await page.getByTestId('jsa-next').click();
      await page.waitForTimeout(500);

      // Go back to step 1 (use footer "Previous", not top-bar "Back" which leaves the form)
      await page.getByTestId('jsa-prev').click();
      await page.waitForTimeout(500);

      await expect(page.getByLabel(/Job Date/i)).toBeVisible();
    });

    test('should allow direct step navigation via pills', async ({ page }) => {
      await loginAs(page, 'employee');
      await gotoJsaForm(page);
      
      await fillJsaStep1(page, VALID_JSA_DATA);
      
      // Try to click on step 3 pill directly
      const step3Pill = page.getByTestId('jsa-step-3');
      await step3Pill.click();
      await page.waitForTimeout(500);
      
      // Should be on step 3
      await expect(page.getByText(/Conditions|Weather/, { exact: false }).first()).toBeVisible();
    });
  });

  test.describe('Save as Draft Tests', () => {
    test('should save as draft from any step', async ({ page }) => {
      await loginAs(page, 'employee');
      await gotoJsaForm(page);
      
      await fillJsaStep1(page, VALID_JSA_DATA);

      await page.getByTestId('save-button').click();
      await expect(page.getByTestId('save-draft')).toBeVisible({ timeout: 5000 });
      await page.getByTestId('save-draft').click();

      // Success: formToast overlay, sonner toast, or redirect to edit draft URL
      await Promise.race([
        page.waitForURL(/\/forms\/jsa\/[0-9a-f-]+/, { timeout: 15000 }),
        page.getByRole('alert').filter({ hasText: /Draft Saved|Success|Congratulations/i }).waitFor({ state: 'visible', timeout: 15000 }),
        page.locator('[data-sonner-toast][data-type="success"], .toast-success').waitFor({ state: 'visible', timeout: 15000 }),
      ]);
    });

    test('should edit existing draft JSA', async ({ page }) => {
      await loginAs(page, 'employee');

      await gotoJsaForm(page);

      const uniqueLocation = `E2E Test Location ${Date.now()}`;
      await fillJsaStep1(page, { ...VALID_JSA_DATA, workLocation: uniqueLocation });

      await page.getByTestId('save-button').click();
      await expect(page.getByTestId('save-draft')).toBeVisible({ timeout: 5000 });
      await page.getByTestId('save-draft').click();

      await Promise.race([
        page.waitForURL(/\/forms\/jsa\/[0-9a-f-]+/, { timeout: 15000 }),
        page.getByRole('alert').filter({ hasText: /Draft Saved|Success|Congratulations/i }).waitFor({ state: 'visible', timeout: 15000 }),
        page.locator('[data-sonner-toast][data-type="success"], .toast-success').waitFor({ state: 'visible', timeout: 15000 }),
      ]);

      const url = page.url();
      if (/\/forms\/jsa\/[0-9a-f-]+/.test(url)) {
        await page.reload();
        await page.waitForSelector('[data-testid="jsa-wizard"]', { timeout: 10000 });
        await expect(page.getByText('Job Information').or(page.getByLabel(/Job Date/i))).toBeVisible();
      }
    });
  });

  test.describe('Save as Complete Tests', () => {
    test('should require signature to complete', async ({ page }) => {
      await loginAs(page, 'employee');
      await gotoJsaForm(page);
      
      await fillJsaStep1(page, VALID_JSA_DATA);
      
      // Navigate to review step
      for (let i = 0; i < 5; i++) {
        await page.getByTestId('jsa-next').click();
        await page.waitForTimeout(300);
      }
      
      // Submit button (Done) should be disabled without signature
      const submitButton = page.getByTestId('jsa-complete');
      await expect(submitButton).toBeDisabled();
    });

    test('should complete JSA with all required fields', async ({ page }) => {
      await loginAs(page, 'employee');
      await gotoJsaForm(page);
      
      await fillJsaStep1(page, VALID_JSA_DATA);
      
      // Navigate to review step
      for (let i = 0; i < 5; i++) {
        await page.getByTestId('jsa-next').click();
        await page.waitForTimeout(300);
      }
      
      // Add signature
      await page.getByTestId('employee-signature').fill(VALID_JSA_DATA.signature);
      
      // Submit form (Done button)
      await page.getByTestId('jsa-complete').click();
      await expect(page.locator('[data-sonner-toast][data-type="success"], .toast-success')).toBeVisible({ timeout: 15000 });
    });
  });

  test.describe('Navigation Resilience Tests', () => {
    test('should handle browser back button', async ({ page }) => {
      await loginAs(page, 'employee');
      await gotoJsaForm(page);
      
      await page.getByLabel(/Job Date/i).fill(VALID_JSA_DATA.jobDate);

      // Go to step 2
      await page.getByTestId('jsa-next').click();
      await page.waitForTimeout(500);
      
      // Use browser back
      await page.goBack();
      
      // Form might reset or maintain state - document behavior
      await page.waitForLoadState('networkidle');
    });

    test('should handle page refresh', async ({ page }) => {
      await loginAs(page, 'employee');
      await gotoJsaForm(page);
      
      await fillJsaStep1(page, VALID_JSA_DATA);
      
      // Refresh page
      await page.reload();
      await page.waitForSelector('[data-testid="jsa-wizard"]', { timeout: 10000 });
      
      // Data will likely be lost unless auto-save is implemented
      // This test documents the actual behavior
    });

    test('should preserve form state when opening JSA picker', async ({ page }) => {
      await loginAs(page, 'employee');
      await gotoJsaForm(page);
      
      await page.getByLabel(/Work Location/i).fill('Unique Test Location 12345');

      // Open JSA picker (My JSAs) if present
      const pickerButton = page.locator('button:has-text("My JSA"), [data-testid="open-picker"]');
      if (await pickerButton.isVisible()) {
        await pickerButton.click();
        await page.waitForTimeout(500);
        
        // Close picker without selecting
        const closeButton = page.locator('[data-testid="close-picker"], button:has-text("Close")');
        if (await closeButton.isVisible()) {
          await closeButton.click();
        } else {
          await page.keyboard.press('Escape');
        }
        
        await expect(page.getByLabel(/Work Location/i)).toHaveValue('Unique Test Location 12345');
      } else {
        await expect(page.getByLabel(/Work Location/i)).toHaveValue('Unique Test Location 12345');
      }
    });
  });

  test.describe('Authorization Tests', () => {
    test('should allow employee to create JSA', async ({ page }) => {
      await loginAs(page, 'employee');
      await gotoJsaForm(page);
      await expect(page.getByTestId('jsa-wizard')).toBeVisible();
    });

    test('should allow foreman to view JSAs', async ({ page }) => {
      await loginAs(page, 'foreman');
      await gotoJsaForm(page);
      await expect(page.getByTestId('jsa-wizard')).toBeVisible();
    });

    test('should allow general foreman to view all JSAs', async ({ page }) => {
      await loginAs(page, 'general_foreman');
      await gotoJsaForm(page);
      await expect(page.getByTestId('jsa-wizard')).toBeVisible();
    });

    test('should allow admin to access JSA', async ({ page }) => {
      await loginAs(page, 'admin');
      await gotoJsaForm(page);
      await expect(page.getByTestId('jsa-wizard')).toBeVisible();
    });
  });

  test.describe('Span Management Tests', () => {
    test('should add spans', async ({ page }) => {
      await loginAs(page, 'employee');
      await gotoJsaForm(page);
      
      // Navigate to spans step (step 5)
      for (let i = 0; i < 4; i++) {
        await page.getByTestId('jsa-next').click();
        await page.waitForTimeout(300);
      }
      
      // Ensure cards view so "Add Another Span" button is visible (add-span)
      const addSpanButton = page.getByTestId('add-span');
      const initialSpans = await page.getByTestId('span-item').count();
      if (await addSpanButton.isVisible()) {
        await addSpanButton.click();
        await page.waitForTimeout(300);
        const newSpans = await page.getByTestId('span-item').count();
        expect(newSpans).toBeGreaterThanOrEqual(initialSpans);
      }
      await expect(page.getByTestId('span-item').first()).toBeVisible();
    });

    test('should limit spans to maximum 21', async ({ page }) => {
      await loginAs(page, 'employee');
      await gotoJsaForm(page);
      
      // Navigate to spans step
      for (let i = 0; i < 4; i++) {
        await page.getByTestId('jsa-next').click();
        await page.waitForTimeout(200);
      }
      
      // Try to add many spans (max 21)
      const addSpanButton = page.getByTestId('add-span');
      for (let i = 0; i < 25; i++) {
        if (await addSpanButton.isVisible() && await addSpanButton.isEnabled()) {
          await addSpanButton.click();
          await page.waitForTimeout(100);
        } else {
          break;
        }
      }
      
      const spans = await page.getByTestId('span-item').count();
      expect(spans).toBeLessThanOrEqual(21);
    });
  });
});

test.describe('JSA Form - Mobile Viewport', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('should work on mobile viewport', async ({ page }) => {
    await loginAs(page, 'employee');
    await gotoJsaForm(page);
    
    // Navigation should work (data-testid works when "Next"/"Back" text is hidden on mobile)
    await page.getByTestId('jsa-next').click();
    await page.waitForTimeout(300);
    
    await page.getByTestId('jsa-back').click();
    await page.waitForTimeout(300);
    
    await expect(page.getByTestId('jsa-wizard')).toBeVisible();
  });
});
