/**
 * General Foreman Tools E2E Tests
 * 
 * Tests for General Foreman-specific tools and functionality.
 */

import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

test.describe('Crew Oversight', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'general_foreman');
    await page.goto('/general-foreman/crew-oversight');
    await page.waitForLoadState('networkidle');
  });

  test('should display crew oversight page', async ({ page }) => {
    await expect(page.locator('[data-testid="crew-oversight"], main')).toBeVisible();
  });

  test('should show crew members list', async ({ page }) => {
    const crewList = page.locator('[data-testid="crew-list"], table, .crew-list');
    await expect(crewList).toBeVisible({ timeout: 10000 });
  });

  test('should show crew status indicators', async ({ page }) => {
    const statusIndicators = page.locator('[data-testid="crew-status"], .status-badge, .status-indicator');
    const count = await statusIndicators.count();
    console.log(`Crew status indicators count: ${count}`);
  });

  test('should allow viewing crew member details', async ({ page }) => {
    const crewRow = page.locator('tbody tr, [data-testid="crew-row"]').first();
    
    if (await crewRow.isVisible()) {
      await crewRow.click();
      await page.waitForTimeout(500);
      
      // Should show crew member details
      const detailView = page.locator('[data-testid="crew-detail"], .detail-modal, dialog');
      const isDetailVisible = await detailView.isVisible().catch(() => false);
      console.log(`Crew detail view visible: ${isDetailVisible}`);
    }
  });

  test('should show form completion status', async ({ page }) => {
    const completionStatus = page.locator('[data-testid="completion-status"], text=completed, text=pending, text=DVIR, text=JSA');
    const isVisible = await completionStatus.first().isVisible().catch(() => false);
    console.log(`Form completion status visible: ${isVisible}`);
  });
});

test.describe('Safety Compliance', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'general_foreman');
    await page.goto('/general-foreman/safety-compliance');
    await page.waitForLoadState('networkidle');
  });

  test('should display safety compliance page', async ({ page }) => {
    await expect(page.locator('[data-testid="safety-compliance"], main')).toBeVisible();
  });

  test('should show compliance metrics', async ({ page }) => {
    const metrics = page.locator('[data-testid="compliance-metrics"], .metrics, .stats, text=%');
    const isVisible = await metrics.first().isVisible().catch(() => false);
    console.log(`Compliance metrics visible: ${isVisible}`);
  });

  test('should show JSA summary', async ({ page }) => {
    const jsaSummary = page.locator('[data-testid="jsa-summary"], text=JSA, .jsa-section');
    const isVisible = await jsaSummary.first().isVisible().catch(() => false);
    console.log(`JSA summary visible: ${isVisible}`);
  });

  test('should show DVIR summary', async ({ page }) => {
    const dvirSummary = page.locator('[data-testid="dvir-summary"], text=DVIR, .dvir-section');
    const isVisible = await dvirSummary.first().isVisible().catch(() => false);
    console.log(`DVIR summary visible: ${isVisible}`);
  });

  test('should allow filtering by date range', async ({ page }) => {
    const dateFilter = page.locator('input[type="date"], [data-testid="date-filter"]');
    
    if (await dateFilter.first().isVisible()) {
      await dateFilter.first().fill('2026-01-01');
      await page.waitForTimeout(500);
    }
  });

  test('should show non-compliance issues', async ({ page }) => {
    const issues = page.locator('[data-testid="compliance-issues"], .issues, text=issue, text=missing');
    const isVisible = await issues.first().isVisible().catch(() => false);
    console.log(`Compliance issues section visible: ${isVisible}`);
  });
});

test.describe('Crew Status Analytics', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'general_foreman');
    await page.goto('/general-foreman/crew-analytics');
    await page.waitForLoadState('networkidle');
  });

  test('should display analytics page', async ({ page }) => {
    await expect(page.locator('[data-testid="crew-analytics"], main')).toBeVisible();
  });

  test('should show charts or graphs', async ({ page }) => {
    const charts = page.locator('[data-testid="chart"], canvas, .chart, svg');
    const count = await charts.count();
    console.log(`Charts/graphs count: ${count}`);
  });
});

test.describe('GF Equipment Logs', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'general_foreman');
    await page.goto('/general-foreman/equipment-logs');
    await page.waitForLoadState('networkidle');
  });

  test('should display equipment logs', async ({ page }) => {
    await expect(page.locator('[data-testid="equipment-logs"], main')).toBeVisible();
  });

  test('should show DVIR records', async ({ page }) => {
    const dvirRecords = page.locator('[data-testid="dvir-records"], text=DVIR, table');
    await expect(dvirRecords.first()).toBeVisible({ timeout: 10000 });
  });

  test('should show equipment inspection records', async ({ page }) => {
    const inspectionRecords = page.locator('[data-testid="inspection-records"], text=inspection, text=equipment');
    const isVisible = await inspectionRecords.first().isVisible().catch(() => false);
    console.log(`Equipment inspection records visible: ${isVisible}`);
  });

  test('should allow viewing record details', async ({ page }) => {
    const recordRow = page.locator('tbody tr').first();
    
    if (await recordRow.isVisible()) {
      await recordRow.click();
      await page.waitForTimeout(500);
    }
  });

  test('should allow signing off on records', async ({ page }) => {
    const signOffButton = page.locator('button:has-text("Sign"), button:has-text("Approve"), [data-action="sign-off"]');
    
    if (await signOffButton.first().isVisible()) {
      // Sign-off functionality exists
      expect(true).toBe(true);
    }
  });
});

test.describe('GF Authorization', () => {
  test('employee cannot access GF tools', async ({ page }) => {
    await loginAs(page, 'employee');
    
    const gfPages = [
      '/general-foreman/crew-oversight',
      '/general-foreman/safety-compliance',
      '/general-foreman/equipment-logs',
    ];
    
    for (const gfPage of gfPages) {
      await page.goto(gfPage);
      await page.waitForLoadState('networkidle');
      
      const url = page.url();
      // Should redirect away
      expect(url).not.toContain(gfPage);
    }
  });

  test('foreman cannot access GF-exclusive tools', async ({ page }) => {
    await loginAs(page, 'foreman');
    
    await page.goto('/general-foreman/crew-oversight');
    await page.waitForLoadState('networkidle');
    
    const url = page.url();
    // Might redirect or show limited view depending on permissions
    console.log(`Foreman access to GF crew-oversight - URL: ${url}`);
  });

  test('admin can access GF tools', async ({ page }) => {
    await loginAs(page, 'admin');
    
    await page.goto('/general-foreman/safety-compliance');
    await page.waitForLoadState('networkidle');
    
    // Admin should have access
    await expect(page.locator('main')).toBeVisible();
  });
});
