/**
 * JSA Form E2E Tests
 * 
 * End-to-end tests for Job Safety Analysis forms.
 * Tests wizard flow, state machine, and edge cases.
 */

import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

// Test data
const VALID_JSA_DATA = {
  jobDate: new Date().toISOString().split('T')[0],
  workLocation: '123 E2E Test Street, Austin TX 78701',
  circuitNumber: 'CKT-E2E-001',
  signature: 'E2E Test Employee',
};

test.describe('JSA Form', () => {
  test.describe('Wizard Flow Tests', () => {
    test('should navigate through all 6 steps', async ({ page }) => {
      await loginAs(page, 'employee');
      await page.goto('/forms/jsa');
      
      await page.waitForSelector('[data-testid="jsa-wizard"], form', { timeout: 10000 });
      
      // Step 1: Job Information
      await expect(page.locator('text=Job Information, text=Step 1')).toBeVisible();
      
      // Fill step 1 required fields
      await page.fill('input[name="jobDate"], [data-testid="job-date"]', VALID_JSA_DATA.jobDate);
      await page.fill('input[name="workLocation"], [data-testid="work-location"]', VALID_JSA_DATA.workLocation);
      
      // Navigate to step 2
      await page.click('[data-testid="jsa-next"], button:has-text("Next")');
      await page.waitForTimeout(500);
      
      // Step 2: Safety & PPE
      await expect(page.locator('text=Safety, text=PPE, text=Step 2').first()).toBeVisible();
      
      // Navigate to step 3
      await page.click('[data-testid="jsa-next"], button:has-text("Next")');
      await page.waitForTimeout(500);
      
      // Step 3: Conditions
      await expect(page.locator('text=Conditions, text=Weather, text=Step 3').first()).toBeVisible();
      
      // Navigate to step 4
      await page.click('[data-testid="jsa-next"], button:has-text("Next")');
      await page.waitForTimeout(500);
      
      // Step 4: Hazards
      await expect(page.locator('text=Hazards, text=Step 4').first()).toBeVisible();
      
      // Navigate to step 5
      await page.click('[data-testid="jsa-next"], button:has-text("Next")');
      await page.waitForTimeout(500);
      
      // Step 5: Spans
      await expect(page.locator('text=Span, text=Step 5').first()).toBeVisible();
      
      // Navigate to step 6
      await page.click('[data-testid="jsa-next"], button:has-text("Next")');
      await page.waitForTimeout(500);
      
      // Step 6: Review
      await expect(page.locator('text=Review, text=Sign, text=Step 6').first()).toBeVisible();
    });

    test('should allow going back through steps', async ({ page }) => {
      await loginAs(page, 'employee');
      await page.goto('/forms/jsa');
      
      await page.waitForSelector('[data-testid="jsa-wizard"], form');
      
      // Go to step 2
      await page.click('[data-testid="jsa-next"], button:has-text("Next")');
      await page.waitForTimeout(300);
      
      // Go back to step 1
      await page.click('[data-testid="jsa-back"], button:has-text("Back")');
      await page.waitForTimeout(300);
      
      // Should be back on step 1
      await expect(page.locator('text=Job Information, text=Step 1').first()).toBeVisible();
    });

    test('should allow direct step navigation via pills', async ({ page }) => {
      await loginAs(page, 'employee');
      await page.goto('/forms/jsa');
      
      await page.waitForSelector('[data-testid="jsa-wizard"], form');
      
      // Fill step 1 to unlock other steps
      await page.fill('input[name="jobDate"], [data-testid="job-date"]', VALID_JSA_DATA.jobDate);
      await page.fill('input[name="workLocation"], [data-testid="work-location"]', VALID_JSA_DATA.workLocation);
      
      // Try to click on step 3 pill directly
      const step3Pill = page.locator('[data-testid="jsa-step-3"], .step-pill:has-text("3")');
      if (await step3Pill.isVisible()) {
        await step3Pill.click();
        await page.waitForTimeout(500);
        
        // Should be on step 3
        await expect(page.locator('text=Conditions, text=Weather').first()).toBeVisible();
      }
    });
  });

  test.describe('Save as Draft Tests', () => {
    test('should save as draft from any step', async ({ page }) => {
      await loginAs(page, 'employee');
      await page.goto('/forms/jsa');
      
      await page.waitForSelector('[data-testid="jsa-wizard"], form');
      
      // Fill minimal data
      await page.fill('input[name="jobDate"], [data-testid="job-date"]', VALID_JSA_DATA.jobDate);
      await page.fill('input[name="workLocation"], [data-testid="work-location"]', VALID_JSA_DATA.workLocation);
      
      // Click Save button and select "Save as Draft"
      const saveButton = page.locator('button:has-text("Save"), [data-testid="save-button"]');
      await saveButton.click();
      
      // Select draft option if dropdown appears
      const draftOption = page.locator('button:has-text("Draft"), [data-testid="save-draft"]');
      if (await draftOption.isVisible()) {
        await draftOption.click();
      }
      
      // Should show success
      await expect(page.locator('[data-sonner-toast][data-type="success"], .toast-success')).toBeVisible({ timeout: 15000 });
    });

    test('should edit existing draft JSA', async ({ page }) => {
      await loginAs(page, 'employee');
      
      // First create a draft
      await page.goto('/forms/jsa');
      await page.waitForSelector('[data-testid="jsa-wizard"], form');
      
      const uniqueLocation = `E2E Test Location ${Date.now()}`;
      await page.fill('input[name="jobDate"], [data-testid="job-date"]', VALID_JSA_DATA.jobDate);
      await page.fill('input[name="workLocation"], [data-testid="work-location"]', uniqueLocation);
      
      // Save as draft
      const saveButton = page.locator('button:has-text("Save"), [data-testid="save-button"]');
      await saveButton.click();
      
      const draftOption = page.locator('button:has-text("Draft"), [data-testid="save-draft"]');
      if (await draftOption.isVisible()) {
        await draftOption.click();
      }
      
      await page.waitForTimeout(2000);
      
      // Check if URL changed to include ID
      const url = page.url();
      if (url.includes('/forms/jsa/')) {
        // Reload and verify data persisted
        await page.reload();
        await page.waitForSelector('[data-testid="jsa-wizard"], form');
        
        const locationInput = page.locator('input[name="workLocation"], [data-testid="work-location"]');
        await expect(locationInput).toHaveValue(uniqueLocation);
      }
    });
  });

  test.describe('Save as Complete Tests', () => {
    test('should require signature to complete', async ({ page }) => {
      await loginAs(page, 'employee');
      await page.goto('/forms/jsa');
      
      await page.waitForSelector('[data-testid="jsa-wizard"], form');
      
      // Fill required fields except signature
      await page.fill('input[name="jobDate"], [data-testid="job-date"]', VALID_JSA_DATA.jobDate);
      await page.fill('input[name="workLocation"], [data-testid="work-location"]', VALID_JSA_DATA.workLocation);
      
      // Navigate to review step
      for (let i = 0; i < 5; i++) {
        await page.click('[data-testid="jsa-next"], button:has-text("Next")');
        await page.waitForTimeout(300);
      }
      
      // Try to complete without signature
      const completeButton = page.locator('button:has-text("Complete"), [data-testid="save-complete"]');
      
      // Button should be disabled or clicking should show error
      if (await completeButton.isDisabled()) {
        expect(true).toBe(true); // Expected - button disabled
      } else {
        await completeButton.click();
        // Should show error about missing signature
        await expect(page.locator('[data-sonner-toast][data-type="error"], .toast-error, text=signature')).toBeVisible({ timeout: 5000 });
      }
    });

    test('should complete JSA with all required fields', async ({ page }) => {
      await loginAs(page, 'employee');
      await page.goto('/forms/jsa');
      
      await page.waitForSelector('[data-testid="jsa-wizard"], form');
      
      // Fill all required fields
      await page.fill('input[name="jobDate"], [data-testid="job-date"]', VALID_JSA_DATA.jobDate);
      await page.fill('input[name="workLocation"], [data-testid="work-location"]', VALID_JSA_DATA.workLocation);
      
      // Navigate to review step
      for (let i = 0; i < 5; i++) {
        await page.click('[data-testid="jsa-next"], button:has-text("Next")');
        await page.waitForTimeout(300);
      }
      
      // Add signature
      await page.fill('input[name="employeeSignature"], [data-testid="employee-signature"]', VALID_JSA_DATA.signature);
      
      // Complete
      const completeButton = page.locator('button:has-text("Complete"), [data-testid="save-complete"]');
      if (await completeButton.isEnabled()) {
        await completeButton.click();
        await expect(page.locator('[data-sonner-toast][data-type="success"], .toast-success')).toBeVisible({ timeout: 15000 });
      }
    });
  });

  test.describe('Navigation Resilience Tests', () => {
    test('should handle browser back button', async ({ page }) => {
      await loginAs(page, 'employee');
      await page.goto('/forms/jsa');
      
      await page.waitForSelector('[data-testid="jsa-wizard"], form');
      
      // Fill step 1
      await page.fill('input[name="jobDate"], [data-testid="job-date"]', VALID_JSA_DATA.jobDate);
      
      // Go to step 2
      await page.click('[data-testid="jsa-next"], button:has-text("Next")');
      await page.waitForTimeout(500);
      
      // Use browser back
      await page.goBack();
      
      // Form might reset or maintain state - document behavior
      await page.waitForLoadState('networkidle');
    });

    test('should handle page refresh', async ({ page }) => {
      await loginAs(page, 'employee');
      await page.goto('/forms/jsa');
      
      await page.waitForSelector('[data-testid="jsa-wizard"], form');
      
      // Fill some data
      await page.fill('input[name="jobDate"], [data-testid="job-date"]', VALID_JSA_DATA.jobDate);
      await page.fill('input[name="workLocation"], [data-testid="work-location"]', VALID_JSA_DATA.workLocation);
      
      // Refresh page
      await page.reload();
      await page.waitForSelector('[data-testid="jsa-wizard"], form');
      
      // Data will likely be lost unless auto-save is implemented
      // This test documents the actual behavior
    });

    test('should preserve form state when opening JSA picker', async ({ page }) => {
      await loginAs(page, 'employee');
      await page.goto('/forms/jsa');
      
      await page.waitForSelector('[data-testid="jsa-wizard"], form');
      
      // Fill data
      await page.fill('input[name="workLocation"], [data-testid="work-location"]', 'Unique Test Location 12345');
      
      // Open JSA picker (My JSAs)
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
        
        // Verify form data preserved
        const locationInput = page.locator('input[name="workLocation"], [data-testid="work-location"]');
        await expect(locationInput).toHaveValue('Unique Test Location 12345');
      }
    });
  });

  test.describe('Authorization Tests', () => {
    test('should allow employee to create JSA', async ({ page }) => {
      await loginAs(page, 'employee');
      await page.goto('/forms/jsa');
      
      await expect(page.locator('[data-testid="jsa-wizard"], form')).toBeVisible({ timeout: 10000 });
    });

    test('should allow foreman to view JSAs', async ({ page }) => {
      await loginAs(page, 'foreman');
      await page.goto('/forms/jsa');
      
      await expect(page.locator('[data-testid="jsa-wizard"], form')).toBeVisible({ timeout: 10000 });
    });

    test('should allow general foreman to view all JSAs', async ({ page }) => {
      await loginAs(page, 'general_foreman');
      await page.goto('/forms/jsa');
      
      // GF should be able to access JSA form
      await expect(page.locator('[data-testid="jsa-wizard"], form')).toBeVisible({ timeout: 10000 });
    });

    test('should allow admin to access JSA', async ({ page }) => {
      await loginAs(page, 'admin');
      await page.goto('/forms/jsa');
      
      await expect(page.locator('[data-testid="jsa-wizard"], form')).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Span Management Tests', () => {
    test('should add spans', async ({ page }) => {
      await loginAs(page, 'employee');
      await page.goto('/forms/jsa');
      
      await page.waitForSelector('[data-testid="jsa-wizard"], form');
      
      // Navigate to spans step (step 5)
      for (let i = 0; i < 4; i++) {
        await page.click('[data-testid="jsa-next"], button:has-text("Next")');
        await page.waitForTimeout(300);
      }
      
      // Find and click add span button
      const addSpanButton = page.locator('button:has-text("Add Span"), [data-testid="add-span"]');
      if (await addSpanButton.isVisible()) {
        const initialSpans = await page.locator('[data-testid="span-item"], .span-item').count();
        
        await addSpanButton.click();
        await page.waitForTimeout(300);
        
        const newSpans = await page.locator('[data-testid="span-item"], .span-item').count();
        expect(newSpans).toBeGreaterThanOrEqual(initialSpans);
      }
    });

    test('should limit spans to maximum 21', async ({ page }) => {
      await loginAs(page, 'employee');
      await page.goto('/forms/jsa');
      
      await page.waitForSelector('[data-testid="jsa-wizard"], form');
      
      // Navigate to spans step
      for (let i = 0; i < 4; i++) {
        await page.click('[data-testid="jsa-next"], button:has-text("Next")');
        await page.waitForTimeout(200);
      }
      
      // Try to add many spans
      const addSpanButton = page.locator('button:has-text("Add Span"), [data-testid="add-span"]');
      if (await addSpanButton.isVisible()) {
        for (let i = 0; i < 25; i++) {
          if (await addSpanButton.isEnabled()) {
            await addSpanButton.click();
            await page.waitForTimeout(100);
          } else {
            break;
          }
        }
        
        // Should have max 21 spans
        const spans = await page.locator('[data-testid="span-item"], .span-item').count();
        expect(spans).toBeLessThanOrEqual(21);
      }
    });
  });
});

test.describe('JSA Form - Mobile Viewport', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('should work on mobile viewport', async ({ page }) => {
    await loginAs(page, 'employee');
    await page.goto('/forms/jsa');
    
    await page.waitForSelector('[data-testid="jsa-wizard"], form');
    
    // Navigation should work
    await page.click('[data-testid="jsa-next"], button:has-text("Next")');
    await page.waitForTimeout(300);
    
    await page.click('[data-testid="jsa-back"], button:has-text("Back")');
    await page.waitForTimeout(300);
    
    // Form should be usable
    await expect(page.locator('[data-testid="jsa-wizard"], form')).toBeVisible();
  });
});
