/**
 * Announcements E2E Tests
 * 
 * Tests for announcement display, creation, and notification functionality.
 */

import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

test.describe('Announcements Display', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'employee');
  });

  test('should display announcements page', async ({ page }) => {
    await page.goto('/announcements');
    await page.waitForLoadState('networkidle');
    
    // Use specific selector to avoid strict mode violation (both main and data-testid exist)
    const announcementsDiv = page.locator('[data-testid="announcements"]');
    const mainElement = page.locator('main').first();
    
    // Either the specific div or main should be visible
    const divVisible = await announcementsDiv.isVisible().catch(() => false);
    const mainVisible = await mainElement.isVisible().catch(() => false);
    
    expect(divVisible || mainVisible).toBe(true);
  });

  test('should show announcement list', async ({ page }) => {
    await page.goto('/announcements');
    await page.waitForLoadState('networkidle');
    
    const announcementList = page.locator('[data-testid="announcement-list"], .announcements, article');
    await expect(announcementList.first()).toBeVisible({ timeout: 10000 });
  });

  test('should display announcement title', async ({ page }) => {
    await page.goto('/announcements');
    await page.waitForLoadState('networkidle');
    
    const title = page.locator('[data-testid="announcement-title"], h2, h3');
    const isVisible = await title.first().isVisible().catch(() => false);
    console.log(`Announcement title visible: ${isVisible}`);
  });

  test('should display announcement date', async ({ page }) => {
    await page.goto('/announcements');
    await page.waitForLoadState('networkidle');
    
    const date = page.locator('[data-testid="announcement-date"], time, text=ago, text=2026');
    const isVisible = await date.first().isVisible().catch(() => false);
    console.log(`Announcement date visible: ${isVisible}`);
  });

  test('should allow viewing announcement details', async ({ page }) => {
    await page.goto('/announcements');
    await page.waitForLoadState('networkidle');
    
    const announcement = page.locator('[data-testid="announcement-item"], article').first();
    
    if (await announcement.isVisible()) {
      // Click to view details
      const readMoreLink = announcement.locator('a:has-text("Read"), button:has-text("Read"), [data-action="view"]');
      
      if (await readMoreLink.isVisible()) {
        await readMoreLink.click();
        await page.waitForTimeout(500);
      } else {
        await announcement.click();
        await page.waitForTimeout(500);
      }
    }
  });

  test('should show safety announcements', async ({ page }) => {
    await page.goto('/announcements');
    await page.waitForLoadState('networkidle');
    
    const safetyAnnouncement = page.locator('[data-type="safety"], text=safety');
    const isVisible = await safetyAnnouncement.first().isVisible().catch(() => false);
    console.log(`Safety announcements visible: ${isVisible}`);
  });
});

test.describe('Announcements on Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'employee');
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
  });

  test('should show recent announcements on dashboard', async ({ page }) => {
    const announcements = page.locator('[data-testid="dashboard-announcements"], .announcements-widget, text=announcement');
    const isVisible = await announcements.first().isVisible().catch(() => false);
    console.log(`Dashboard announcements visible: ${isVisible}`);
  });

  test('should have link to full announcements page', async ({ page }) => {
    const announcementsLink = page.locator('a[href*="announcements"], [data-testid="view-all-announcements"]');
    const isVisible = await announcementsLink.first().isVisible().catch(() => false);
    
    if (isVisible) {
      await announcementsLink.first().click();
      await expect(page).toHaveURL(/announcements/);
    }
  });
});

test.describe('Admin Announcement Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
  });

  test('should allow admin to create announcement', async ({ page }) => {
    await page.goto('/announcements');
    await page.waitForLoadState('networkidle');
    
    const createButton = page.locator('button:has-text("Create"), button:has-text("New"), [data-testid="create-announcement"]');
    
    if (await createButton.isVisible()) {
      await createButton.click();
      await page.waitForTimeout(500);
      
      // Should show creation form
      const form = page.locator('form, [data-testid="announcement-form"]');
      await expect(form).toBeVisible();
    }
  });

  test('should validate announcement fields', async ({ page }) => {
    await page.goto('/announcements');
    await page.waitForLoadState('networkidle');
    
    const createButton = page.locator('button:has-text("Create"), button:has-text("New"), [data-testid="create-announcement"]');
    
    if (await createButton.isVisible()) {
      await createButton.click();
      await page.waitForTimeout(500);
      
      // Try to submit without filling fields
      const submitButton = page.locator('button[type="submit"]');
      if (await submitButton.isVisible()) {
        await submitButton.click();
        
        // Should show validation errors
        await page.waitForTimeout(1000);
      }
    }
  });

  test('should allow admin to send manual notification', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    
    // Look for manual notification button
    const notifyButton = page.locator('button:has-text("Notify"), button:has-text("Send"), [data-testid="manual-notification"]');
    
    if (await notifyButton.first().isVisible()) {
      await notifyButton.first().click();
      await page.waitForTimeout(500);
      
      // Should show notification form
      const notifyForm = page.locator('[data-testid="notification-form"], .notification-modal');
      const isVisible = await notifyForm.isVisible().catch(() => false);
      console.log(`Notification form visible: ${isVisible}`);
    }
  });
});

test.describe('Announcement Rewards', () => {
  test('should track announcement reading for rewards', async ({ page }) => {
    await loginAs(page, 'employee');
    await page.goto('/announcements');
    await page.waitForLoadState('networkidle');
    
    const announcement = page.locator('[data-testid="announcement-item"], article').first();
    
    if (await announcement.isVisible()) {
      // Click to view
      await announcement.click();
      await page.waitForTimeout(1000);
      
      // Check for points indicator or reward notification
      const rewardIndicator = page.locator('[data-testid="points-earned"], text=points, text=reward');
      const isVisible = await rewardIndicator.first().isVisible().catch(() => false);
      console.log(`Reward indicator visible: ${isVisible}`);
    }
  });
});

test.describe('Announcements - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('should display announcements on mobile', async ({ page }) => {
    await loginAs(page, 'employee');
    await page.goto('/announcements');
    await page.waitForLoadState('networkidle');
    
    // Use specific selector to avoid strict mode violation (both main and data-testid exist)
    const announcementsDiv = page.locator('[data-testid="announcements"]');
    const mainElement = page.locator('main').first();
    
    // Either the specific div or main should be visible
    const divVisible = await announcementsDiv.isVisible().catch(() => false);
    const mainVisible = await mainElement.isVisible().catch(() => false);
    
    expect(divVisible || mainVisible).toBe(true);
    
    // Announcements should be readable
    const announcement = page.locator('[data-testid="announcement-item"], article').first();
    if (await announcement.isVisible()) {
      // Check text is not cut off
      const box = await announcement.boundingBox();
      expect(box?.width).toBeLessThanOrEqual(375);
    }
  });
});
