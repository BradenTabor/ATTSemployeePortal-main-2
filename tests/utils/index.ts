/**
 * Test Utilities Index
 * 
 * Central export for all test utility functions.
 */

export {
  createTestClient,
  createServiceClient,
  signInAsTestUser,
  signOut,
  getCurrentUser,
  cleanupTestData,
  cleanupTestPhotos,
  waitFor,
  TEST_USERS,
  type TestUserRole,
} from './testSupabaseClient';

/**
 * Generate a unique test ID for isolation
 */
export function generateTestId(prefix: string = 'TEST'): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${timestamp}-${random}`.toUpperCase();
}

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function until it succeeds or max attempts reached
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    delay?: number;
    backoff?: number;
  } = {}
): Promise<T> {
  const { maxAttempts = 3, delay = 1000, backoff = 2 } = options;
  
  let lastError: Error | undefined;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt < maxAttempts) {
        const waitTime = delay * Math.pow(backoff, attempt - 1);
        await sleep(waitTime);
      }
    }
  }
  
  throw lastError;
}

/**
 * Format date for test comparisons (YYYY-MM-DD)
 */
export function formatTestDate(date: Date = new Date()): string {
  return date.toISOString().split('T')[0];
}

/**
 * Format timestamp for test comparisons (ISO string)
 */
export function formatTestTimestamp(date: Date = new Date()): string {
  return date.toISOString();
}

/**
 * Create a mock file for upload testing
 */
export function createMockFile(
  name: string,
  type: string,
  sizeKB: number = 100
): File {
  const content = new Uint8Array(sizeKB * 1024);
  const blob = new Blob([content], { type });
  return new File([blob], name, { type });
}

/**
 * Assert that an object contains expected properties
 */
export function assertContains<T extends object>(
  actual: T,
  expected: Partial<T>
): void {
  for (const [key, value] of Object.entries(expected)) {
    const actualValue = actual[key as keyof T];
    if (actualValue !== value) {
      throw new Error(
        `Expected ${key} to be ${JSON.stringify(value)}, got ${JSON.stringify(actualValue)}`
      );
    }
  }
}

/**
 * Assert that a promise rejects with a specific error
 */
export async function assertRejects(
  promise: Promise<unknown>,
  expectedMessage?: string | RegExp
): Promise<Error> {
  try {
    await promise;
    throw new Error('Expected promise to reject, but it resolved');
  } catch (error) {
    if (error instanceof Error) {
      if (expectedMessage) {
        const matches = typeof expectedMessage === 'string'
          ? error.message.includes(expectedMessage)
          : expectedMessage.test(error.message);
        
        if (!matches) {
          throw new Error(
            `Expected error message to match ${expectedMessage}, got "${error.message}"`
          );
        }
      }
      return error;
    }
    throw error;
  }
}

/**
 * Test environment detection
 */
export const isTestEnvironment = (): boolean => {
  return process.env.NODE_ENV === 'test' || 
         process.env.VITEST === 'true' ||
         typeof (globalThis as { describe?: unknown }).describe === 'function';
};

/**
 * Skip test if condition is met
 */
export function skipIf(condition: boolean, reason: string): void {
  if (condition) {
    throw new Error(`SKIPPED: ${reason}`);
  }
}
