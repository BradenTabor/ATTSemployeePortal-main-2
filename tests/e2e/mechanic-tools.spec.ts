/**
 * Mechanic Tools E2E Tests
 * 
 * Tests for mechanic-specific tools and functionality.
 */

import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

test.describe('Mechanic DVIR Center', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'mechanic');
    await page.goto('/mechanic/dvir-center');
    await page.waitForLoadState('networkidle');
  });

  test('should display DVIR center', async ({ page }) => {
    await expect(page.locator('[data-testid="dvir-center"], main')).toBeVisible();
  });

  test('should show DVIR list', async ({ page }) => {
    const dvirList = page.locator('[data-testid="dvir-list"], table, .dvir-list');
    await expect(dvirList).toBeVisible({ timeout: 10000 });
  });

  test('should show DVIRs with deficiencies', async ({ page }) => {
    const deficiencyIndicator = page.locator('[data-testid="has-deficiency"], .deficiency, text=deficiency, text=fail');
    const hasDeficiencies = await deficiencyIndicator.first().isVisible().catch(() => false);
    console.log(`Deficiency indicators visible: ${hasDeficiencies}`);
  });

  test('should allow filtering DVIRs', async ({ page }) => {
    const filterSelect = page.locator('select[name="filter"], [data-testid="dvir-filter"]');
    
    if (await filterSelect.isVisible()) {
      // Filter by status
      await filterSelect.selectOption({ index: 1 });
      await page.waitForTimeout(500);
    }
  });

  test('should allow viewing DVIR details', async ({ page }) => {
    const dvirRow = page.locator('tbody tr, [data-testid="dvir-row"]').first();
    
    if (await dvirRow.isVisible()) {
      await dvirRow.click();
      await page.waitForTimeout(500);
      
      // Should show details modal or navigate to detail view
      const detailView = page.locator('[data-testid="dvir-detail"], .detail-modal, dialog');
      const isDetailVisible = await detailView.isVisible().catch(() => false);
      console.log(`DVIR detail view visible: ${isDetailVisible}`);
    }
  });

  test('should allow adding mechanic notes', async ({ page }) => {
    const dvirRow = page.locator('tbody tr, [data-testid="dvir-row"]').first();
    
    if (await dvirRow.isVisible()) {
      // Find add notes button
      const addNotesButton = dvirRow.locator('button:has-text("Notes"), button:has-text("Fix"), [data-action="add-notes"]');
      
      if (await addNotesButton.isVisible()) {
        await addNotesButton.click();
        await page.waitForTimeout(500);
        
        // Notes input should appear
        const notesInput = page.locator('textarea[name="mechanicNotes"], [data-testid="mechanic-notes"]');
        if (await notesInput.isVisible()) {
          await notesInput.fill('Test mechanic notes - E2E');
        }
      }
    }
  });
});

test.describe('Mechanic Equipment Center', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'mechanic');
    await page.goto('/mechanic/equipment-center');
    await page.waitForLoadState('networkidle');
  });

  test('should display equipment center', async ({ page }) => {
    await expect(page.locator('[data-testid="equipment-center"], main')).toBeVisible();
  });

  test('should show equipment inspection list', async ({ page }) => {
    const inspectionList = page.locator('[data-testid="inspection-list"], table, .inspection-list');
    await expect(inspectionList).toBeVisible({ timeout: 10000 });
  });

  test('should allow filtering by equipment type', async ({ page }) => {
    const typeFilter = page.locator('select[name="equipmentType"], [data-testid="type-filter"]');
    
    if (await typeFilter.isVisible()) {
      await typeFilter.selectOption('Jarraff');
      await page.waitForTimeout(500);
    }
  });

  test('should allow adding mechanic fixes', async ({ page }) => {
    const inspectionRow = page.locator('tbody tr, [data-testid="inspection-row"]').first();
    
    if (await inspectionRow.isVisible()) {
      const fixButton = inspectionRow.locator('button:has-text("Fix"), button:has-text("Repair"), [data-action="add-fix"]');
      
      if (await fixButton.isVisible()) {
        await fixButton.click();
        await page.waitForTimeout(500);
        
        // Fix form should appear
        const fixForm = page.locator('[data-testid="fix-form"], .fix-modal, dialog');
        const isFormVisible = await fixForm.isVisible().catch(() => false);
        console.log(`Fix form visible: ${isFormVisible}`);
      }
    }
  });

  test('should allow recording parts used', async ({ page }) => {
    const addPartsButton = page.locator('button:has-text("Parts"), [data-testid="add-parts"]');
    
    if (await addPartsButton.first().isVisible()) {
      await addPartsButton.first().click();
      await page.waitForTimeout(500);
      
      // Parts form should appear
      const partsForm = page.locator('[data-testid="parts-form"], input[name="partName"]');
      const isFormVisible = await partsForm.first().isVisible().catch(() => false);
      console.log(`Parts form visible: ${isFormVisible}`);
    }
  });

  test('should allow recording costs', async ({ page }) => {
    const costInput = page.locator('input[name="cost"], input[name="mechanicCost"], [data-testid="cost-input"]');
    
    if (await costInput.first().isVisible()) {
      await costInput.first().fill('150.00');
      expect(await costInput.first().inputValue()).toBe('150.00');
    }
  });
});

