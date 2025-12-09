// src/lib/persistence.ts
// SSR-safe localStorage persistence utilities for dashboard collapsed states

/**
 * Safely reads a boolean value from localStorage with SSR guard.
 * Returns defaultVal if localStorage is unavailable or parsing fails.
 *
 * @param key - localStorage key (e.g. "atts:dashboard:collapse:announcements")
 * @param defaultVal - fallback value if key not found or parsing fails
 * @returns the stored boolean or defaultVal
 */
export function getPersistedBool(key: string, defaultVal: boolean): boolean {
  if (typeof window === 'undefined') {
    return defaultVal;
  }

  try {
    const stored = localStorage.getItem(key);
    if (stored === null) {
      return defaultVal;
    }
    const parsed = JSON.parse(stored);
    return typeof parsed === 'boolean' ? parsed : defaultVal;
  } catch {
    // localStorage disabled or parsing error
    return defaultVal;
  }
}

/**
 * Safely writes a boolean value to localStorage with SSR guard.
 * Silently fails if localStorage is unavailable.
 *
 * @param key - localStorage key
 * @param value - boolean value to store
 */
export function setPersistedBool(key: string, value: boolean): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage disabled or quota exceeded - fail silently
  }
}

