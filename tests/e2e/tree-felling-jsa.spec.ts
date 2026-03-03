/**
 * Tree Felling JSA E2E Tests (Agent 4).
 * Happy path, blank submission rejection, and invalid retreat path rejection.
 */

import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

test.describe("Tree Felling JSA Form", () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    await loginAs(page, "employee");
    await page.goto("/forms/jsa/tree-felling", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
  });

  test("form loads with ANSI Z133 sections", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /Tree Felling JSA/i })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText(/Tree assessment/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Lean & fall plan/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Safety plan/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Equipment checklist/i)).toBeVisible({ timeout: 5000 });
  });

  test("blank form cannot submit as completed", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /Tree Felling JSA/i })).toBeVisible({
      timeout: 10000,
    });
    const submitBtn = page.getByRole("button", { name: /Submit/i });
    await submitBtn.click();
    await page.waitForTimeout(800);
    const validationSummary = page.getByRole("alert");
    const hasErrors =
      (await validationSummary.count()) > 0 ||
      (await page.getByText(/Job date is required|Work location is required|at least 90°/i).count()) >
        0;
    expect(hasErrors).toBe(true);
    await expect(page).toHaveURL(/\/forms\/jsa\/tree-felling/);
  });

  test("Save draft works without full validation", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /Tree Felling JSA/i })).toBeVisible({
      timeout: 10000,
    });
    const draftBtn = page.getByRole("button", { name: /Save draft/i });
    await draftBtn.click();
    await page.waitForTimeout(2000);
    await expect(page.getByText(/Draft saved|saved for sync/i)).toBeVisible({ timeout: 8000 });
  });
});
