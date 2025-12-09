/**
 * SSR-safe, debounced localStorage persistence utilities
 * 
 * Used for persisting dashboard section collapsed states.
 * All reads/writes are guarded against SSR and disabled localStorage.
 * 
 * Key namespace: "atts:dashboard:collapse:{section}"
 */

// Debounce timeout tracking per key to avoid conflicts
const writeTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Read a boolean value from localStorage with SSR safety and error handling.
 * Should be called in useEffect to avoid hydration mismatch.
 * 
 * @param key - The localStorage key
 * @param defaultVal - Default value if key doesn't exist or parsing fails
 * @returns The stored boolean value or defaultVal
 */
export function getPersistedBool(key: string, defaultVal: boolean): boolean {
  if (typeof window === 'undefined') return defaultVal;
  
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return defaultVal;
    return JSON.parse(raw) === true;
  } catch {
    // localStorage disabled or parsing failed - return default
    return defaultVal;
  }
}

/**
 * Write a boolean value to localStorage with debouncing (200ms).
 * Debouncing prevents rapid writes when user toggles quickly.
 * SSR-safe and gracefully handles disabled localStorage.
 * 
 * @param key - The localStorage key
 * @param value - The boolean value to store
 */
export function setPersistedBool(key: string, value: boolean): void {
  if (typeof window === 'undefined') return;
  
  // Clear any pending write for this key
  const existingTimeout = writeTimeouts.get(key);
  if (existingTimeout) {
    clearTimeout(existingTimeout);
  }
  
  // Debounce the write by 200ms
  const timeout = setTimeout(() => {
    try {
      localStorage.setItem(key, JSON.stringify(!!value));
    } catch {
      // localStorage disabled - fail silently
    }
    writeTimeouts.delete(key);
  }, 200);
  
  writeTimeouts.set(key, timeout);
}

/**
 * Immediately write a boolean value to localStorage (no debounce).
 * Use sparingly - prefer setPersistedBool for normal UI interactions.
 * 
 * @param key - The localStorage key  
 * @param value - The boolean value to store
 */
export function setPersistedBoolImmediate(key: string, value: boolean): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(key, JSON.stringify(!!value));
  } catch {
    // localStorage disabled - fail silently
  }
}

/**
 * Remove a persisted value from localStorage.
 * SSR-safe and gracefully handles disabled localStorage.
 * 
 * @param key - The localStorage key to remove
 */
export function removePersistedValue(key: string): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.removeItem(key);
  } catch {
    // localStorage disabled - fail silently
  }
}

// Dashboard collapse state keys
export const PERSISTENCE_KEYS = {
  ANNOUNCEMENTS: 'atts:dashboard:collapse:announcements',
  ASSIGNED_JOBS: 'atts:dashboard:collapse:assignedJobs',
  QUICK_ACTIONS: 'atts:dashboard:collapse:quickActions',
  ALL_TOOLS: 'atts:dashboard:collapse:allTools',
} as const;

