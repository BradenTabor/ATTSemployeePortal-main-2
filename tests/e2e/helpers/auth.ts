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
 * Log in as a test user.
 * Requires test users to exist in Supabase — run `npm run test:setup` first.
 */
export async function loginAs(page: Page, role: TestRole): Promise<void> {
  const credentials = TEST_CREDENTIALS[role];

  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  // If already on an app route (session restored), we're done
  const url = page.url();
  if (/\/(dashboard|admin|forms|mechanic-dashboard|general-foreman-dashboard|safety-officer-dashboard|foreman-dashboard)(\/|$)/.test(new URL(url).pathname)) {
    return;
  }

  // Wait for login form (Home uses id="auth-email" / id="auth-password")
  const emailInput = page.locator('#auth-email').or(page.locator('input[type="email"]')).first();
  await emailInput.waitFor({ state: 'visible', timeout: 10000 });
  await emailInput.fill(credentials.email);
  await page.locator('#auth-password').or(page.locator('input[type="password"]')).first().fill(credentials.password);

  await page.click('button[type="submit"]');
  await page.waitForLoadState('domcontentloaded');

  // Wait for redirect to any dashboard (allow 20s for Supabase + AuthContext)
  const dashboardRegex = /\/(dashboard|admin|forms|mechanic-dashboard|general-foreman-dashboard|safety-officer-dashboard|foreman-dashboard)(\/|$)/;
  try {
    await expect(page).toHaveURL(dashboardRegex, { timeout: 20000 });
    await dismissOnboardingIfPresent(page);
  } catch {
    const stillOnLogin = await page.locator('#auth-email, input[type="email"]').isVisible().catch(() => false);
    const errorText = await page.locator('.border-red-500\\/20, [role="alert"], .text-destructive').textContent().catch(() => '');
    if (stillOnLogin) {
      throw new Error(
        `E2E login failed (role: ${role}). Page stayed on login. ` +
          (errorText ? `Auth error: ${errorText.slice(0, 200)}. ` : '') +
          'Ensure test users exist: run `npm run test:setup` and that VITE_SUPABASE_URL / Supabase keys point to the same project.'
      );
    }
    throw new Error(`E2E login failed: expected redirect to dashboard, got ${page.url()}`);
  }
}

/**
 * Dismiss "What's New" onboarding modal if present (so it does not block form interactions).
 * Call after login or after navigating to a page that might show the modal.
 */
export async function dismissOnboardingIfPresent(page: Page): Promise<void> {
  // Prevent modal from showing in this session (localStorage key used by appVersion)
  await page.evaluate(() => {
    try {
      localStorage.setItem('atts_onboarding_completed_version', '999.0.0');
    } catch {
      // ignore
    }
  });
  const dialog = page.getByRole('dialog', { name: /What's New in ATTS Portal/i });
  if (await dialog.isVisible().catch(() => false)) {
    const skipButton = page.locator('button:has-text("Skip")').first();
    if (await skipButton.isVisible().catch(() => false)) {
      await skipButton.click({ force: true });
      await dialog.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
    }
  }
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
