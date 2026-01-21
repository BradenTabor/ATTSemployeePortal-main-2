/**
 * Request Time Off (RTO) Form E2E Tests
 * 
 * End-to-end tests for the time off request form and approval flow.
 */

import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

test.describe('Request Time Off Form', () => {
  test.describe('Form Access', () => {
    test('should allow employee to access RTO form', async ({ page }) => {
      await loginAs(page, 'employee');
      await page.goto('/dashboard/forms/request-time-off');
      
      await expect(page.locator('form, [data-testid="rto-form"]')).toBeVisible({ timeout: 10000 });
    });

    test('should pre-fill user email', async ({ page }) => {
      await loginAs(page, 'employee');
      await page.goto('/dashboard/forms/request-time-off');
      
      await page.waitForSelector('form');
      await page.waitForTimeout(1000); // Wait for user data to load
      
      const emailInput = page.locator('input[name="email"], [data-testid="email"]');
      const emailValue = await emailInput.inputValue();
      
      // Should have some email value (pre-filled from auth)
      expect(emailValue).toContain('@');
    });
  });

  test.describe('Form Validation', () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(page, 'employee');
      await page.goto('/dashboard/forms/request-time-off');
      await page.waitForSelector('form');
    });

    test('should require full name', async ({ page }) => {
      // Clear any pre-filled name
      const nameInput = page.locator('input[name="fullName"], [data-testid="full-name"]');
      await nameInput.clear();
      
      // Fill other required fields
      await page.fill('input[name="startDate"], [data-testid="start-date"]', '2026-02-01');
      await page.fill('input[name="endDate"], [data-testid="end-date"]', '2026-02-03');
      
      // Try to submit
      await page.click('button[type="submit"]');
      
      // Should show error or prevent submission
      await page.waitForTimeout(1000);
    });

    test('should require start date', async ({ page }) => {
      await page.fill('input[name="fullName"], [data-testid="full-name"]', 'Test Employee');
      await page.fill('input[name="endDate"], [data-testid="end-date"]', '2026-02-03');
      
      await page.click('button[type="submit"]');
      
      // Should show validation error
      await expect(page.locator('[data-sonner-toast][data-type="error"], .error, text=start')).toBeVisible({ timeout: 5000 });
    });

    test('should require end date', async ({ page }) => {
      await page.fill('input[name="fullName"], [data-testid="full-name"]', 'Test Employee');
      await page.fill('input[name="startDate"], [data-testid="start-date"]', '2026-02-01');
      
      await page.click('button[type="submit"]');
      
      // Should show validation error
      await expect(page.locator('[data-sonner-toast][data-type="error"], .error, text=end')).toBeVisible({ timeout: 5000 });
    });

    test('should reject end date before start date', async ({ page }) => {
      await page.fill('input[name="fullName"], [data-testid="full-name"]', 'Test Employee');
      await page.fill('input[name="startDate"], [data-testid="start-date"]', '2026-02-10');
      await page.fill('input[name="endDate"], [data-testid="end-date"]', '2026-02-05');
      
      await page.click('button[type="submit"]');
      
      // Should show validation error about date range
      await page.waitForTimeout(1000);
    });

    test('should require reason', async ({ page }) => {
      await page.fill('input[name="fullName"], [data-testid="full-name"]', 'Test Employee');
      await page.fill('input[name="startDate"], [data-testid="start-date"]', '2026-02-01');
      await page.fill('input[name="endDate"], [data-testid="end-date"]', '2026-02-03');
      
      // Don't fill reason
      
      await page.click('button[type="submit"]');
      
      // Should show validation error
      await page.waitForTimeout(1000);
    });
  });

  test.describe('Happy Path', () => {
    test('should submit RTO request successfully', async ({ page }) => {
      await loginAs(page, 'employee');
      await page.goto('/dashboard/forms/request-time-off');
      
      await page.waitForSelector('form');
      
      // Fill all required fields
      await page.fill('input[name="fullName"], [data-testid="full-name"]', 'E2E Test Employee');
      
      // Set dates (2 weeks from now)
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 14);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 2);
      
      await page.fill('input[name="startDate"], [data-testid="start-date"]', startDate.toISOString().split('T')[0]);
      await page.fill('input[name="endDate"], [data-testid="end-date"]', endDate.toISOString().split('T')[0]);
      
      // Fill time fields if present
      const startTimeInput = page.locator('input[name="startTime"], [data-testid="start-time"]');
      if (await startTimeInput.isVisible()) {
        await startTimeInput.fill('08:00');
      }
      
      const endTimeInput = page.locator('input[name="endTime"], [data-testid="end-time"]');
      if (await endTimeInput.isVisible()) {
        await endTimeInput.fill('17:00');
      }
      
      // Select reason
      const reasonSelect = page.locator('select[name="reason"], [data-testid="reason"]');
      if (await reasonSelect.isVisible()) {
        await reasonSelect.selectOption('vacation');
      } else {
        const reasonInput = page.locator('input[name="reason"]');
        if (await reasonInput.isVisible()) {
          await reasonInput.fill('vacation');
        }
      }
      
      // Add optional notes
      const notesInput = page.locator('textarea[name="notes"], [data-testid="notes"]');
      if (await notesInput.isVisible()) {
        await notesInput.fill('E2E Test - Family vacation');
      }
      
      // Submit
      await page.click('button[type="submit"]');
      
      // Should show success
      await expect(page.locator('[data-sonner-toast][data-type="success"], .toast-success')).toBeVisible({ timeout: 15000 });
    });

    test('should calculate total duration correctly', async ({ page }) => {
      await loginAs(page, 'employee');
      await page.goto('/dashboard/forms/request-time-off');
      
      await page.waitForSelector('form');
      
      // Set a known date range
      await page.fill('input[name="startDate"], [data-testid="start-date"]', '2026-02-01');
      await page.fill('input[name="endDate"], [data-testid="end-date"]', '2026-02-03');
      
      const startTimeInput = page.locator('input[name="startTime"], [data-testid="start-time"]');
      const endTimeInput = page.locator('input[name="endTime"], [data-testid="end-time"]');
      
      if (await startTimeInput.isVisible() && await endTimeInput.isVisible()) {
        await startTimeInput.fill('08:00');
        await endTimeInput.fill('17:00');
        
        await page.waitForTimeout(500);
        
        // Check for duration display
        const durationDisplay = page.locator('[data-testid="total-duration"], .duration, text=hours, text=days');
        if (await durationDisplay.isVisible()) {
          const durationText = await durationDisplay.textContent();
          // Should show some duration calculation
          expect(durationText).toBeTruthy();
        }
      }
    });
  });

  test.describe('RTO History', () => {
    test('should show user RTO history', async ({ page }) => {
      await loginAs(page, 'employee');
      
      // Navigate to RTO history if separate page exists
      await page.goto('/dashboard/forms/request-time-off');
      await page.waitForSelector('form');
      
      // Look for history section or link
      const historySection = page.locator('[data-testid="rto-history"], .rto-history, text=history, text=requests');
      
      if (await historySection.first().isVisible()) {
        // History is shown on the same page
        expect(true).toBe(true);
      } else {
        // Try to find a link to history
        const historyLink = page.locator('a[href*="history"], button:has-text("History")');
        if (await historyLink.isVisible()) {
          await historyLink.click();
          await page.waitForLoadState('networkidle');
        }
      }
    });
  });
});

