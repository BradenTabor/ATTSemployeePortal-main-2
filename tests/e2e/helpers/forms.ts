/**
 * E2E Form Helpers
 * 
 * Helper functions for interacting with safety forms during E2E tests.
 */

import { Page, expect } from '@playwright/test';
import path from 'path';

const FIXTURES_DIR = path.join(__dirname, '../../fixtures');

/**
 * Fill a text input by test ID or name
 */
export async function fillInput(
  page: Page,
  selector: string,
  value: string
): Promise<void> {
  const input = page.locator(selector);
  await input.waitFor({ state: 'visible' });
  await input.fill(value);
}

/**
 * Upload a file to an input
 */
export async function uploadFile(
  page: Page,
  selector: string,
  filename: string
): Promise<void> {
  const filepath = path.join(FIXTURES_DIR, filename);
  const input = page.locator(selector);
  await input.setInputFiles(filepath);
}

/**
 * Click a button and wait for response
 */
export async function clickAndWait(
  page: Page,
  selector: string,
  options: { waitForNavigation?: boolean; waitForResponse?: string } = {}
): Promise<void> {
  const button = page.locator(selector);
  
  if (options.waitForNavigation) {
    await Promise.all([
      page.waitForNavigation(),
      button.click(),
    ]);
  } else if (options.waitForResponse) {
    await Promise.all([
      page.waitForResponse(options.waitForResponse),
      button.click(),
    ]);
  } else {
    await button.click();
  }
}

/**
 * Wait for a toast message
 */
export async function waitForToast(
  page: Page,
  type: 'success' | 'error' | 'info' = 'success',
  timeout: number = 10000
): Promise<string> {
  const toastSelector = {
    success: '[data-testid="toast-success"], .toast-success, [data-sonner-toast][data-type="success"]',
    error: '[data-testid="toast-error"], .toast-error, [data-sonner-toast][data-type="error"]',
    info: '[data-testid="toast-info"], .toast-info, [data-sonner-toast][data-type="info"]',
  };
  
  const toast = page.locator(toastSelector[type]);
  await toast.waitFor({ state: 'visible', timeout });
  return toast.textContent() || '';
}

/**
 * Fill DVIR form with test data
 */
export async function fillDVIRForm(
  page: Page,
  data: {
    truckNumber: string;
    driversName: string;
    mileage: string | number;
    oilDipstickPhoto?: string;
  }
): Promise<void> {
  // Truck number
  await fillInput(page, '[data-testid="truck-number"], input[name="truckNumber"]', data.truckNumber);
  
  // Driver's name
  await fillInput(page, '[data-testid="drivers-name"], input[name="driversName"]', data.driversName);
  
  // Mileage
  await fillInput(page, '[data-testid="mileage"], input[name="mileage"]', String(data.mileage));
  
  // Oil dipstick photo (required)
  if (data.oilDipstickPhoto) {
    await uploadFile(page, '[data-testid="oil-dipstick-upload"], input[name="oilDipstick"]', data.oilDipstickPhoto);
  }
}

/**
 * Navigate through JSA wizard steps
 */
export async function navigateJSAStep(
  page: Page,
  step: number
): Promise<void> {
  // Click on step indicator/pill
  const stepPill = page.locator(`[data-testid="jsa-step-${step}"], button:has-text("Step ${step}")`);
  
  if (await stepPill.isVisible()) {
    await stepPill.click();
  } else {
    // Use next/previous buttons
    const currentStep = await getCurrentJSAStep(page);
    
    if (step > currentStep) {
      for (let i = currentStep; i < step; i++) {
        await clickAndWait(page, '[data-testid="jsa-next"], button:has-text("Next")');
      }
    } else {
      for (let i = currentStep; i > step; i--) {
        await clickAndWait(page, '[data-testid="jsa-back"], button:has-text("Back")');
      }
    }
  }
  
  // Verify step is active
  await expect(page.locator(`[data-testid="jsa-step-${step}-active"]`)).toBeVisible();
}

/**
 * Get current JSA wizard step
 */
export async function getCurrentJSAStep(page: Page): Promise<number> {
  const activeStep = page.locator('[data-testid^="jsa-step-"][data-active="true"], .jsa-step.active');
  const stepText = await activeStep.getAttribute('data-testid') || '';
  const match = stepText.match(/jsa-step-(\d+)/);
  return match ? parseInt(match[1], 10) : 1;
}

/**
 * Fill JSA step 1 (Job Info)
 */
export async function fillJSAJobInfo(
  page: Page,
  data: {
    jobDate: string;
    workLocation: string;
    circuitNumber?: string;
  }
): Promise<void> {
  await fillInput(page, '[data-testid="job-date"], input[name="jobDate"]', data.jobDate);
  await fillInput(page, '[data-testid="work-location"], input[name="workLocation"]', data.workLocation);
  
  if (data.circuitNumber) {
    await fillInput(page, '[data-testid="circuit-number"], input[name="circuitNumber"]', data.circuitNumber);
  }
}

/**
 * Fill JSA signature
 */
export async function fillJSASignature(
  page: Page,
  signature: string
): Promise<void> {
  await fillInput(page, '[data-testid="employee-signature"], input[name="employeeSignature"]', signature);
}

/**
 * Select equipment type and number
 */
export async function selectEquipment(
  page: Page,
  type: string,
  number: string
): Promise<void> {
  // Select equipment type
  const typeSelect = page.locator('[data-testid="equipment-type"], select[name="equipmentType"]');
  await typeSelect.selectOption(type);
  
  // Wait for equipment numbers to load
  await page.waitForTimeout(500);
  
  // Select equipment number
  const numberSelect = page.locator('[data-testid="equipment-number"], select[name="equipmentNumber"]');
  await numberSelect.selectOption(number);
}

/**
 * Submit form and wait for result
 */
export async function submitForm(
  page: Page,
  options: {
    expectSuccess?: boolean;
    expectError?: boolean;
    timeout?: number;
  } = {}
): Promise<{ success: boolean; message?: string }> {
  const { expectSuccess = true, expectError = false, timeout = 15000 } = options;
  
  // Find and click submit button
  const submitButton = page.locator('button[type="submit"], [data-testid="submit-button"]');
  await submitButton.click();
  
  // Wait for response
  if (expectSuccess) {
    const toastMessage = await waitForToast(page, 'success', timeout);
    return { success: true, message: toastMessage };
  } else if (expectError) {
    const toastMessage = await waitForToast(page, 'error', timeout);
    return { success: false, message: toastMessage };
  }
  
  return { success: true };
}

/**
 * Check if form has validation errors
 */
export async function hasValidationErrors(page: Page): Promise<boolean> {
  const errorElements = page.locator('.error, [data-error="true"], .field-error, [aria-invalid="true"]');
  return (await errorElements.count()) > 0;
}

/**
 * Get all validation error messages
 */
export async function getValidationErrors(page: Page): Promise<string[]> {
  const errorElements = page.locator('.error-message, [data-testid="error-message"], .field-error');
  const errors: string[] = [];
  
  const count = await errorElements.count();
  for (let i = 0; i < count; i++) {
    const text = await errorElements.nth(i).textContent();
    if (text) errors.push(text.trim());
  }
  
  return errors;
}
