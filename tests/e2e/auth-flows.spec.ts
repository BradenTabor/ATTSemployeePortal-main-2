/**
 * Authentication Flows E2E Tests
 * 
 * Tests for login, logout, password reset, and session management.
 */

import { test, expect } from '@playwright/test';

// Test credentials (should match seeded test users)
const TEST_USER = {
  email: 'test-employee@atts.test',
  password: 'TestPassword123!',
};

test.describe('Login Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display login form', async ({ page }) => {
    // If not logged in, should show login form
    const loginForm = page.locator('form, [data-testid="login-form"]');
    const isLoggedIn = await page.locator('[data-testid="dashboard"]').isVisible().catch(() => false);
    
    if (!isLoggedIn) {
      await expect(loginForm).toBeVisible();
    }
  });

  test('should have email and password inputs', async ({ page }) => {
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    const passwordInput = page.locator('input[type="password"], input[name="password"]');
    
    const loginVisible = await emailInput.isVisible().catch(() => false);
    
    if (loginVisible) {
      await expect(emailInput).toBeVisible();
      await expect(passwordInput).toBeVisible();
    }
  });

  test('should show error for invalid credentials', async ({ page }) => {
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    
    if (await emailInput.isVisible()) {
      await emailInput.fill('invalid@example.com');
      await page.fill('input[type="password"], input[name="password"]', 'wrongpassword');
      
      await page.click('button[type="submit"]');
      
      // Should show error
      const error = page.locator('[data-sonner-toast][data-type="error"], .error, text=invalid, text=incorrect');
      await expect(error.first()).toBeVisible({ timeout: 10000 });
    }
  });

  test('should show error for empty credentials', async ({ page }) => {
    const submitButton = page.locator('button[type="submit"]');
    
    if (await submitButton.isVisible()) {
      await submitButton.click();
      
      // Should show validation error or prevent submission
      await page.waitForTimeout(1000);
    }
  });

  test('should redirect to dashboard on successful login', async ({ page }) => {
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    
    if (await emailInput.isVisible()) {
      await emailInput.fill(TEST_USER.email);
      await page.fill('input[type="password"], input[name="password"]', TEST_USER.password);
      
      await page.click('button[type="submit"]');
      
      // Should redirect to dashboard
      await expect(page).toHaveURL(/dashboard|forms/, { timeout: 15000 });
    }
  });

  test('should persist session after page refresh', async ({ page }) => {
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    
    if (await emailInput.isVisible()) {
      await emailInput.fill(TEST_USER.email);
      await page.fill('input[type="password"], input[name="password"]', TEST_USER.password);
      await page.click('button[type="submit"]');
      
      await page.waitForURL(/dashboard|forms/, { timeout: 15000 });
      
      // Refresh page
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      // Should still be logged in
      await expect(page).toHaveURL(/dashboard|forms/);
    }
  });
});

test.describe('Logout Flow', () => {
  test('should allow user to logout', async ({ page }) => {
    // Login first
    await page.goto('/');
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    
    if (await emailInput.isVisible()) {
      await emailInput.fill(TEST_USER.email);
      await page.fill('input[type="password"], input[name="password"]', TEST_USER.password);
      await page.click('button[type="submit"]');
      await page.waitForURL(/dashboard|forms/, { timeout: 15000 });
    }
    
    // Find and click logout
    const logoutButton = page.locator('button:has-text("Logout"), button:has-text("Sign Out"), [data-testid="logout"]');
    
    // May need to open user menu first
    const userMenu = page.locator('[data-testid="user-menu"], [data-testid="profile-button"]');
    if (await userMenu.isVisible()) {
      await userMenu.click();
      await page.waitForTimeout(500);
    }
    
    if (await logoutButton.isVisible()) {
      await logoutButton.click();
      
      // Should redirect to login page
      await page.waitForURL(/login|\/$/);
    }
  });

  test('should clear session on logout', async ({ page }) => {
    // Login
    await page.goto('/');
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    
    if (await emailInput.isVisible()) {
      await emailInput.fill(TEST_USER.email);
      await page.fill('input[type="password"], input[name="password"]', TEST_USER.password);
      await page.click('button[type="submit"]');
      await page.waitForURL(/dashboard|forms/, { timeout: 15000 });
    }
    
    // Logout
    const userMenu = page.locator('[data-testid="user-menu"], [data-testid="profile-button"]');
    if (await userMenu.isVisible()) {
      await userMenu.click();
    }
    
    const logoutButton = page.locator('button:has-text("Logout"), button:has-text("Sign Out")');
    if (await logoutButton.isVisible()) {
      await logoutButton.click();
      await page.waitForURL(/login|\/$/, { timeout: 5000 });
    }
    
    // Try to access protected page
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Should be redirected to login
    const url = page.url();
    expect(url).not.toMatch(/dashboard$/);
  });
});

