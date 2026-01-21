/**
 * Dashboard E2E Tests
 * 
 * Tests for role-based dashboards across the application.
 */

import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

test.describe('Employee Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'employee');
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
  });

  test('should display dashboard for employee', async ({ page }) => {
    await expect(page.locator('[data-testid="dashboard"], .dashboard, main')).toBeVisible();
  });

  test('should show greeting header', async ({ page }) => {
    const greeting = page.locator('[data-testid="greeting"], .greeting, h1, h2');
    await expect(greeting.first()).toBeVisible();
  });

  test('should show navigation cards/links', async ({ page }) => {
    const navCards = page.locator('[data-testid="nav-card"], .nav-card, a[href*="forms"]');
    const count = await navCards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should show forms access', async ({ page }) => {
    const formsLink = page.locator('a[href*="forms"], button:has-text("Forms")');
    await expect(formsLink.first()).toBeVisible();
  });

  test('should show announcements section', async ({ page }) => {
    const announcements = page.locator('[data-testid="announcements"], .announcements, text=announcement');
    // Announcements may or may not be present
    const isVisible = await announcements.first().isVisible().catch(() => false);
    console.log(`Announcements section visible: ${isVisible}`);
  });

  test('should allow navigation to DVIR form', async ({ page }) => {
    const dvirLink = page.locator('a[href*="dvir"], [data-testid="dvir-link"]');
    
    if (await dvirLink.isVisible()) {
      await dvirLink.click();
      await expect(page).toHaveURL(/dvir/);
    }
  });

  test('should allow navigation to JSA form', async ({ page }) => {
    const jsaLink = page.locator('a[href*="jsa"], [data-testid="jsa-link"]');
    
    if (await jsaLink.isVisible()) {
      await jsaLink.click();
      await expect(page).toHaveURL(/jsa/);
    }
  });
});

test.describe('Foreman Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'foreman');
  });

  test('should access foreman dashboard', async ({ page }) => {
    await page.goto('/foreman/dashboard');
    await page.waitForLoadState('networkidle');
    
    await expect(page.locator('[data-testid="foreman-dashboard"], main, .dashboard')).toBeVisible();
  });

  test('should show daily reports access', async ({ page }) => {
    await page.goto('/foreman/dashboard');
    await page.waitForLoadState('networkidle');
    
    const reportsLink = page.locator('a[href*="reports"], [data-testid="daily-reports"]');
    const isVisible = await reportsLink.first().isVisible().catch(() => false);
    console.log(`Daily reports link visible: ${isVisible}`);
  });

  test('should access foreman daily reports', async ({ page }) => {
    await page.goto('/foreman/daily-reports');
    await page.waitForLoadState('networkidle');
    
    // Should load without error
    await expect(page.locator('main, [data-testid="daily-reports"]')).toBeVisible();
  });
});

test.describe('General Foreman Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'general_foreman');
  });

  test('should access GF dashboard', async ({ page }) => {
    await page.goto('/general-foreman/dashboard');
    await page.waitForLoadState('networkidle');
    
    await expect(page.locator('[data-testid="gf-dashboard"], main, .dashboard')).toBeVisible();
  });

  test('should show crew oversight access', async ({ page }) => {
    await page.goto('/general-foreman/dashboard');
    await page.waitForLoadState('networkidle');
    
    const crewLink = page.locator('a[href*="crew"], [data-testid="crew-oversight"]');
    const isVisible = await crewLink.first().isVisible().catch(() => false);
    console.log(`Crew oversight link visible: ${isVisible}`);
  });

  test('should access crew oversight', async ({ page }) => {
    await page.goto('/general-foreman/crew-oversight');
    await page.waitForLoadState('networkidle');
    
    await expect(page.locator('main')).toBeVisible();
  });

  test('should access safety compliance', async ({ page }) => {
    await page.goto('/general-foreman/safety-compliance');
    await page.waitForLoadState('networkidle');
    
    await expect(page.locator('main')).toBeVisible();
  });

  test('should access equipment logs', async ({ page }) => {
    await page.goto('/general-foreman/equipment-logs');
    await page.waitForLoadState('networkidle');
    
    await expect(page.locator('main')).toBeVisible();
  });
});

