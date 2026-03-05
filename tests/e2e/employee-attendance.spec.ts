/**
 * Employee Attendance Page E2E Tests
 *
 * Tests for the General Foreman attendance tracking page.
 */

import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

test.describe('Employee Attendance Page', () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'general_foreman');
    await page.goto('/general-foreman/attendance');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
  });

  test('should render page with title and date navigator', async ({ page }) => {
    await expect(
      page.locator('h1:has-text("Employee Attendance")')
    ).toBeVisible({ timeout: 10000 });

    const dateNav = page.locator('text=Today');
    const isToday = await dateNav.isVisible().catch(() => false);
    if (!isToday) {
      await expect(
        page.locator('button[aria-label="Previous day"]')
      ).toBeVisible();
    }
  });

  test('should display employee list with names', async ({ page }) => {
    await page.waitForTimeout(3000);

    const rows = page.locator('input[type="checkbox"]');
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('should show status buttons for each employee', async ({ page }) => {
    await page.waitForTimeout(3000);

    const presentButtons = page.locator('button[aria-label="Mark as Present"]');
    const count = await presentButtons.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('should toggle status when clicking a status button', async ({ page }) => {
    await page.waitForTimeout(3000);

    const firstPresent = page.locator('button[aria-label="Mark as Present"]').first();
    await firstPresent.click();
    await page.waitForTimeout(1000);

    await expect(firstPresent).toHaveAttribute('aria-pressed', 'true');
  });

  test('should expand weekly stats card', async ({ page }) => {
    await page.waitForTimeout(3000);

    const expandButton = page.locator('button[aria-label="Expand weekly stats"]').first();
    await expandButton.click();
    await page.waitForTimeout(500);

    await expect(
      page.locator('text=Weekly Attendance').first()
    ).toBeVisible();
  });

  test('should select all employees via checkbox', async ({ page }) => {
    await page.waitForTimeout(3000);

    const selectAllLabel = page.locator('text=Select all');
    if (await selectAllLabel.isVisible()) {
      const selectAllCheckbox = page.locator('input[type="checkbox"]').first();
      await selectAllCheckbox.click();
      await page.waitForTimeout(500);

      await expect(
        page.locator('text=selected')
      ).toBeVisible();
    }
  });

  test('should filter by search query', async ({ page }) => {
    await page.waitForTimeout(3000);

    const searchInput = page.locator('input[placeholder="Search by name..."]');
    await searchInput.fill('zzz_nonexistent_user');
    await page.waitForTimeout(500);

    await expect(
      page.locator('text=No employees match your filters')
    ).toBeVisible();
  });

  test('should navigate to previous day', async ({ page }) => {
    await page.waitForTimeout(2000);

    const prevButton = page.locator('button[aria-label="Previous day"]');
    await prevButton.click();
    await page.waitForTimeout(1000);

    const todayLabel = page.locator('text=Today');
    await expect(todayLabel).not.toBeVisible();
  });

  test('should show back to dashboard link', async ({ page }) => {
    const backLink = page.locator('text=Back to Dashboard');
    await expect(backLink).toBeVisible();
  });
});

test.describe('Employee Attendance - Access Control', () => {
  test.setTimeout(60000);

  test('should deny access to regular employee', async ({ page }) => {
    await loginAs(page, 'employee');
    await page.goto('/general-foreman/attendance');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const denied = page.locator('text=Access Denied');
    const attendance = page.locator('h1:has-text("Employee Attendance")');

    const isDenied = await denied.isVisible().catch(() => false);
    const isAttendance = await attendance.isVisible().catch(() => false);

    expect(isDenied || !isAttendance).toBeTruthy();
  });
});