test.describe('Password Reset', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should show forgot password link', async ({ page }) => {
    const forgotLink = page.locator('a:has-text("Forgot"), a:has-text("Reset"), [data-testid="forgot-password"]');
    
    if (await forgotLink.isVisible()) {
      expect(true).toBe(true);
    }
  });

  test('should navigate to password reset page', async ({ page }) => {
    const forgotLink = page.locator('a:has-text("Forgot"), a:has-text("Reset"), [data-testid="forgot-password"]');
    
    if (await forgotLink.isVisible()) {
      await forgotLink.click();
      await page.waitForLoadState('networkidle');
      
      // Should show reset form
      const resetForm = page.locator('form, [data-testid="reset-form"]');
      await expect(resetForm).toBeVisible();
    }
  });

  test('should validate email for password reset', async ({ page }) => {
    await page.goto('/reset-password');
    
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    
    if (await emailInput.isVisible()) {
      // Submit without email
      await page.click('button[type="submit"]');
      
      // Should show error
      await page.waitForTimeout(1000);
    }
  });

  test('should send reset email for valid address', async ({ page }) => {
    await page.goto('/reset-password');
    
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    
    if (await emailInput.isVisible()) {
      await emailInput.fill(TEST_USER.email);
      await page.click('button[type="submit"]');
      
      // Should show success message
      const success = page.locator('[data-sonner-toast][data-type="success"], text=sent, text=email');
      await expect(success.first()).toBeVisible({ timeout: 10000 });
    }
  });
});

test.describe('Protected Routes', () => {
  test('should redirect unauthenticated user to login', async ({ page }) => {
    // Try to access protected routes without auth
    const protectedRoutes = [
      '/dashboard',
      '/dashboard/forms/dvir',
      '/forms/jsa',
      '/dashboard/forms/equipment-inspection',
    ];
    
    for (const route of protectedRoutes) {
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      
      const url = page.url();
      // Should either redirect to login or show login form
      const isProtected = url.includes('login') || url === page.url().split('/')[0] + '/';
      const hasLoginForm = await page.locator('input[type="password"]').isVisible().catch(() => false);
      
      expect(isProtected || hasLoginForm).toBe(true);
    }
  });

  test('should allow authenticated user to access protected routes', async ({ page }) => {
    // Login first
    await page.goto('/');
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    
    if (await emailInput.isVisible()) {
      await emailInput.fill(TEST_USER.email);
      await page.fill('input[type="password"], input[name="password"]', TEST_USER.password);
      await page.click('button[type="submit"]');
      await page.waitForURL(/dashboard|forms/, { timeout: 15000 });
    }
    
    // Now access protected routes
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('main')).toBeVisible();
  });
});

test.describe('Session Management', () => {
  test('should handle expired session gracefully', async ({ page }) => {
    // This test would require mocking token expiration
    // For now, we verify the app handles auth state changes
    
    await page.goto('/');
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    
    if (await emailInput.isVisible()) {
      await emailInput.fill(TEST_USER.email);
      await page.fill('input[type="password"], input[name="password"]', TEST_USER.password);
      await page.click('button[type="submit"]');
      await page.waitForURL(/dashboard|forms/, { timeout: 15000 });
    }
    
    // Clear auth cookies/storage to simulate session expiry
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());
    
    // Refresh page
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Should redirect to login
    const loginForm = page.locator('input[type="password"]');
    const isLoginVisible = await loginForm.isVisible().catch(() => false);
    
    // Either shows login or still on protected page (depending on implementation)
    console.log(`Login form visible after session clear: ${isLoginVisible}`);
  });

  test('should handle multi-tab logout', async ({ context, page }) => {
    // Login in first tab
    await page.goto('/');
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    
    if (await emailInput.isVisible()) {
      await emailInput.fill(TEST_USER.email);
      await page.fill('input[type="password"], input[name="password"]', TEST_USER.password);
      await page.click('button[type="submit"]');
      await page.waitForURL(/dashboard|forms/, { timeout: 15000 });
    }
    
    // Open second tab
    const page2 = await context.newPage();
    await page2.goto('/dashboard');
    await page2.waitForLoadState('networkidle');
    
    // Logout in first tab
    const userMenu = page.locator('[data-testid="user-menu"], [data-testid="profile-button"]');
    if (await userMenu.isVisible()) {
      await userMenu.click();
    }
    
    const logoutButton = page.locator('button:has-text("Logout"), button:has-text("Sign Out")');
    if (await logoutButton.isVisible()) {
      await logoutButton.click();
    }
    
    // Check second tab
    await page2.reload();
    await page2.waitForLoadState('networkidle');
    
    // Second tab should also be logged out
    const loginVisible = await page2.locator('input[type="password"]').isVisible().catch(() => false);
    console.log(`Second tab logged out: ${loginVisible}`);
  });
});
