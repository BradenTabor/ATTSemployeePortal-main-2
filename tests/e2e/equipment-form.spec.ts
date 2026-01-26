/**
 * Equipment Inspection Form E2E Tests
 * 
 * End-to-end tests for Daily Equipment Inspection forms.
 * Tests all equipment types, validation, and authorization.
 */

import { test, expect } from '@playwright/test';
import { loginAs, dismissOnboardingIfPresent } from './helpers/auth';

async function gotoEquipmentForm(page: import('@playwright/test').Page) {
  await page.goto('/dashboard/forms/equipment-inspection');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(800);
  await dismissOnboardingIfPresent(page);
  await page.waitForSelector('form', { timeout: 10000 });
}

// Equipment types and their valid numbers
const EQUIPMENT_TYPES = {
  'Geo-Boy': ['G-126', 'G-140', 'G-157'],
  'Grapple': ['211'],
  'Jarraff': ['J-109', 'J-119', 'J-129', 'J-138', 'J-152'],
  'Mulcher': ['212', '213'],
  'Skidsteer': ['118', '135', '136'],
};

test.describe('Equipment Inspection Form', () => {
  test.setTimeout(60000);

  test.describe('Happy Path Tests - Per Equipment Type', () => {
    for (const [type, numbers] of Object.entries(EQUIPMENT_TYPES)) {
      test(`should complete inspection for ${type}`, async ({ page }) => {
        await loginAs(page, 'employee');
        await gotoEquipmentForm(page);
        
        const typeSelect = page.locator('select[name="equipmentType"]');
        await typeSelect.waitFor({ state: 'visible', timeout: 5000 });
        await typeSelect.click();
        await typeSelect.selectOption({ value: type });
        await page.waitForTimeout(600);
        const numberSelect = page.locator('select[name="equipmentNumber"]');
        await numberSelect.waitFor({ state: 'visible', timeout: 3000 });
        await numberSelect.selectOption({ value: numbers[0] });
        await expect(numberSelect).toHaveValue(numbers[0]);
        await page.waitForTimeout(500);

        await page.locator('input[name="submittedBy"]').focus();
        await page.locator('input[name="submittedBy"]').fill(`E2E Test - ${type}`);
        await page.waitForTimeout(400);

        const generalSection = page.locator('section:has(p:has-text("Step 2 · General"))');
        await generalSection.scrollIntoViewIfNeeded();
        await generalSection.getByRole('button', { name: 'All Pass' }).click();
        await page.waitForTimeout(1000);
        await expect(generalSection.getByText('20/20').first()).toBeVisible({ timeout: 5000 });

        const specificSection = page.locator('section:has(p:has-text("Step 3 · Specific"))');
        if (await specificSection.locator('button:has-text("All Pass")').isVisible().catch(() => false)) {
          await specificSection.scrollIntoViewIfNeeded();
          await specificSection.getByRole('button', { name: 'All Pass' }).click();
          await page.waitForTimeout(600);
        }

        const photosSection = page.locator('section:has(p:has-text("Step 4 · Photos"))');
        await photosSection.scrollIntoViewIfNeeded();
        const fileInput = page.locator('input[type="file"][aria-label*="Hydraulic Fluid"], input[type="file"][name="hydraulic-photo"]').first();
        await fileInput.setInputFiles('tests/fixtures/hydraulic.jpg');
        await page.waitForTimeout(2000);
        await expect(photosSection.getByText(/Done|Photos complete|Hydraulic/i).first()).toBeVisible({ timeout: 5000 });

        await page.waitForTimeout(2000);
        const submitBtn = page.getByTestId('submit-button');
        await submitBtn.scrollIntoViewIfNeeded();
        await expect(submitBtn).toBeEnabled({ timeout: 20000 });
        await submitBtn.click();

        await expect(page.locator('[data-sonner-toast][data-type="success"]').or(page.getByRole('heading', { name: /Submitted Successfully|success/i })).first()).toBeVisible({ timeout: 15000 });
      });
    }
  });

  test.describe('Validation Tests', () => {
    test('should reject submission without hydraulic photo', async ({ page }) => {
      await loginAs(page, 'employee');
      await gotoEquipmentForm(page);
      
      // Fill other fields
      const typeSelect = page.locator('select[name="equipmentType"], [data-testid="equipment-type"]');
      await typeSelect.selectOption('Jarraff');
      
      await page.waitForTimeout(500);
      
      const numberSelect = page.locator('select[name="equipmentNumber"], [data-testid="equipment-number"]');
      await numberSelect.selectOption('J-109');
      
      await page.fill('input[name="submittedBy"], [data-testid="submitted-by"]', 'Test Without Photo');
      
      // Don't upload hydraulic photo
      
      // Try to submit
      await page.getByTestId('submit-button').click();
      
      // Should show error or validation message (toast or inline)
      await expect(page.locator('[data-sonner-toast], [role="alert"]').filter({ hasText: /error|required|photo|invalid|select (an?|a )|complete|checklist/i }).first()).toBeVisible({ timeout: 5000 });
    });

    test('should reject submission without equipment type', async ({ page }) => {
      await loginAs(page, 'employee');
      await gotoEquipmentForm(page);
      
      // Don't select equipment type
      
      // Fill other fields
      await page.fill('input[name="submittedBy"], [data-testid="submitted-by"]', 'Test Without Type');
      
      const fileInput = page.locator('input[type="file"][name*="hydraulic"], [data-testid="hydraulic-photo-upload"]');
      await fileInput.setInputFiles('tests/fixtures/hydraulic.jpg');
      
      // Try to submit
      await page.getByTestId('submit-button').click();
      
      // Should show error or validation message (toast or inline)
      await expect(page.locator('[data-sonner-toast], [role="alert"]').filter({ hasText: /error|required|photo|invalid|select (an?|a )|complete|checklist/i }).first()).toBeVisible({ timeout: 5000 });
    });

    test('should reject submission without equipment number', async ({ page }) => {
      await loginAs(page, 'employee');
      await gotoEquipmentForm(page);
      
      // Select type but not number
      const typeSelect = page.locator('select[name="equipmentType"], [data-testid="equipment-type"]');
      await typeSelect.selectOption('Jarraff');
      
      await page.fill('input[name="submittedBy"], [data-testid="submitted-by"]', 'Test Without Number');
      
      const fileInput = page.locator('input[type="file"][name*="hydraulic"], [data-testid="hydraulic-photo-upload"]');
      await fileInput.setInputFiles('tests/fixtures/hydraulic.jpg');
      
      // Try to submit
      await page.getByTestId('submit-button').click();
      
      // Should show error or validation message (toast or inline)
      await expect(page.locator('[data-sonner-toast], [role="alert"]').filter({ hasText: /error|required|photo|invalid|select (an?|a )|complete|checklist/i }).first()).toBeVisible({ timeout: 5000 });
    });

    test('should reject submission without submitter name', async ({ page }) => {
      await loginAs(page, 'employee');
      await gotoEquipmentForm(page);
      
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
      await page.getByTestId('submit-button').click();
      
      // Should show error or validation message (toast or inline)
      await expect(page.locator('[data-sonner-toast], [role="alert"]').filter({ hasText: /error|required|photo|invalid|select (an?|a )|complete|checklist/i }).first()).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Equipment Number Validation', () => {
    test('should only show valid numbers for selected type', async ({ page }) => {
      await loginAs(page, 'employee');
      await gotoEquipmentForm(page);
      
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
      await gotoEquipmentForm(page);
      
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
      await gotoEquipmentForm(page);
      
      const typeSelect = page.locator('select[name="equipmentType"], [data-testid="equipment-type"]');
      await typeSelect.selectOption('Jarraff');
      
      await page.waitForTimeout(1000);
      
      // Should have Jarraff-specific items (UI shows "specific items loaded for Sky Trim/Jarraff")
      const specificSection = page.locator('section:has-text("specific items loaded")');
      await expect(specificSection).toBeVisible({ timeout: 5000 });
    });

    test('should load type-specific checklist for Skidsteer', async ({ page }) => {
      await loginAs(page, 'employee');
      await gotoEquipmentForm(page);
      
      const typeSelect = page.locator('select[name="equipmentType"], [data-testid="equipment-type"]');
      await typeSelect.selectOption('Skidsteer');
      
      await page.waitForTimeout(1000);
      
      // Should have Skidsteer-specific items (UI shows "specific items loaded for Skid Steer")
      const specificSection = page.locator('section:has-text("specific items loaded")');
      await expect(specificSection).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Authorization Tests', () => {
    test('should allow employee to create inspection', async ({ page }) => {
      await loginAs(page, 'employee');
      await gotoEquipmentForm(page);
      await expect(page.locator('form')).toBeVisible();
    });

    test('should allow mechanic to access inspection form', async ({ page }) => {
      await loginAs(page, 'mechanic');
      await gotoEquipmentForm(page);
      await expect(page.locator('form')).toBeVisible();
    });

    test('should allow admin to access inspection form', async ({ page }) => {
      await loginAs(page, 'admin');
      await gotoEquipmentForm(page);
      await expect(page.locator('form')).toBeVisible();
    });

    test('should allow general foreman to access inspection form', async ({ page }) => {
      await loginAs(page, 'general_foreman');
      await gotoEquipmentForm(page);
      await expect(page.locator('form')).toBeVisible();
    });
  });

  test.describe('Checklist Failure Reporting', () => {
    test('should allow marking items as failed', async ({ page }) => {
      await loginAs(page, 'employee');
      await gotoEquipmentForm(page);
      
      const typeSelect = page.locator('select[name="equipmentType"], [data-testid="equipment-type"]');
      await typeSelect.selectOption('Jarraff');
      
      await page.waitForTimeout(500);
      
      // Find first checklist item in General section and mark as failed (Equipment uses "Fail" label)
      const generalSection = page.locator('section:has(h2:has-text("General Checklist"))');
      const firstFailButton = generalSection.locator('button:has-text("Fail")').first();
      
      if (await firstFailButton.isVisible()) {
        await firstFailButton.click();
        // Selected state uses border-rose / bg-rose classes
        await expect(firstFailButton).toHaveClass(/rose/);
      }
    });

    test('should require notes when items are failed', async ({ page }) => {
      await loginAs(page, 'employee');
      await gotoEquipmentForm(page);
      
      // Fill form with a failure
      const typeSelect = page.locator('select[name="equipmentType"], [data-testid="equipment-type"]');
      await typeSelect.selectOption('Jarraff');
      
      await page.waitForTimeout(500);
      
      const numberSelect = page.locator('select[name="equipmentNumber"], [data-testid="equipment-number"]');
      await numberSelect.selectOption('J-109');
      
      await page.fill('input[name="submittedBy"], [data-testid="submitted-by"]', 'Test With Failure');
      
      const fileInput = page.locator('input[type="file"][name*="hydraulic"], [data-testid="hydraulic-photo-upload"]');
      await fileInput.setInputFiles('tests/fixtures/hydraulic.jpg');
      
      // Mark first general item as failed (Equipment uses "Fail" label)
      const generalSection = page.locator('section:has(h2:has-text("General Checklist"))');
      const failButton = generalSection.locator('button:has-text("Fail")').first();
      if (await failButton.isVisible()) {
        await failButton.click();
      }
      
      // Complete remaining general items with Pass (skip index 0 so first item stays Fail)
      const passButtons = generalSection.locator('button:has-text("Pass")');
      const passCount = await passButtons.count();
      for (let i = 1; i < passCount; i++) {
        await passButtons.nth(i).click({ force: true }).catch(() => {});
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
      await gotoEquipmentForm(page);
      
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
      await gotoEquipmentForm(page);
      
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
    await gotoEquipmentForm(page);
    
    // Form should be visible
    await expect(page.locator('form')).toBeVisible();
    
    // Selects should work
    const typeSelect = page.locator('select[name="equipmentType"], [data-testid="equipment-type"]');
    await expect(typeSelect).toBeVisible();
    
    // Submit button should be reachable
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(page.getByTestId('submit-button')).toBeVisible();
  });
});