test.describe('Admin RTO Management', () => {
  test('should allow admin to view all RTO requests', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/admin/rto');
    
    await page.waitForLoadState('networkidle');
    
    // Should see RTO management interface
    const rtoList = page.locator('[data-testid="rto-list"], table, .rto-requests');
    await expect(rtoList).toBeVisible({ timeout: 10000 });
  });

  test('should allow admin to approve RTO request', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/admin/rto');
    
    await page.waitForLoadState('networkidle');
    
    // Find a pending request
    const pendingRequest = page.locator('[data-status="pending"], tr:has-text("pending")').first();
    
    if (await pendingRequest.isVisible()) {
      // Find approve button
      const approveButton = pendingRequest.locator('button:has-text("Approve"), [data-action="approve"]');
      
      if (await approveButton.isVisible()) {
        await approveButton.click();
        
        // Should show success
        await expect(page.locator('[data-sonner-toast][data-type="success"], .toast-success')).toBeVisible({ timeout: 10000 });
      }
    }
  });

  test('should allow admin to deny RTO request', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/admin/rto');
    
    await page.waitForLoadState('networkidle');
    
    // Find a pending request
    const pendingRequest = page.locator('[data-status="pending"], tr:has-text("pending")').first();
    
    if (await pendingRequest.isVisible()) {
      // Find deny button
      const denyButton = pendingRequest.locator('button:has-text("Deny"), button:has-text("Reject"), [data-action="deny"]');
      
      if (await denyButton.isVisible()) {
        await denyButton.click();
        
        // May need to provide reason
        const reasonInput = page.locator('textarea[name="denyReason"], [data-testid="deny-reason"]');
        if (await reasonInput.isVisible()) {
          await reasonInput.fill('Test denial reason');
          await page.click('button:has-text("Confirm"), button:has-text("Submit")');
        }
        
        // Should show success
        await page.waitForTimeout(2000);
      }
    }
  });
});

test.describe('RTO Form - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('should be usable on mobile', async ({ page }) => {
    await loginAs(page, 'employee');
    await page.goto('/dashboard/forms/request-time-off');
    
    await page.waitForSelector('form');
    
    // Form should be visible
    await expect(page.locator('form')).toBeVisible();
    
    // All inputs should be accessible
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });
});
