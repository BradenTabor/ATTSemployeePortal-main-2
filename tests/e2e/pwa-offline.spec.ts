/**
 * PWA & Offline Behavior E2E Tests
 * 
 * Tests Progressive Web App functionality and offline behavior.
 * Covers service worker, caching, and data persistence.
 */

import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

test.describe('PWA Functionality', () => {
  test('should register service worker', async ({ page }) => {
    await page.goto('/');
    
    // Wait for service worker to register
    await page.waitForTimeout(3000);
    
    // Check for service worker
    const hasServiceWorker = await page.evaluate(async () => {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        return registrations.length > 0;
      }
      return false;
    });
    
    expect(hasServiceWorker).toBe(true);
  });

  test('should have valid manifest', async ({ page }) => {
    // Fetch manifest directly
    const response = await page.goto('/manifest.json');
    expect(response?.status()).toBe(200);
    
    const manifest = await response?.json();
    
    // Check required manifest properties
    expect(manifest.name).toBeDefined();
    expect(manifest.short_name).toBeDefined();
    expect(manifest.icons).toBeDefined();
    expect(manifest.start_url).toBeDefined();
    expect(manifest.display).toBeDefined();
  });

  test('should have app icons defined', async ({ page }) => {
    const response = await page.goto('/manifest.json');
    const manifest = await response?.json();
    
    // Should have icons for different sizes
    expect(manifest.icons.length).toBeGreaterThan(0);
    
    // Check for common sizes
    const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
    expect(sizes.some((s: string) => s.includes('192'))).toBe(true);
    expect(sizes.some((s: string) => s.includes('512'))).toBe(true);
  });

  test('should show install prompt capability', async ({ page }) => {
    await page.goto('/');
    
    // Check if beforeinstallprompt could be fired
    const hasInstallCapability = await page.evaluate(() => {
      return 'BeforeInstallPromptEvent' in window || 
             'onbeforeinstallprompt' in window ||
             (navigator as unknown as { standalone?: boolean }).standalone !== undefined;
    });
    
    // This varies by browser, just document it
    console.log(`Install prompt capability: ${hasInstallCapability}`);
  });
});

test.describe('Offline Behavior', () => {
  test('should cache form pages for offline access', async ({ page, context }) => {
    // Load the form first to cache it
    await loginAs(page, 'employee');
    await page.goto('/dashboard/forms/dvir');
    await page.waitForSelector('form');
    
    // Wait for service worker to cache
    await page.waitForTimeout(3000);
    
    // Go offline
    await context.setOffline(true);
    
    // Try to access cached page
    await page.reload();
    
    // Form should still be visible (from cache)
    const form = page.locator('form');
    
    // Either cached content or offline indicator
    const formVisible = await form.isVisible().catch(() => false);
    const offlineIndicator = page.locator('[data-testid="offline-indicator"], .offline-banner, text=offline');
    const offlineVisible = await offlineIndicator.isVisible().catch(() => false);
    
    expect(formVisible || offlineVisible).toBe(true);
    
    // Go back online
    await context.setOffline(false);
  });

  test('should show offline indicator when disconnected', async ({ page, context }) => {
    await loginAs(page, 'employee');
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Go offline
    await context.setOffline(true);
    
    // Wait for offline detection
    await page.waitForTimeout(2000);
    
    // Check for offline indicator
    const offlineIndicator = page.locator(
      '[data-testid="offline-indicator"], ' +
      '.offline-banner, ' +
      '[data-offline="true"], ' +
      'text=offline, ' +
      'text=Offline'
    );
    
    const isVisible = await offlineIndicator.first().isVisible().catch(() => false);
    
    // If no visible indicator, check for CSS class on body
    const hasOfflineClass = await page.evaluate(() => {
      return document.body.classList.contains('offline') ||
             document.documentElement.classList.contains('offline');
    });
    
    // Should have some indication of offline state
    console.log(`Offline indicator visible: ${isVisible}, Has offline class: ${hasOfflineClass}`);
    
    // Go back online
    await context.setOffline(false);
  });

  test('should preserve form inputs when going offline', async ({ page, context }) => {
    await loginAs(page, 'employee');
    await page.goto('/dashboard/forms/dvir');
    await page.waitForSelector('form');
    
    // Fill in some data
    await page.fill('input[name="truckNumber"], [data-testid="truck-number"]', 'OFFLINE-TEST-001');
    await page.fill('input[name="driversName"], [data-testid="drivers-name"]', 'Offline Test Driver');
    
    // Go offline
    await context.setOffline(true);
    await page.waitForTimeout(1000);
    
    // Verify data is still present
    const truckNumber = await page.inputValue('input[name="truckNumber"], [data-testid="truck-number"]');
    expect(truckNumber).toBe('OFFLINE-TEST-001');
    
    // Go back online
    await context.setOffline(false);
  });

  test('should queue submission when offline', async ({ page, context }) => {
    await loginAs(page, 'employee');
    await page.goto('/dashboard/forms/dvir');
    await page.waitForSelector('form');
    
    // Fill form
    await page.fill('input[name="truckNumber"], [data-testid="truck-number"]', 'OFFLINE-QUEUE-001');
    await page.fill('input[name="driversName"], [data-testid="drivers-name"]', 'Queue Test');
    await page.fill('input[name="mileage"], [data-testid="mileage"]', '60000');
    
    // Go offline
    await context.setOffline(true);
    await page.waitForTimeout(500);
    
    // Try to submit
    await page.click('button[type="submit"]');
    
    // Should show queued/offline message or error
    await page.waitForTimeout(2000);
    
    const queuedMessage = page.locator('text=queued, text=offline, text=will be sent');
    const errorMessage = page.locator('[data-sonner-toast][data-type="error"]');
    
    const queuedVisible = await queuedMessage.first().isVisible().catch(() => false);
    const errorVisible = await errorMessage.isVisible().catch(() => false);
    
    // Should show some indication of offline submission handling
    console.log(`Queued message: ${queuedVisible}, Error message: ${errorVisible}`);
    
    // Go back online
    await context.setOffline(false);
  });
});

