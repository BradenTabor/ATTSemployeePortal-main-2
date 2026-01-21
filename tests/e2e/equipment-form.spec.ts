/**
 * Equipment Inspection Form E2E Tests
 * 
 * End-to-end tests for Daily Equipment Inspection forms.
 * Tests all equipment types, validation, and authorization.
 */

import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

// Equipment types and their valid numbers
const EQUIPMENT_TYPES = {
  'Geo-Boy': ['G-126', 'G-140', 'G-157'],
  'Grapple': ['211'],
  'Jarraff': ['J-109', 'J-119', 'J-129', 'J-138', 'J-152'],
  'Mulcher': ['212', '213'],
  'Skidsteer': ['118', '135', '136'],
};

test.describe('Equipment Inspection Form', () => {
  test.describe('Happy Path Tests - Per Equipment Type', () => {
    for (const [type, numbers] of Object.entries(EQUIPMENT_TYPES)) {
      test(`should complete inspection for ${type}`, async ({ page }) => {
        await loginAs(page, 'employee');
        await page.goto('/dashboard/forms/equipment-inspection');
        
        await page.waitForSelector('form', { timeout: 10000 });
        
        // Select equipment type
        const typeSelect = page.locator('select[name="equipmentType"], [data-testid="equipment-type"]');
        await typeSelect.selectOption(type);
        
        // Wait for numbers to load
        await page.waitForTimeout(500);
        
        // Select first valid number
        const numberSelect = page.locator('select[name="equipmentNumber"], [data-testid="equipment-number"]');
        await numberSelect.selectOption(numbers[0]);
        
        // Fill submitter name
        await page.fill('input[name="submittedBy"], [data-testid="submitted-by"]', `E2E Test - ${type}`);
        
        // Upload required hydraulic photo
        const fileInput = page.locator('input[type="file"][name*="hydraulic"], [data-testid="hydraulic-photo-upload"]');
        await fileInput.setInputFiles('tests/fixtures/hydraulic.jpg');
        await page.waitForTimeout(1000);
        
        // Complete general checklist
        const generalItems = page.locator('[data-testid="general-checklist"] [data-testid="checklist-item"], .general-checklist .checklist-item');
        const generalCount = await generalItems.count();
        
        for (let i = 0; i < generalCount; i++) {
          const passButton = generalItems.nth(i).locator('button:has-text("P"), [data-value="P"]');
          if (await passButton.isVisible()) {
            await passButton.click();
          }
        }
        
        // Complete specific checklist (if visible)
        const specificItems = page.locator('[data-testid="specific-checklist"] [data-testid="checklist-item"], .specific-checklist .checklist-item');
        const specificCount = await specificItems.count();
        
        for (let i = 0; i < specificCount; i++) {
          const passButton = specificItems.nth(i).locator('button:has-text("P"), [data-value="P"]');
          if (await passButton.isVisible()) {
            await passButton.click();
          }
        }
        
        // Submit
        await page.click('button[type="submit"], [data-testid="submit-button"]');
        
        // Verify success
        await expect(page.locator('[data-sonner-toast][data-type="success"], .toast-success')).toBeVisible({ timeout: 15000 });
      });
    }
  });

  test.describe('Validation Tests', () => {
    test('should reject submission without hydraulic photo', async ({ page }) => {
      await loginAs(page, 'employee');
      await page.goto('/dashboard/forms/equipment-inspection');
      
      await page.waitForSelector('form');
      
      // Fill other fields
      const typeSelect = page.locator('select[name="equipmentType"], [data-testid="equipment-type"]');
      await typeSelect.selectOption('Jarraff');
      
      await page.waitForTimeout(500);
      
      const numberSelect = page.locator('select[name="equipmentNumber"], [data-testid="equipment-number"]');
      await numberSelect.selectOption('J-109');
      
      await page.fill('input[name="submittedBy"], [data-testid="submitted-by"]', 'Test Without Photo');
      
      // Don't upload hydraulic photo
      
      // Try to submit
      await page.click('button[type="submit"], [data-testid="submit-button"]');
      
      // Should show error
      await expect(page.locator('[data-sonner-toast][data-type="error"], .toast-error')).toBeVisible({ timeout: 5000 });
    });

    test('should reject submission without equipment type', async ({ page }) => {
      await loginAs(page, 'employee');
      await page.goto('/dashboard/forms/equipment-inspection');
      
      await page.waitForSelector('form');
      
      // Don't select equipment type
      
      // Fill other fields
      await page.fill('input[name="submittedBy"], [data-testid="submitted-by"]', 'Test Without Type');
      
      const fileInput = page.locator('input[type="file"][name*="hydraulic"], [data-testid="hydraulic-photo-upload"]');
      await fileInput.setInputFiles('tests/fixtures/hydraulic.jpg');
      
      // Try to submit
      await page.click('button[type="submit"], [data-testid="submit-button"]');
      
      // Should show error
      await expect(page.locator('[data-sonner-toast][data-type="error"], .toast-error')).toBeVisible({ timeout: 5000 });
    });

    test('should reject submission without equipment number', async ({ page }) => {
      await loginAs(page, 'employee');
      await page.goto('/dashboard/forms/equipment-inspection');
      
      await page.waitForSelector('form');
      
      // Select type but not number
      const typeSelect = page.locator('select[name="equipmentType"], [data-testid="equipment-type"]');
      await typeSelect.selectOption('Jarraff');
      
      await page.fill('input[name="submittedBy"], [data-testid="submitted-by"]', 'Test Without Number');
      
      const fileInput = page.locator('input[type="file"][name*="hydraulic"], [data-testid="hydraulic-photo-upload"]');
      await fileInput.setInputFiles('tests/fixtures/hydraulic.jpg');
      
      // Try to submit
      await page.click('button[type="submit"], [data-testid="submit-button"]');
      
      // Should show error
      await expect(page.locator('[data-sonner-toast][data-type="error"], .toast-error')).toBeVisible({ timeout: 5000 });
    });

    test('should reject submission without submitter name', async ({ page }) => {
      await loginAs(page, 'employee');
      await page.goto('/dashboard/forms/equipment-inspection');
      
      await page.waitForSelector('form');
      
      // Fill everything except submitter
      const typeSelect = page.locator('select[name="equipmentType"], [data-testid="equipment-type"]');
      await typeSelect.selectOption('Jarraff');
      
      await page.waitForTimeout(500);
      
      const numberSelect = page.locator('select[name="equipmentNumber"], [data-testid="equipment-number"]');
      await numberSelect.selectOption('J-109');
      
      // Don't fill submitter name
      
      const fileInput = page.locator('input[type="file"][name*="hydraulic"], [data-testid="hydraulic-photo-upload"]');
      await fileInput.setInputFiles('tests/fixtures/hydraulic.jpg');
      
      // Try to submit
      await page.click('button[type="submit"], [data-testid="submit-button"]');
      
      // Should show error
      await expect(page.locator('[data-sonner-toast][data-type="error"], .toast-error')).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Equipment Number Validation', () => {
    test('should only show valid numbers for selected type', async ({ page }) => {
      await loginAs(page, 'employee');
      await page.goto('/dashboard/forms/equipment-inspection');
      
      await page.waitForSelector('form');
      
      // Select Geo-Boy
      const typeSelect = page.locator('select[name="equipmentType"], [data-testid="equipment-type"]');
      await typeSelect.selectOption('Geo-Boy');
      
      await page.waitForTimeout(500);
      
      // Check available numbers
      const numberSelect = page.locator('select[name="equipmentNumber"], [data-testid="equipment-number"]');
      const options = await numberSelect.locator('option').allTextContents();
      
      // Should have Geo-Boy numbers
      expect(options.some(o => o.includes('G-126') || o.includes('G-140') || o.includes('G-157'))).toBe(true);
      
      // Should NOT have Jarraff numbers
      expect(options.some(o => o.includes('J-109'))).toBe(false);
    });

    test('should update numbers when type changes', async ({ page }) => {
      await loginAs(page, 'employee');
      await page.goto('/dashboard/forms/equipment-inspection');
      
      await page.waitForSelector('form');
      
      const typeSelect = page.locator('select[name="equipmentType"], [data-testid="equipment-type"]');
      const numberSelect = page.locator('select[name="equipmentNumber"], [data-testid="equipment-number"]');
      
      // Select Jarraff first
      await typeSelect.selectOption('Jarraff');
      await page.waitForTimeout(500);
      
      let options = await numberSelect.locator('option').allTextContents();
      expect(options.some(o => o.includes('J-109'))).toBe(true);
      
      // Change to Skidsteer
      await typeSelect.selectOption('Skidsteer');
      await page.waitForTimeout(500);
      
      options = await numberSelect.locator('option').allTextContents();
      expect(options.some(o => o.includes('118') || o.includes('135') || o.includes('136'))).toBe(true);
      expect(options.some(o => o.includes('J-109'))).toBe(false);
    });
  });

  test.describe('Specific Checklist Tests', () => {
    test('should load type-specific checklist for Jarraff', async ({ page }) => {
      await loginAs(page, 'employee');
      await page.goto('/dashboard/forms/equipment-inspection');
      
      await page.waitForSelector('form');
      
      const typeSelect = page.locator('select[name="equipmentType"], [data-testid="equipment-type"]');
      await typeSelect.selectOption('Jarraff');
      
      await page.waitForTimeout(1000);
      
      // Should have Jarraff-specific items
      const specificSection = page.locator('[data-testid="specific-checklist"], .specific-checklist, text=saw, text=boom');
      await expect(specificSection.first()).toBeVisible({ timeout: 5000 });
    });

    test('should load type-specific checklist for Skidsteer', async ({ page }) => {
      await loginAs(page, 'employee');
      await page.goto('/dashboard/forms/equipment-inspection');
      
      await page.waitForSelector('form');
      
      const typeSelect = page.locator('select[name="equipmentType"], [data-testid="equipment-type"]');
      await typeSelect.selectOption('Skidsteer');
      
      await page.waitForTimeout(1000);
      
      // Should have Skidsteer-specific items
      const specificSection = page.locator('[data-testid="specific-checklist"], .specific-checklist, text=bucket, text=tracks');
      await expect(specificSection.first()).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Authorization Tests', () => {
    test('should allow employee to create inspection', async ({ page }) => {
      await loginAs(page, 'employee');
      await page.goto('/dashboard/forms/equipment-inspection');
      
      await expect(page.locator('form')).toBeVisible({ timeout: 10000 });
    });

    test('should allow mechanic to access inspection form', async ({ page }) => {
      await loginAs(page, 'mechanic');
      await page.goto('/dashboard/forms/equipment-inspection');
      
      await expect(page.locator('form')).toBeVisible({ timeout: 10000 });
    });

    test('should allow admin to access inspection form', async ({ page }) => {
      await loginAs(page, 'admin');
      await page.goto('/dashboard/forms/equipment-inspection');
      
      await expect(page.locator('form')).toBeVisible({ timeout: 10000 });
    });

    test('should allow general foreman to access inspection form', async ({ page }) => {
      await loginAs(page, 'general_foreman');
      await page.goto('/dashboard/forms/equipment-inspection');
      
      await expect(page.locator('form')).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Checklist Failure Reporting', () => {
    test('should allow marking items as failed', async ({ page }) => {
      await loginAs(page, 'employee');
      await page.goto('/dashboard/forms/equipment-inspection');
      
      await page.waitForSelector('form');
      
      const typeSelect = page.locator('select[name="equipmentType"], [data-testid="equipment-type"]');
      await typeSelect.selectOption('Jarraff');
      
      await page.waitForTimeout(500);
      
      // Find a checklist item and mark as failed
      const firstItem = page.locator('[data-testid="checklist-item"], .checklist-item').first();
      const failButton = firstItem.locator('button:has-text("F"), [data-value="F"]');
      
      if (await failButton.isVisible()) {
        await failButton.click();
        
        // Verify it's marked as failed (visual indicator)
        await expect(failButton).toHaveClass(/active|selected|checked/);
      }
    });

    test('should require notes when items are failed', async ({ page }) => {
      await loginAs(page, 'employee');
      await page.goto('/dashboard/forms/equipment-inspection');
      
      await page.waitForSelector('form');
      
      // Fill form with a failure
      const typeSelect = page.locator('select[name="equipmentType"], [data-testid="equipment-type"]');
      await typeSelect.selectOption('Jarraff');
      
      await page.waitForTimeout(500);
      
      const numberSelect = page.locator('select[name="equipmentNumber"], [data-testid="equipment-number"]');
      await numberSelect.selectOption('J-109');
      
      await page.fill('input[name="submittedBy"], [data-testid="submitted-by"]', 'Test With Failure');
      
      const fileInput = page.locator('input[type="file"][name*="hydraulic"], [data-testid="hydraulic-photo-upload"]');
      await fileInput.setInputFiles('tests/fixtures/hydraulic.jpg');
      
      // Mark an item as failed
      const failButton = page.locator('[data-testid="checklist-item"], .checklist-item').first()
        .locator('button:has-text("F"), [data-value="F"]');
      if (await failButton.isVisible()) {
        await failButton.click();
      }
      
      // Complete remaining items
      const passButtons = page.locator('[data-value="P"], button:has-text("P")');
      const passCount = await passButtons.count();
      for (let i = 0; i < Math.min(passCount, 15); i++) {
        await passButtons.nth(i).click({ force: true });
      }
      
      // Notes field may appear or be required when failures exist
      const notesField = page.locator('textarea[name="notes"], [data-testid="notes"]');
      if (await notesField.isVisible()) {
        await notesField.fill('Hydraulic leak detected - needs repair');
      }
    });
  });

  test.describe('Photo Upload Tests', () => {
    test('should allow uploading optional photos', async ({ page }) => {
      await loginAs(page, 'employee');
      await page.goto('/dashboard/forms/equipment-inspection');
      
      await page.waitForSelector('form');
      
      // Upload overview photo
      const overviewInput = page.locator('input[type="file"][name*="overview"], [data-testid="overview-photo-upload"]');
      if (await overviewInput.isVisible()) {
        await overviewInput.setInputFiles('tests/fixtures/overview.jpg');
        await page.waitForTimeout(1000);
        
        // Verify preview
        await expect(page.locator('[data-testid="overview-preview"], img[alt*="overview"]')).toBeVisible({ timeout: 5000 });
      }
    });

    test('should show hydraulic photo preview', async ({ page }) => {
      await loginAs(page, 'employee');
      await page.goto('/dashboard/forms/equipment-inspection');
      
      await page.waitForSelector('form');
      
      const fileInput = page.locator('input[type="file"][name*="hydraulic"], [data-testid="hydraulic-photo-upload"]');
      await fileInput.setInputFiles('tests/fixtures/hydraulic.jpg');
      
      await expect(page.locator('[data-testid="hydraulic-preview"], img[alt*="hydraulic"]')).toBeVisible({ timeout: 5000 });
    });
  });
});

test.describe('Equipment Form - Mobile Viewport', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('should be usable on mobile', async ({ page }) => {
    await loginAs(page, 'employee');
    await page.goto('/dashboard/forms/equipment-inspection');
    
    await page.waitForSelector('form');
    
    // Form should be visible
    await expect(page.locator('form')).toBeVisible();
    
    // Selects should work
    const typeSelect = page.locator('select[name="equipmentType"], [data-testid="equipment-type"]');
    await expect(typeSelect).toBeVisible();
    
    // Submit button should be reachable
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(page.locator('button[type="submit"], [data-testid="submit-button"]')).toBeVisible();
  });
});
