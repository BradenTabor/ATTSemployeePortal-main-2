/**
 * E2E Authentication Helpers
 * 
 * Helper functions for logging in as test users during E2E tests.
 */

import { Page, expect } from '@playwright/test';

export type TestRole = 'employee' | 'foreman' | 'mechanic' | 'general_foreman' | 'admin';

const TEST_CREDENTIALS: Record<TestRole, { email: string; password: string }> = {
  employee: {
    email: 'test-employee@atts.test',
    password: 'TestPassword123!',
  },
  foreman: {
    email: 'test-foreman@atts.test',
    password: 'TestPassword123!',
  },
  mechanic: {
    email: 'test-mechanic@atts.test',
    password: 'TestPassword123!',
  },
  general_foreman: {
    email: 'test-gf@atts.test',
    password: 'TestPassword123!',
  },
  admin: {
    email: 'test-admin@atts.test',
    password: 'TestPassword123!',
  },
};

/**
 * Log in as a test user
 */
export async function loginAs(page: Page, role: TestRole): Promise<void> {
  const credentials = TEST_CREDENTIALS[role];
  
  // Navigate to login page
  await page.goto('/');
  
  // Wait for the page to load
  await page.waitForLoadState('networkidle');
  
  // Check if already logged in
  const dashboardVisible = await page.locator('[data-testid="dashboard"]').isVisible().catch(() => false);
  if (dashboardVisible) {
    // Already logged in, check if correct role
    return;
  }
  
  // Fill login form
  await page.fill('[data-testid="email-input"], input[type="email"], input[name="email"]', credentials.email);
  await page.fill('[data-testid="password-input"], input[type="password"], input[name="password"]', credentials.password);
  
  // Submit login
  await page.click('[data-testid="login-button"], button[type="submit"]');
  
  // Wait for navigation to dashboard
  await expect(page).toHaveURL(/dashboard|forms/, { timeout: 15000 });
}

/**
 * Log out the current user
 */
export async function logout(page: Page): Promise<void> {
  // Click user menu or logout button
  const logoutButton = page.locator('[data-testid="logout-button"], button:has-text("Sign Out"), button:has-text("Logout")');
  
  if (await logoutButton.isVisible()) {
    await logoutButton.click();
  } else {
    // Try opening user menu first
    const userMenu = page.locator('[data-testid="user-menu"], [data-testid="profile-button"]');
    if (await userMenu.isVisible()) {
      await userMenu.click();
      await page.click('text=Sign Out, text=Logout');
    }
  }
  
  // Wait for redirect to login
  await page.waitForURL(/login|\/$/);
}

/**
 * Assert that the current user has a specific role
 */
export async function assertUserRole(page: Page, expectedRole: TestRole): Promise<void> {
  // This might need customization based on how role is displayed in the UI
  const roleIndicator = page.locator(`[data-testid="user-role"], [data-role="${expectedRole}"]`);
  
  if (await roleIndicator.isVisible()) {
    await expect(roleIndicator).toContainText(expectedRole, { ignoreCase: true });
  }
}

/**
 * Get authentication state for storage/reuse
 */
export async function getAuthState(page: Page): Promise<string> {
  const storage = await page.context().storageState();
  return JSON.stringify(storage);
}

/**
 * Set authentication state from storage
 */
export async function setAuthState(page: Page, state: string): Promise<void> {
  const storage = JSON.parse(state);
  await page.context().addCookies(storage.cookies || []);
  
  // Set localStorage items
  if (storage.origins) {
    for (const origin of storage.origins) {
      for (const item of origin.localStorage || []) {
        await page.evaluate(([key, value]) => {
          localStorage.setItem(key, value);
        }, [item.name, item.value]);
      }
    }
  }
}
