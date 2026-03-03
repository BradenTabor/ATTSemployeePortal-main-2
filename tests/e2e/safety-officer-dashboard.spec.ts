/**
 * Safety Officer Dashboard E2E Tests
 *
 * Covers SO dashboard access, key widgets, critical alerts section, responsive layout.
 */

import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

test.describe("Safety Officer Dashboard", () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/safety-officer-dashboard");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);
  });

  test("SO role can access dashboard", async ({ page }) => {
    await expect(page).toHaveURL(/safety-officer-dashboard/);
    const main = page.locator("main").or(page.locator("[data-testid='dashboard']")).first();
    await expect(main).toBeVisible({ timeout: 10000 });
  });

  test("key widgets render", async ({ page }) => {
    await expect(page.getByText("Compliance rates", { exact: false }).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Days since last recordable", { exact: false }).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Certification expiration", { exact: false }).first()).toBeVisible({ timeout: 5000 });
  });

  test("critical alerts section renders", async ({ page }) => {
    // Section is always present; widgets inside (RapidReportingTimer, PostingReminder) may render nothing when no events or outside posting period
    const section = page.getByRole("region", { name: "Critical alerts" });
    await expect(section).toBeVisible({ timeout: 5000 });
  });

  test("responsive layout at mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);
    const main = page.locator("main").first();
    await expect(main).toBeVisible();
    await expect(page.getByText("Compliance rates", { exact: false }).first()).toBeVisible({ timeout: 5000 });
  });

  test("responsive layout at tablet viewport", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(500);
    await expect(page.getByText("Compliance rates", { exact: false }).first()).toBeVisible({ timeout: 5000 });
  });

  test("responsive layout at desktop viewport", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(500);
    await expect(page.getByText("Compliance rates", { exact: false }).first()).toBeVisible({ timeout: 5000 });
  });
});
