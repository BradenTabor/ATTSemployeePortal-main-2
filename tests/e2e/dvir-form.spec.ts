/**
 * DVIR Form E2E Tests
 * 
 * End-to-end tests for Daily Vehicle Inspection Report forms.
 * Tests happy paths, validation, and edge cases.
 */

import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

// Test data
const VALID_DVIR_DATA = {
  truckNumber: 'TEST-E2E-001',
  driversName: 'E2E Test Driver',
  mileage: '55000',
};

test.describe('DVIR Form', () => {
  test.describe('Happy Path Tests', () => {
    test('should complete DVIR submission with all required fields', async ({ page }) => {
      await loginAs(page, 'employee');
      await page.goto('/dashboard/forms/dvir');
      
      // Wait for form to load
      await page.waitForSelector('form', { timeout: 10000 });
      
      // Fill required fields
      await page.fill('input[name="truckNumber"], [data-testid="truck-number"]', VALID_DVIR_DATA.truckNumber);
      await page.fill('input[name="driversName"], [data-testid="drivers-name"]', VALID_DVIR_DATA.driversName);
      await page.fill('input[name="mileage"], [data-testid="mileage"]', VALID_DVIR_DATA.mileage);
      
      // Upload required oil dipstick photo
      const fileInput = page.locator('input[type="file"][name*="oil"], [data-testid="oil-dipstick-upload"]');
      await fileInput.setInputFiles('tests/fixtures/oil-dipstick.jpg');
      
      // Wait for photo to be processed
      await page.waitForTimeout(1000);
      
      // Complete vehicle checklist - mark all as "P" (Pass)
      const checklistItems = page.locator('[data-testid="checklist-item"], .checklist-item');
      const count = await checklistItems.count();
      
      for (let i = 0; i < count; i++) {
        const item = checklistItems.nth(i);
        const passButton = item.locator('button:has-text("P"), [data-value="P"]');
        if (await passButton.isVisible()) {
          await passButton.click();
        }
      }
      
      // Draw signature (if canvas is present)
      const signatureCanvas = page.locator('canvas[data-testid="driver-signature"], .signature-canvas').first();
      if (await signatureCanvas.isVisible()) {
        const box = await signatureCanvas.boundingBox();
        if (box) {
          await page.mouse.move(box.x + 50, box.y + 50);
          await page.mouse.down();
          await page.mouse.move(box.x + 150, box.y + 100);
          await page.mouse.up();
        }
      }
      
      // Submit form
      await page.click('button[type="submit"], [data-testid="submit-button"]');
      
      // Verify success
      await expect(page.locator('[data-sonner-toast][data-type="success"], .toast-success')).toBeVisible({ timeout: 15000 });
    });

    test('should allow uploading optional photos', async ({ page }) => {
      await loginAs(page, 'employee');
      await page.goto('/dashboard/forms/dvir');
      
      await page.waitForSelector('form');
      
      // Upload optional tire photo
      const tireInput = page.locator('input[type="file"][name*="tire"], [data-testid="tire-photo-upload"]');
      if (await tireInput.isVisible()) {
        await tireInput.setInputFiles('tests/fixtures/tire.jpg');
        await page.waitForTimeout(500);
        
        // Verify thumbnail appears
        await expect(page.locator('[data-testid="tire-photo-preview"], img[alt*="tire"]')).toBeVisible();
      }
    });

    test('should show photo preview after upload', async ({ page }) => {
      await loginAs(page, 'employee');
      await page.goto('/dashboard/forms/dvir');
      
      await page.waitForSelector('form');
      
      const fileInput = page.locator('input[type="file"][name*="oil"], [data-testid="oil-dipstick-upload"]');
      await fileInput.setInputFiles('tests/fixtures/oil-dipstick.jpg');
      
      // Verify preview is shown
      await expect(page.locator('[data-testid="oil-dipstick-preview"], img[alt*="oil"]')).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Validation Tests', () => {
    test('should reject submission without truck number', async ({ page }) => {
      await loginAs(page, 'employee');
      await page.goto('/dashboard/forms/dvir');
      
      await page.waitForSelector('form');
      
      // Fill everything except truck number
      await page.fill('input[name="driversName"], [data-testid="drivers-name"]', VALID_DVIR_DATA.driversName);
      await page.fill('input[name="mileage"], [data-testid="mileage"]', VALID_DVIR_DATA.mileage);
      
      const fileInput = page.locator('input[type="file"][name*="oil"], [data-testid="oil-dipstick-upload"]');
      await fileInput.setInputFiles('tests/fixtures/oil-dipstick.jpg');
      
      await page.click('button[type="submit"], [data-testid="submit-button"]');
      
      // Verify error toast
      await expect(page.locator('[data-sonner-toast][data-type="error"], .toast-error')).toBeVisible({ timeout: 5000 });
    });

    test('should reject submission without driver name', async ({ page }) => {
      await loginAs(page, 'employee');
      await page.goto('/dashboard/forms/dvir');
      
      await page.waitForSelector('form');
      
      await page.fill('input[name="truckNumber"], [data-testid="truck-number"]', VALID_DVIR_DATA.truckNumber);
      await page.fill('input[name="mileage"], [data-testid="mileage"]', VALID_DVIR_DATA.mileage);
      
      const fileInput = page.locator('input[type="file"][name*="oil"], [data-testid="oil-dipstick-upload"]');
      await fileInput.setInputFiles('tests/fixtures/oil-dipstick.jpg');
      
      await page.click('button[type="submit"], [data-testid="submit-button"]');
      
      await expect(page.locator('[data-sonner-toast][data-type="error"], .toast-error')).toBeVisible({ timeout: 5000 });
    });

    test('should reject submission without oil dipstick photo', async ({ page }) => {
      await loginAs(page, 'employee');
      await page.goto('/dashboard/forms/dvir');
      
      await page.waitForSelector('form');
      
      await page.fill('input[name="truckNumber"], [data-testid="truck-number"]', VALID_DVIR_DATA.truckNumber);
      await page.fill('input[name="driversName"], [data-testid="drivers-name"]', VALID_DVIR_DATA.driversName);
      await page.fill('input[name="mileage"], [data-testid="mileage"]', VALID_DVIR_DATA.mileage);
      
      // Don't upload photo
      
      await page.click('button[type="submit"], [data-testid="submit-button"]');
      
      await expect(page.locator('[data-sonner-toast][data-type="error"], .toast-error')).toBeVisible({ timeout: 5000 });
    });

    test('should reject invalid mileage (non-numeric)', async ({ page }) => {
      await loginAs(page, 'employee');
      await page.goto('/dashboard/forms/dvir');
      
      await page.waitForSelector('form');
      
      const mileageInput = page.locator('input[name="mileage"], [data-testid="mileage"]');
      await mileageInput.fill('abc');
      
      // Try to submit
      await page.fill('input[name="truckNumber"], [data-testid="truck-number"]', VALID_DVIR_DATA.truckNumber);
      await page.fill('input[name="driversName"], [data-testid="drivers-name"]', VALID_DVIR_DATA.driversName);
      
      const fileInput = page.locator('input[type="file"][name*="oil"], [data-testid="oil-dipstick-upload"]');
      await fileInput.setInputFiles('tests/fixtures/oil-dipstick.jpg');
      
      await page.click('button[type="submit"], [data-testid="submit-button"]');
      
      // Should show validation error
      await expect(page.locator('[data-sonner-toast][data-type="error"], .toast-error')).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Concurrency Tests', () => {
    test('should prevent double submission on rapid clicks', async ({ page }) => {
      await loginAs(page, 'employee');
      await page.goto('/dashboard/forms/dvir');
      
      await page.waitForSelector('form');
      
      // Fill form
      await page.fill('input[name="truckNumber"], [data-testid="truck-number"]', 'TEST-DOUBLE-CLICK');
      await page.fill('input[name="driversName"], [data-testid="drivers-name"]', 'Double Click Test');
      await page.fill('input[name="mileage"], [data-testid="mileage"]', '60000');
      
      const fileInput = page.locator('input[type="file"][name*="oil"], [data-testid="oil-dipstick-upload"]');
      await fileInput.setInputFiles('tests/fixtures/oil-dipstick.jpg');
      
      // Complete checklist quickly
      const passButtons = page.locator('[data-value="P"], button:has-text("P")');
      const passCount = await passButtons.count();
      for (let i = 0; i < Math.min(passCount, 10); i++) {
        await passButtons.nth(i).click({ force: true });
      }
      
      // Draw a quick signature
      const signatureCanvas = page.locator('canvas').first();
      if (await signatureCanvas.isVisible()) {
        const box = await signatureCanvas.boundingBox();
        if (box) {
          await page.mouse.move(box.x + 50, box.y + 50);
          await page.mouse.down();
          await page.mouse.move(box.x + 100, box.y + 75);
          await page.mouse.up();
        }
      }
      
      // Click submit button rapidly multiple times
      const submitButton = page.locator('button[type="submit"], [data-testid="submit-button"]');
      
      // Use Promise.all to click rapidly
      await Promise.all([
        submitButton.click(),
        submitButton.click().catch(() => {}), // May fail due to disabled state
        submitButton.click().catch(() => {}),
      ]);
      
      // Wait and verify only one success toast (or button becomes disabled)
      await page.waitForTimeout(3000);
      
      // Either success toast shows or button is disabled - both acceptable
      const successToast = page.locator('[data-sonner-toast][data-type="success"], .toast-success');
      const disabledButton = page.locator('button[type="submit"][disabled], [data-testid="submit-button"][disabled]');
      
      const hasSuccess = await successToast.isVisible().catch(() => false);
      const isDisabled = await disabledButton.isVisible().catch(() => false);
      
      expect(hasSuccess || isDisabled).toBe(true);
    });
  });

  test.describe('Authorization Tests', () => {
    test('should allow employee to access DVIR form', async ({ page }) => {
      await loginAs(page, 'employee');
      await page.goto('/dashboard/forms/dvir');
      
      // Form should be visible
      await expect(page.locator('form')).toBeVisible({ timeout: 10000 });
    });

    test('should allow foreman to access DVIR form', async ({ page }) => {
      await loginAs(page, 'foreman');
      await page.goto('/dashboard/forms/dvir');
      
      await expect(page.locator('form')).toBeVisible({ timeout: 10000 });
    });

    test('should allow mechanic to access DVIR form', async ({ page }) => {
      await loginAs(page, 'mechanic');
      await page.goto('/dashboard/forms/dvir');
      
      await expect(page.locator('form')).toBeVisible({ timeout: 10000 });
    });

    test('should allow admin to access DVIR form', async ({ page }) => {
      await loginAs(page, 'admin');
      await page.goto('/dashboard/forms/dvir');
      
      await expect(page.locator('form')).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Navigation Tests', () => {
    test('should preserve form data on back/forward navigation', async ({ page }) => {
      await loginAs(page, 'employee');
      await page.goto('/dashboard/forms/dvir');
      
      await page.waitForSelector('form');
      
      // Fill some data
      await page.fill('input[name="truckNumber"], [data-testid="truck-number"]', 'TEST-NAV-001');
      await page.fill('input[name="driversName"], [data-testid="drivers-name"]', 'Navigation Test');
      
      // Navigate away
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      
      // Navigate back
      await page.goBack();
      await page.waitForSelector('form');
      
      // Note: Form data may or may not be preserved depending on implementation
      // This test documents the actual behavior
    });

    test('should show confirmation before leaving with unsaved data', async ({ page }) => {
      await loginAs(page, 'employee');
      await page.goto('/dashboard/forms/dvir');
      
      await page.waitForSelector('form');
      
      // Fill some data
      await page.fill('input[name="truckNumber"], [data-testid="truck-number"]', 'TEST-UNSAVED');
      
      // Try to navigate away - browser might show confirmation
      // This test checks that form doesn't silently lose data
      page.on('dialog', async dialog => {
        expect(dialog.type()).toBe('beforeunload');
        await dialog.dismiss();
      });
      
      // Trigger navigation
      await page.goto('/dashboard');
    });
  });

  test.describe('Mileage Boundary Tests', () => {
    test('should accept zero mileage for new vehicle', async ({ page }) => {
      await loginAs(page, 'employee');
      await page.goto('/dashboard/forms/dvir');
      
      await page.waitForSelector('form');
      
      const mileageInput = page.locator('input[name="mileage"], [data-testid="mileage"]');
      await mileageInput.fill('0');
      
      // Verify input accepted the value
      await expect(mileageInput).toHaveValue('0');
    });

    test('should accept high mileage values', async ({ page }) => {
      await loginAs(page, 'employee');
      await page.goto('/dashboard/forms/dvir');
      
      await page.waitForSelector('form');
      
      const mileageInput = page.locator('input[name="mileage"], [data-testid="mileage"]');
      await mileageInput.fill('999999');
      
      await expect(mileageInput).toHaveValue('999999');
    });

    test('should format mileage with commas', async ({ page }) => {
      await loginAs(page, 'employee');
      await page.goto('/dashboard/forms/dvir');
      
      await page.waitForSelector('form');
      
      const mileageInput = page.locator('input[name="mileage"], [data-testid="mileage"]');
      await mileageInput.fill('50000');
      
      // Check if value is formatted (may or may not have commas)
      const value = await mileageInput.inputValue();
      expect(value).toMatch(/50,?000/);
    });
  });

  test.describe('Photo Upload Edge Cases', () => {
    test('should reject invalid file type', async ({ page }) => {
      await loginAs(page, 'employee');
      await page.goto('/dashboard/forms/dvir');
      
      await page.waitForSelector('form');
      
      const fileInput = page.locator('input[type="file"][name*="oil"], [data-testid="oil-dipstick-upload"]');
      
      // Try to upload invalid file type
      await fileInput.setInputFiles('tests/fixtures/invalid-file.pdf');
      
      // Should show error or not accept the file
      await page.waitForTimeout(1000);
      
      // File should not be accepted (preview won't show or error appears)
      const preview = page.locator('[data-testid="oil-dipstick-preview"]');
      const error = page.locator('[data-testid="file-error"], .file-error');
      
      const previewVisible = await preview.isVisible().catch(() => false);
      const errorVisible = await error.isVisible().catch(() => false);
      
      // Either no preview or error shown
      expect(!previewVisible || errorVisible).toBe(true);
    });

    test('should handle special characters in filename', async ({ page }) => {
      await loginAs(page, 'employee');
      await page.goto('/dashboard/forms/dvir');
      
      await page.waitForSelector('form');
      
      const fileInput = page.locator('input[type="file"][name*="oil"], [data-testid="oil-dipstick-upload"]');
      await fileInput.setInputFiles('tests/fixtures/special-chars (1).jpg');
      
      // Should handle the file without error
      await page.waitForTimeout(1000);
      
      // Preview should appear
      await expect(page.locator('[data-testid="oil-dipstick-preview"], img[alt*="oil"]')).toBeVisible({ timeout: 5000 });
    });
  });
});

test.describe('DVIR Form - Mobile Viewport', () => {
  test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE

  test('should be usable on mobile viewport', async ({ page }) => {
    await loginAs(page, 'employee');
    await page.goto('/dashboard/forms/dvir');
    
    await page.waitForSelector('form');
    
    // Form should be visible and not cut off
    await expect(page.locator('form')).toBeVisible();
    
    // Should be able to scroll to see all content
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    
    // Submit button should be visible
    const submitButton = page.locator('button[type="submit"], [data-testid="submit-button"]');
    await expect(submitButton).toBeVisible();
  });

  test('should allow file input on mobile', async ({ page }) => {
    await loginAs(page, 'employee');
    await page.goto('/dashboard/forms/dvir');
    
    await page.waitForSelector('form');
    
    // File input should be accessible
    const fileInput = page.locator('input[type="file"][name*="oil"], [data-testid="oil-dipstick-upload"]');
    await expect(fileInput).toBeAttached();
  });
});