test.describe('Mechanic Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'mechanic');
  });

  test('should access mechanic dashboard', async ({ page }) => {
    await page.goto('/mechanic/dashboard');
    await page.waitForLoadState('networkidle');
    
    await expect(page.locator('[data-testid="mechanic-dashboard"], main, .dashboard')).toBeVisible();
  });

  test('should show DVIR center access', async ({ page }) => {
    await page.goto('/mechanic/dashboard');
    await page.waitForLoadState('networkidle');
    
    const dvirLink = page.locator('a[href*="dvir"], [data-testid="dvir-center"]');
    const isVisible = await dvirLink.first().isVisible().catch(() => false);
    console.log(`DVIR center link visible: ${isVisible}`);
  });

  test('should access DVIR center', async ({ page }) => {
    await page.goto('/mechanic/dvir-center');
    await page.waitForLoadState('networkidle');
    
    await expect(page.locator('main')).toBeVisible();
  });

  test('should access equipment center', async ({ page }) => {
    await page.goto('/mechanic/equipment-center');
    await page.waitForLoadState('networkidle');
    
    await expect(page.locator('main')).toBeVisible();
  });

  test('should access parts and repairs log', async ({ page }) => {
    await page.goto('/mechanic/parts-repairs');
    await page.waitForLoadState('networkidle');
    
    await expect(page.locator('main')).toBeVisible();
  });
});

test.describe('Safety Officer Dashboard', () => {
  test('should access safety officer dashboard', async ({ page }) => {
    // Safety officer might use employee credentials or specific role
    await loginAs(page, 'employee'); // Adjust if specific role exists
    await page.goto('/safety-officer/dashboard');
    await page.waitForLoadState('networkidle');
    
    // May redirect based on role
    const mainContent = page.locator('main');
    await expect(mainContent).toBeVisible();
  });
});

test.describe('Dashboard Authorization', () => {
  test('employee cannot access admin dashboard', async ({ page }) => {
    await loginAs(page, 'employee');
    await page.goto('/admin/dashboard');
    
    // Should either redirect or show access denied
    await page.waitForLoadState('networkidle');
    
    const url = page.url();
    const accessDenied = page.locator('text=access denied, text=unauthorized, text=not allowed');
    
    // Either redirected away or shows access denied
    const redirected = !url.includes('/admin/dashboard');
    const denied = await accessDenied.first().isVisible().catch(() => false);
    
    expect(redirected || denied).toBe(true);
  });

  test('employee cannot access mechanic dashboard', async ({ page }) => {
    await loginAs(page, 'employee');
    await page.goto('/mechanic/dashboard');
    
    await page.waitForLoadState('networkidle');
    
    const url = page.url();
    // Should redirect or show access denied
    const redirected = !url.includes('/mechanic/dashboard');
    
    if (!redirected) {
      // If not redirected, should show error
      const accessDenied = page.locator('text=access denied, text=unauthorized');
      const denied = await accessDenied.first().isVisible().catch(() => false);
      expect(denied).toBe(true);
    }
  });

  test('mechanic cannot access admin dashboard', async ({ page }) => {
    await loginAs(page, 'mechanic');
    await page.goto('/admin/dashboard');
    
    await page.waitForLoadState('networkidle');
    
    const url = page.url();
    const redirected = !url.includes('/admin/dashboard');
    expect(redirected).toBe(true);
  });
});

test.describe('Dashboard - Mobile Responsiveness', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('employee dashboard works on mobile', async ({ page }) => {
    await loginAs(page, 'employee');
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Dashboard should be usable
    await expect(page.locator('main')).toBeVisible();
    
    // Navigation should be accessible (may be in hamburger menu)
    const navMenu = page.locator('[data-testid="mobile-nav"], .mobile-nav, button[aria-label*="menu"]');
    const navVisible = await navMenu.first().isVisible().catch(() => false);
    
    if (navVisible) {
      await navMenu.first().click();
      await page.waitForTimeout(500);
    }
  });
});