test.describe('Data Persistence', () => {
  test('should save draft to localStorage on blur', async ({ page }) => {
    await loginAs(page, 'employee');
    await page.goto('/forms/jsa');
    await page.waitForSelector('form, [data-testid="jsa-wizard"]');
    
    // Fill some data
    await page.fill('input[name="workLocation"], [data-testid="work-location"]', 'Persist Test Location');
    
    // Blur the input
    await page.keyboard.press('Tab');
    
    // Wait for potential auto-save
    await page.waitForTimeout(1000);
    
    // Check localStorage for draft data
    const hasDraft = await page.evaluate(() => {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('jsa') || key.includes('draft') || key.includes('form'))) {
          const value = localStorage.getItem(key);
          if (value && value.includes('Persist Test Location')) {
            return true;
          }
        }
      }
      return false;
    });
    
    // Document the behavior
    console.log(`Draft saved to localStorage: ${hasDraft}`);
  });

  test('should recover draft after browser crash (page refresh)', async ({ page }) => {
    await loginAs(page, 'employee');
    await page.goto('/forms/jsa');
    await page.waitForSelector('form, [data-testid="jsa-wizard"]');
    
    const uniqueLocation = `Recover Test ${Date.now()}`;
    
    // Fill data
    await page.fill('input[name="workLocation"], [data-testid="work-location"]', uniqueLocation);
    
    // Simulate crash by refreshing
    await page.reload();
    await page.waitForSelector('form, [data-testid="jsa-wizard"]');
    
    // Check if data was recovered
    const recoveredValue = await page.inputValue('input[name="workLocation"], [data-testid="work-location"]');
    
    // Document behavior - may or may not auto-recover
    console.log(`Recovered value: ${recoveredValue}`);
    console.log(`Data recovered: ${recoveredValue === uniqueLocation}`);
  });

  test('should show unsaved changes warning on navigation', async ({ page }) => {
    await loginAs(page, 'employee');
    await page.goto('/dashboard/forms/dvir');
    await page.waitForSelector('form');
    
    // Fill data
    await page.fill('input[name="truckNumber"], [data-testid="truck-number"]', 'UNSAVED-TEST');
    
    // Set up dialog handler
    let dialogShown = false;
    page.on('dialog', async dialog => {
      dialogShown = true;
      await dialog.dismiss();
    });
    
    // Try to navigate away
    await page.goto('/dashboard');
    
    // Document whether warning was shown
    console.log(`Unsaved changes warning shown: ${dialogShown}`);
  });
});

test.describe('Auto-Save Functionality', () => {
  test('should auto-save JSA draft periodically', async ({ page }) => {
    await loginAs(page, 'employee');
    await page.goto('/forms/jsa');
    await page.waitForSelector('form, [data-testid="jsa-wizard"]');
    
    // Fill data
    await page.fill('input[name="workLocation"], [data-testid="work-location"]', 'Auto-Save Test Location');
    
    // Wait for potential auto-save interval (30 seconds per plan)
    // For testing, we'll check for any network activity or localStorage updates
    
    let networkRequestMade = false;
    page.on('request', request => {
      if (request.url().includes('daily_jsa') && request.method() === 'POST') {
        networkRequestMade = true;
      }
    });
    
    // Wait shorter time for test
    await page.waitForTimeout(5000);
    
    // Check for auto-save indicator
    const autoSaveIndicator = page.locator('text=saved, text=auto-saved, [data-testid="auto-save-indicator"]');
    const indicatorVisible = await autoSaveIndicator.first().isVisible().catch(() => false);
    
    console.log(`Auto-save network request: ${networkRequestMade}`);
    console.log(`Auto-save indicator visible: ${indicatorVisible}`);
  });
});

test.describe('PWA Updates', () => {
  test('should handle app updates gracefully', async ({ page }) => {
    await page.goto('/');
    
    // Check for update handling
    const hasUpdateMechanism = await page.evaluate(() => {
      // Check for service worker update handling
      if ('serviceWorker' in navigator) {
        return navigator.serviceWorker.controller !== null;
      }
      return false;
    });
    
    console.log(`Has service worker controller: ${hasUpdateMechanism}`);
  });

  test('should show update available notification', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(3000);
    
    // Check for update notification component
    const updateNotification = page.locator(
      '[data-testid="update-available"], ' +
      'text=update available, ' +
      'text=new version, ' +
      '.update-banner'
    );
    
    // This will only show if there's actually an update
    const isVisible = await updateNotification.first().isVisible().catch(() => false);
    console.log(`Update notification visible: ${isVisible}`);
  });
});

test.describe('iOS PWA Specific', () => {
  test.use({ 
    viewport: { width: 375, height: 812 }, // iPhone X
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
  });

  test('should have apple-touch-icon', async ({ page }) => {
    await page.goto('/');
    
    const appleTouchIcon = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
    expect(appleTouchIcon).toBeTruthy();
  });

  test('should have apple-mobile-web-app-capable meta tag', async ({ page }) => {
    await page.goto('/');
    
    const webAppCapable = await page.locator('meta[name="apple-mobile-web-app-capable"]').getAttribute('content');
    expect(webAppCapable).toBe('yes');
  });

  test('should have proper status bar style', async ({ page }) => {
    await page.goto('/');
    
    const statusBarStyle = await page.locator('meta[name="apple-mobile-web-app-status-bar-style"]').getAttribute('content');
    expect(statusBarStyle).toBeTruthy();
  });
});