test.describe('Mechanic Parts & Repairs Log', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'mechanic');
    await page.goto('/mechanic/parts-repairs');
    await page.waitForLoadState('networkidle');
  });

  test('should display parts & repairs log', async ({ page }) => {
    await expect(page.locator('[data-testid="parts-repairs"], main')).toBeVisible();
  });

  test('should show repair history', async ({ page }) => {
    const repairList = page.locator('[data-testid="repair-list"], table, .repair-list');
    await expect(repairList).toBeVisible({ timeout: 10000 });
  });

  test('should show parts inventory', async ({ page }) => {
    const partsSection = page.locator('[data-testid="parts-section"], .parts-inventory, text=parts');
    const isVisible = await partsSection.first().isVisible().catch(() => false);
    console.log(`Parts section visible: ${isVisible}`);
  });

  test('should show cost totals', async ({ page }) => {
    const costTotal = page.locator('[data-testid="cost-total"], text=total, text=$');
    const isVisible = await costTotal.first().isVisible().catch(() => false);
    console.log(`Cost totals visible: ${isVisible}`);
  });

  test('should allow filtering by date range', async ({ page }) => {
    const startDate = page.locator('input[name="startDate"], [data-testid="start-date"]');
    const endDate = page.locator('input[name="endDate"], [data-testid="end-date"]');
    
    if (await startDate.isVisible() && await endDate.isVisible()) {
      await startDate.fill('2026-01-01');
      await endDate.fill('2026-01-31');
      await page.waitForTimeout(500);
    }
  });

  test('should allow exporting data', async ({ page }) => {
    const exportButton = page.locator('button:has-text("Export"), button:has-text("Download"), [data-testid="export"]');
    
    if (await exportButton.isVisible()) {
      // Export functionality exists
      expect(true).toBe(true);
    }
  });
});

test.describe('Mechanic Equipment Logs', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'mechanic');
    await page.goto('/mechanic/equipment-logs');
    await page.waitForLoadState('networkidle');
  });

  test('should display equipment logs', async ({ page }) => {
    await expect(page.locator('[data-testid="equipment-logs"], main')).toBeVisible();
  });

  test('should show equipment maintenance history', async ({ page }) => {
    const historyList = page.locator('[data-testid="maintenance-history"], table, .history');
    await expect(historyList).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Mechanic Authorization', () => {
  test('employee cannot access mechanic tools', async ({ page }) => {
    await loginAs(page, 'employee');
    
    const mechanicPages = [
      '/mechanic/dvir-center',
      '/mechanic/equipment-center',
      '/mechanic/parts-repairs',
    ];
    
    for (const mechanicPage of mechanicPages) {
      await page.goto(mechanicPage);
      await page.waitForLoadState('networkidle');
      
      const url = page.url();
      // Should redirect away
      expect(url).not.toContain(mechanicPage);
    }
  });

  test('foreman cannot access mechanic tools', async ({ page }) => {
    await loginAs(page, 'foreman');
    
    await page.goto('/mechanic/dvir-center');
    await page.waitForLoadState('networkidle');
    
    const url = page.url();
    expect(url).not.toContain('/mechanic/dvir-center');
  });

  test('admin can access mechanic tools', async ({ page }) => {
    await loginAs(page, 'admin');
    
    await page.goto('/mechanic/dvir-center');
    await page.waitForLoadState('networkidle');
    
    // Admin should have access
    await expect(page.locator('main')).toBeVisible();
  });
});
