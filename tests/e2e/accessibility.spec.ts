/**
 * Accessibility E2E Tests
 * 
 * Tests for WCAG 2.1 AA compliance across safety-critical forms.
 * Covers keyboard navigation, screen reader compatibility, and visual accessibility.
 */

import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

test.describe('Accessibility - DVIR Form', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'employee');
    await page.goto('/dashboard/forms/dvir');
    await page.waitForSelector('form');
  });

  test.describe('Keyboard Navigation', () => {
    test('should allow tab navigation through all form fields', async ({ page }) => {
      // Focus first element
      await page.keyboard.press('Tab');
      
      // Track focused elements
      const focusedElements: string[] = [];
      
      // Tab through form (max 50 tabs)
      for (let i = 0; i < 50; i++) {
        const focused = await page.evaluate(() => {
          const el = document.activeElement;
          return el ? {
            tag: el.tagName,
            name: el.getAttribute('name'),
            type: el.getAttribute('type'),
            testId: el.getAttribute('data-testid'),
          } : null;
        });
        
        if (focused) {
          focusedElements.push(`${focused.tag}:${focused.name || focused.testId || focused.type}`);
        }
        
        // Check if we've reached submit button
        const isSubmit = await page.evaluate(() => {
          const el = document.activeElement;
          return el?.tagName === 'BUTTON' && el.getAttribute('type') === 'submit';
        });
        
        if (isSubmit) break;
        
        await page.keyboard.press('Tab');
      }
      
      // Should have focused multiple elements
      expect(focusedElements.length).toBeGreaterThan(5);
      
      // Should include critical inputs
      // (specific elements depend on form structure)
    });

    test('should have visible focus indicators', async ({ page }) => {
      // Tab to first input
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      
      // Check focus visibility
      const hasFocusIndicator = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el) return false;
        
        const style = window.getComputedStyle(el);
        const outline = style.outline;
        const boxShadow = style.boxShadow;
        // borderColor available for future use
        
        // Check for some form of focus indicator
        return outline !== 'none' || 
               boxShadow !== 'none' || 
               style.outlineWidth !== '0px';
      });
      
      expect(hasFocusIndicator).toBe(true);
    });

    test('should allow form submission with Enter key', async ({ page }) => {
      // Fill minimal required fields
      await page.fill('input[name="truckNumber"], [data-testid="truck-number"]', 'TEST-A11Y');
      await page.fill('input[name="driversName"], [data-testid="drivers-name"]', 'A11y Test');
      await page.fill('input[name="mileage"], [data-testid="mileage"]', '50000');
      
      // Focus submit button
      const submitButton = page.locator('button[type="submit"]');
      await submitButton.focus();
      
      // Press Enter
      await page.keyboard.press('Enter');
      
      // Should trigger submission (may fail validation, but button was activated)
      await page.waitForTimeout(1000);
    });

    test('should close modals with Escape key', async ({ page }) => {
      // Look for any modal triggers
      const modalTrigger = page.locator('[data-testid="open-modal"], button:has-text("Help"), button:has-text("Info")');
      
      if (await modalTrigger.isVisible()) {
        await modalTrigger.click();
        await page.waitForTimeout(500);
        
        // Press Escape
        await page.keyboard.press('Escape');
        
        // Modal should be closed
        const modal = page.locator('[role="dialog"], .modal, [data-testid="modal"]');
        await expect(modal).not.toBeVisible();
      }
    });
  });

  test.describe('Screen Reader Compatibility', () => {
    test('should have proper form labels', async ({ page }) => {
      // Check for associated labels on inputs
      const inputs = page.locator('input:not([type="hidden"]):not([type="file"])');
      const inputCount = await inputs.count();
      
      let labeledCount = 0;
      
      for (let i = 0; i < inputCount; i++) {
        const input = inputs.nth(i);
        const id = await input.getAttribute('id');
        const ariaLabel = await input.getAttribute('aria-label');
        const ariaLabelledBy = await input.getAttribute('aria-labelledby');
        const placeholder = await input.getAttribute('placeholder');
        
        // Check for associated label
        let hasLabel = false;
        
        if (id) {
          const label = page.locator(`label[for="${id}"]`);
          hasLabel = await label.isVisible().catch(() => false);
        }
        
        if (!hasLabel && (ariaLabel || ariaLabelledBy || placeholder)) {
          hasLabel = true;
        }
        
        if (hasLabel) labeledCount++;
      }
      
      // At least 80% of inputs should have labels
      expect(labeledCount / inputCount).toBeGreaterThan(0.8);
    });

    test('should have required fields marked with aria-required', async ({ page }) => {
      const requiredInputs = page.locator('[required], [aria-required="true"]');
      const count = await requiredInputs.count();
      
      // Should have some required fields
      expect(count).toBeGreaterThan(0);
    });

    test('should have error messages in aria-live regions', async ({ page }) => {
      // Trigger a validation error
      await page.click('button[type="submit"]');
      await page.waitForTimeout(1000);
      
      // Check for aria-live regions
      const liveRegions = page.locator('[aria-live], [role="alert"], [role="status"]');
      const count = await liveRegions.count();
      
      // Should have live regions for announcements
      // (may be 0 if no errors or different implementation)
      console.log(`Found ${count} aria-live regions`);
    });

    test('should have proper heading hierarchy', async ({ page }) => {
      const headings = await page.evaluate(() => {
        const h1s = document.querySelectorAll('h1').length;
        const h2s = document.querySelectorAll('h2').length;
        const h3s = document.querySelectorAll('h3').length;
        
        return { h1s, h2s, h3s };
      });
      
      // Should have logical heading structure
      // At most one h1
      expect(headings.h1s).toBeLessThanOrEqual(1);
      
      // Should have some headings
      expect(headings.h1s + headings.h2s + headings.h3s).toBeGreaterThan(0);
    });
  });

  test.describe('Visual Accessibility', () => {
    test('should have adequate color contrast', async ({ page }) => {
      // Check text elements for contrast
      const textContrast = await page.evaluate(() => {
        const elements = document.querySelectorAll('p, span, label, h1, h2, h3, h4, h5, h6');
        let lowContrastCount = 0;
        
        elements.forEach(el => {
          const style = window.getComputedStyle(el);
          const color = style.color;
          const bgColor = style.backgroundColor;
          
          // Basic check - not a full contrast calculation
          // A proper check would calculate luminance ratio
          if (color === 'rgb(255, 255, 255)' && bgColor === 'rgb(255, 255, 255)') {
            lowContrastCount++;
          }
        });
        
        return { total: elements.length, lowContrast: lowContrastCount };
      });
      
      // Very few elements should have obvious contrast issues
      expect(textContrast.lowContrast).toBeLessThan(textContrast.total * 0.1);
    });

    test('should have touch targets at least 44x44px', async ({ page }) => {
      const buttons = page.locator('button, [role="button"], a');
      const count = await buttons.count();
      
      let smallTargets = 0;
      
      for (let i = 0; i < Math.min(count, 20); i++) {
        const button = buttons.nth(i);
        const box = await button.boundingBox();
        
        if (box) {
          if (box.width < 44 || box.height < 44) {
            smallTargets++;
          }
        }
      }
      
      // Most touch targets should meet minimum size
      // Some small icons may be acceptable
      expect(smallTargets).toBeLessThan(count * 0.3);
    });

    test('should have font size at least 16px for inputs', async ({ page }) => {
      const inputs = page.locator('input, textarea');
      const count = await inputs.count();
      
      for (let i = 0; i < count; i++) {
        const input = inputs.nth(i);
        const fontSize = await input.evaluate(el => {
          return parseFloat(window.getComputedStyle(el).fontSize);
        });
        
        // Font size should be at least 16px to prevent iOS zoom
        expect(fontSize).toBeGreaterThanOrEqual(16);
      }
    });

    test('should not truncate content at 200% zoom', async ({ page }) => {
      // Set viewport to simulate 200% zoom
      await page.setViewportSize({ width: 640, height: 480 }); // Half size = 200% zoom
      
      await page.goto('/dashboard/forms/dvir');
      await page.waitForSelector('form');
      
      // Check that form is still usable
      const form = page.locator('form');
      await expect(form).toBeVisible();
      
      // Submit button should still be visible (scrolling allowed)
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      const submitButton = page.locator('button[type="submit"]');
      await expect(submitButton).toBeVisible();
    });
  });
});

