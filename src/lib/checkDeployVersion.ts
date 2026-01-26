/**
 * Deploy version check for instant forced update.
 * Fetches /version.json and compares buildTime to running app; triggers reload when new deploy is live.
 */

import { BUILD_TIME } from './appVersion';

const MIN_CHECK_INTERVAL_MS = 30 * 1000;
const MAX_RELOAD_ATTEMPTS = 3;
const RELOAD_ATTEMPT_KEY = 'deploy-reload-attempts';

let lastCheckTime = 0;

export interface DeployVersion {
  version: string;
  buildTime: string;
  commit?: string;
  environment?: string;
}

/**
 * Check if a new deploy is available by comparing build times.
 * @returns true if new deploy detected, false otherwise
 */
export async function checkForNewDeploy(): Promise<boolean> {
  const now = Date.now();
  if (now - lastCheckTime < MIN_CHECK_INTERVAL_MS) {
    return false;
  }
  lastCheckTime = now;

  try {
    const response = await fetch(`/version.json?t=${now}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    });

    if (!response.ok) return false;

    const deployVersion: DeployVersion = await response.json();
    const isNewDeploy =
      typeof deployVersion.buildTime === 'string' &&
      deployVersion.buildTime !== BUILD_TIME;

    return isNewDeploy;
  } catch {
    return false;
  }
}

/**
 * Clear reload attempt counter (call on successful app mount).
 */
export function clearReloadAttempts(): void {
  try {
    sessionStorage.removeItem(RELOAD_ATTEMPT_KEY);
  } catch {
    // ignore
  }
}

/**
 * Force reload to load new deploy. Caps at MAX_RELOAD_ATTEMPTS to avoid loops.
 */
export function forceReloadForNewDeploy(): void {
  try {
    const raw = sessionStorage.getItem(RELOAD_ATTEMPT_KEY);
    const attempts = typeof raw === 'string' ? parseInt(raw, 10) : 0;
    if (attempts >= MAX_RELOAD_ATTEMPTS) {
      sessionStorage.removeItem(RELOAD_ATTEMPT_KEY);
      return;
    }
    sessionStorage.setItem(RELOAD_ATTEMPT_KEY, String(attempts + 1));
    sessionStorage.setItem('auto-updating', 'true');
  } catch {
    // ignore
  }
  window.location.reload();
}
