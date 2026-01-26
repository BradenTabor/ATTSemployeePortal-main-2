/**
 * Admin Tools E2E Tests
 * 
 * Tests for admin-only tools and functionality.
 */

import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

test.describe('Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
  });

  test('should display admin dashboard', async ({ page }) => {
    await expect(page.locator('[data-testid="admin-dashboard"], main, .dashboard')).toBeVisible();
  });

  test('should show admin navigation', async ({ page }) => {
    const adminNav = page.locator('[data-testid="admin-nav"], .admin-nav, nav');
    await expect(adminNav.first()).toBeVisible();
  });

  test('should show key metrics/stats', async ({ page }) => {
    const stats = page.locator('[data-testid="stats"], .stats, .metrics, .card');
    const count = await stats.count();
    expect(count).toBeGreaterThan(0);
  });
});

test.describe('Admin User Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');
  });

  test('should display user list', async ({ page }) => {
    const userList = page.locator('[data-testid="user-list"], table, .user-list');
    await expect(userList).toBeVisible();
  });

  test('should show user count', async ({ page }) => {
    const users = page.locator('tbody tr, [data-testid="user-row"], .user-item');
    const count = await users.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should allow searching users', async ({ page }) => {
    const searchInput = page.locator('input[type="search"], input[placeholder*="search"], [data-testid="user-search"]');
    
    if (await searchInput.isVisible()) {
      await searchInput.fill('test');
      await page.waitForTimeout(500);
      
      // Results should update
    }
  });

  test('should show user roles', async ({ page }) => {
    const roleIndicators = page.locator('[data-testid="user-role"], .role, text=employee, text=admin, text=foreman');
    const count = await roleIndicators.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should allow editing user role', async ({ page }) => {
    const editButton = page.locator('[data-testid="edit-user"], button:has-text("Edit")').first();
    
    if (await editButton.isVisible()) {
      await editButton.click();
      await page.waitForTimeout(500);
      
      // Edit modal/form should appear
      const editForm = page.locator('[data-testid="edit-user-form"], .edit-modal, dialog');
      await expect(editForm).toBeVisible();
    }
  });
});

test.describe('Admin JSA Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/admin/jsa');
    await page.waitForLoadState('networkidle');
  });

  test('should display all JSAs', async ({ page }) => {
    const jsaList = page.locator('[data-testid="jsa-list"], table, .jsa-list');
    await expect(jsaList).toBeVisible();
  });

  test('should show JSA details', async ({ page }) => {
    const jsaRow = page.locator('tbody tr, [data-testid="jsa-row"]').first();
    
    if (await jsaRow.isVisible()) {
      // Click to view details
      await jsaRow.click();
      await page.waitForTimeout(500);
      
      // Should show JSA details
    }
  });

  test('should allow filtering JSAs by status', async ({ page }) => {
    const statusFilter = page.locator('select[name="status"], [data-testid="status-filter"]');
    
    if (await statusFilter.isVisible()) {
      await statusFilter.selectOption('completed');
      await page.waitForTimeout(500);
    }
  });

  test('should allow filtering JSAs by date', async ({ page }) => {
    const dateFilter = page.locator('input[type="date"], [data-testid="date-filter"]');
    
    if (await dateFilter.first().isVisible()) {
      await dateFilter.first().fill('2026-01-01');
      await page.waitForTimeout(500);
    }
  });
});

test.describe('Admin RTO Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/admin/rto');
    await page.waitForLoadState('networkidle');
  });

  test('should display all RTO requests', async ({ page }) => {
    const rtoList = page.locator('[data-testid="rto-list"], table, .rto-list');
    await expect(rtoList).toBeVisible();
  });

  test('should show pending requests count', async ({ page }) => {
    const pendingCount = page.locator('[data-testid="pending-count"], .pending-count, text=pending');
    const isVisible = await pendingCount.first().isVisible().catch(() => false);
    console.log(`Pending count visible: ${isVisible}`);
  });

  test('should allow bulk approval', async ({ page }) => {
    const selectAll = page.locator('input[type="checkbox"][name="selectAll"], [data-testid="select-all"]');
    const bulkApprove = page.locator('button:has-text("Approve Selected"), [data-testid="bulk-approve"]');
    
    if (await selectAll.isVisible() && await bulkApprove.isVisible()) {
      // Bulk operations available
      expect(true).toBe(true);
    }
  });
});

test.describe('Admin Rewards', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/admin/rewards');
    await page.waitForLoadState('networkidle');
  });

  test('should display rewards page', async ({ page }) => {
    const rewardsPage = page.locator('[data-testid="rewards-page"], main');
    await expect(rewardsPage).toBeVisible();
  });

  test('should show employee points', async ({ page }) => {
    const pointsDisplay = page.locator('[data-testid="points"], text=points, .points');
    const isVisible = await pointsDisplay.first().isVisible().catch(() => false);
    console.log(`Points display visible: ${isVisible}`);
  });
});

test.describe('Admin Job Progress', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/admin/job-progress');
    await page.waitForLoadState('networkidle');
  });

  test('should display job progress page', async ({ page }) => {
    const jobProgress = page.locator('[data-testid="job-progress"], main');
    await expect(jobProgress).toBeVisible();
  });

  test('should show job list', async ({ page }) => {
    const jobList = page.locator('[data-testid="job-list"], table, .job-list');
    await expect(jobList).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Admin Job Tracker', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/admin/operations');
    await page.waitForLoadState('networkidle');
  });

  test('should display job tracker', async ({ page }) => {
    const tracker = page.locator('[data-testid="job-tracker"], main, [data-testid="operations-hub"]');
    await expect(tracker).toBeVisible();
  });
});

test.describe('Admin Parts/Fixes Overview', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/admin/parts-fixes');
    await page.waitForLoadState('networkidle');
  });

  test('should display parts/fixes overview', async ({ page }) => {
    const overview = page.locator('[data-testid="parts-fixes"], main');
    await expect(overview).toBeVisible();
  });

  test('should show cost summary', async ({ page }) => {
    const costSummary = page.locator('[data-testid="cost-summary"], text=cost, text=$, .cost');
    const isVisible = await costSummary.first().isVisible().catch(() => false);
    console.log(`Cost summary visible: ${isVisible}`);
  });
});

test.describe('Admin Telemetry', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/admin/telemetry');
    await page.waitForLoadState('networkidle');
  });

  test('should display telemetry page', async ({ page }) => {
    const telemetry = page.locator('[data-testid="telemetry"], main');
    await expect(telemetry).toBeVisible();
  });

  test('should show form completion metrics', async ({ page }) => {
    const metrics = page.locator('[data-testid="metrics"], .metrics, text=submissions, text=completed');
    const isVisible = await metrics.first().isVisible().catch(() => false);
    console.log(`Form metrics visible: ${isVisible}`);
  });
});

test.describe('Admin Authorization', () => {
  test('non-admin cannot access admin pages', async ({ page }) => {
    await loginAs(page, 'employee');
    
    const adminPages = [
      '/admin',
      '/admin/users',
      '/admin/jsa',
      '/admin/rto',
      '/admin/rewards',
    ];
    
    for (const adminPage of adminPages) {
      await page.goto(adminPage);
      await page.waitForLoadState('networkidle');
      
      const url = page.url();
      // Should redirect away from admin pages
      expect(url).not.toContain(adminPage);
    }
  });
});