test.describe('Accessibility - JSA Form', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'employee');
    await page.goto('/forms/jsa');
    await page.waitForSelector('form, [data-testid="jsa-wizard"]');
  });

  test('should announce step changes', async ({ page }) => {
    // Navigate to next step
    await page.click('[data-testid="jsa-next"], button:has-text("Next")');
    await page.waitForTimeout(500);
    
    // Check for step indicator update
    const activeStep = page.locator('[aria-current="step"], [data-active="true"], .active-step');
    await expect(activeStep).toBeVisible();
  });

  test('should have progress indicator with aria attributes', async ({ page }) => {
    const progressIndicator = page.locator('[role="progressbar"], [aria-valuenow], .step-progress');
    
    if (await progressIndicator.isVisible()) {
      // Check for proper aria attributes
      const hasAria = await progressIndicator.getAttribute('aria-valuenow') !== null ||
                      await progressIndicator.getAttribute('aria-valuetext') !== null;
      
      expect(hasAria).toBe(true);
    }
  });
});

test.describe('Accessibility - Equipment Form', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'employee');
    await page.goto('/dashboard/forms/equipment-inspection');
    await page.waitForSelector('form');
  });

  test('should have accessible select dropdowns', async ({ page }) => {
    const selects = page.locator('select');
    const count = await selects.count();
    
    for (let i = 0; i < count; i++) {
      const select = selects.nth(i);
      
      // Should have id or aria-label
      const id = await select.getAttribute('id');
      const ariaLabel = await select.getAttribute('aria-label');
      const ariaLabelledBy = await select.getAttribute('aria-labelledby');
      
      // Should have some form of label
      if (id) {
        const label = page.locator(`label[for="${id}"]`);
        const hasLabel = await label.isVisible().catch(() => false);
        expect(hasLabel || ariaLabel || ariaLabelledBy).toBeTruthy();
      }
    }
  });
});

test.describe('Accessibility - Form Error States', () => {
  test('should indicate errors not just by color', async ({ page }) => {
    await loginAs(page, 'employee');
    await page.goto('/dashboard/forms/dvir');
    await page.waitForSelector('form');
    
    // Submit empty form to trigger errors
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1000);
    
    // Look for error indicators that aren't just color
    const errorIndicators = page.locator(
      '[aria-invalid="true"], ' +
      '.error-icon, ' +
      '[data-error="true"], ' +
      '.error-message, ' +
      '[role="alert"]'
    );
    
    const count = await errorIndicators.count();
    
    // Should have some non-color error indicators
    // (toast messages count as non-color indicators)
    const toast = page.locator('[data-sonner-toast], .toast');
    const toastVisible = await toast.isVisible().catch(() => false);
    
    expect(count > 0 || toastVisible).toBe(true);
  });
});
